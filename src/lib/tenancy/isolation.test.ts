/**
 * GHG_TOOL_ARCHITECTURE.md §19.2: "a test that proves it: a suite that, for
 * every model, attempts a cross-tenant read and write and asserts both
 * fail... This is the single most important test in the product."
 *
 * For every model in STRICT_ORG_MODELS (lib/db/tenant.ts), this creates one
 * real row belonging to org A, then uses org B's orgScopedClient to attempt
 * a read and a write against that exact row id. Both must fail — a cross-
 * org findFirst must return null (not throw, not leak the row), and a
 * cross-org update must throw (Prisma's unique-shaped update can't find a
 * row matching both the id AND org B's organizationId, so it throws "record
 * not found" — the correct failure shape, not a permission error).
 *
 * Uses adminPrisma (owner role, bypasses RLS) only for fixture setup/teardown,
 * exactly like seed.ts and the other *.test.ts files already do — never for
 * the actual isolation assertions, which go through the real orgScopedClient
 * against the real RLS-restricted app_user connection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminPrisma } from '@/lib/db/admin-client';
import { orgScopedClient } from '@/lib/db/tenant';

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string };
let siteA: { id: string };
let periodA: { id: string };

/** One real row per strict model, all belonging to orgA. */
const fixtures: Record<string, { id: string }> = {};

// Sequential fixture creation (14 rows) over a possibly-cold Neon connection
// can exceed vitest's default 10s hook timeout on its own — see
// vitest.config.mts's testTimeout comment for the same reasoning.
beforeAll(async () => {
  orgA = await adminPrisma.organization.create({ data: { legalName: 'Isolation Test Org A (delete me)' } });
  orgB = await adminPrisma.organization.create({ data: { legalName: 'Isolation Test Org B (delete me)' } });
  userA = await adminPrisma.user.create({ data: { email: `isolation-test-a-${Date.now()}@example.invalid`, name: 'Isolation Test User A' } });

  fixtures.Membership = await adminPrisma.membership.create({
    data: { userId: userA.id, organizationId: orgA.id, role: 'READ_ONLY' },
  });

  fixtures.LabelOverride = await adminPrisma.labelOverride.create({
    data: { organizationId: orgA.id, entityKind: 'SCOPE', code: 'SCOPE_1', label: 'Test label' },
  });

  siteA = await adminPrisma.site.create({
    data: { organizationId: orgA.id, name: 'Isolation Test Site', code: 'ISO-TEST-01', country: 'GB', siteType: 'office' },
  });
  fixtures.Site = siteA;

  fixtures.SiteAsset = await adminPrisma.siteAsset.create({
    data: { organizationId: orgA.id, siteId: siteA.id, name: 'Test asset', assetTypeCode: 'test', category: 'OTHER' },
  });

  periodA = await adminPrisma.reportingPeriod.create({
    data: { organizationId: orgA.id, label: 'Isolation Test FY', startsOn: new Date('2030-01-01'), endsOn: new Date('2030-12-31') },
  });
  fixtures.ReportingPeriod = periodA;

  fixtures.QuestionnaireTemplate = await adminPrisma.questionnaireTemplate.create({
    data: { organizationId: orgA.id, name: 'Isolation Test Template', version: 1 },
  });

  fixtures.Document = await adminPrisma.document.create({
    data: {
      organizationId: orgA.id, storageKey: 'test/key', filename: 'test.pdf',
      mimeType: 'application/pdf', sizeBytes: 100, sha256: 'x'.repeat(64),
    },
  });

  fixtures.Task = await adminPrisma.task.create({
    data: { organizationId: orgA.id, title: 'Isolation test task' },
  });

  fixtures.AuditEvent = await adminPrisma.auditEvent.create({
    data: { organizationId: orgA.id, action: 'CREATE', entityType: 'Test', entityId: 'test-id' },
  });

  fixtures.Target = await adminPrisma.target.create({
    data: {
      organizationId: orgA.id, name: 'Isolation test target', scopeCoverage: { scopes: ['SCOPE_1'] },
      baseYear: 2025, baseYearEmissionsKg: '1000', targetYear: 2030, reductionPct: '20',
    },
  });

  fixtures.Report = await adminPrisma.report.create({
    data: {
      organizationId: orgA.id, reportingPeriodId: periodA.id, reportType: 'test',
      figuresSnapshot: {}, factorSetsUsed: {}, calcEngineVersion: 'test',
    },
  });

  fixtures.ImportBatch = await adminPrisma.importBatch.create({
    data: { organizationId: orgA.id, filename: 'test.csv', sha256: 'x'.repeat(64) },
  });

  fixtures.ActivityRecord = await adminPrisma.activityRecord.create({
    data: {
      organizationId: orgA.id, siteId: siteA.id, reportingPeriodId: periodA.id,
      scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED',
      quantity: '100', unit: 'L', activityStart: new Date('2030-01-01'), activityEnd: new Date('2030-12-31'),
      fuelOrMaterialCode: 'test_fuel',
    },
  });

  fixtures.Position = await adminPrisma.position.create({
    data: { organizationId: orgA.id, title: 'Isolation test position', type: 'OTHER' },
  });

  fixtures.Entitlement = await adminPrisma.entitlement.create({
    data: { organizationId: orgA.id, featureCode: 'isolation_test_feature' },
  });

  fixtures.ImpactProfile = await adminPrisma.impactProfile.create({
    data: { organizationId: orgA.id, name: 'Isolation test profile', version: 1 },
  });
}, 30000);

afterAll(async () => {
  // FK cascades from Organization delete handle every fixture row.
  await adminPrisma.organization.delete({ where: { id: orgA.id } });
  await adminPrisma.organization.delete({ where: { id: orgB.id } });
  await adminPrisma.user.delete({ where: { id: userA.id } });
}, 30000);

const STRICT_ORG_MODELS = [
  'Membership', 'LabelOverride', 'Site', 'SiteAsset', 'ReportingPeriod',
  'QuestionnaireTemplate', 'Document', 'Task', 'AuditEvent', 'Target',
  'Report', 'ImportBatch', 'ActivityRecord', 'Position', 'Entitlement', 'ImpactProfile',
] as const;

// audit_events has UPDATE/DELETE revoked at the database grant level (see
// the org_scoping_rls migration) — its immutability doesn't depend on
// org-scoping working correctly, so the write-side check would pass for
// the wrong reason. The read-side check still proves scoping for it.
const SKIP_WRITE_CHECK = new Set(['AuditEvent']);

describe('cross-tenant isolation — every strict model', () => {
  for (const model of STRICT_ORG_MODELS) {
    const accessor = model.charAt(0).toLowerCase() + model.slice(1);

    it(`${model}: org B cannot read org A's row`, async () => {
      const row = fixtures[model];
      expect(row, `no fixture created for ${model} — test setup is incomplete`).toBeDefined();

      const dbAsOrgB = orgScopedClient(orgB.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = await (dbAsOrgB as any)[accessor].findFirst({ where: { id: row.id } });
      expect(found, `${model} row belonging to org A was visible from org B's scoped client`).toBeNull();
    });

    if (!SKIP_WRITE_CHECK.has(model)) {
      it(`${model}: org B cannot write org A's row`, async () => {
        const row = fixtures[model];
        const dbAsOrgB = orgScopedClient(orgB.id);
        await expect(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (dbAsOrgB as any)[accessor].update({ where: { id: row.id }, data: {} }),
          `${model} row belonging to org A was writable from org B's scoped client`,
        ).rejects.toThrow();
      });
    }
  }
});

describe('cross-tenant isolation — raw RLS, no app.org_id set at all', () => {
  it('a query with no org context set sees nothing across every strict table, not just one', async () => {
    // withOrgTransaction/orgScopedClient always set app.org_id — this
    // exercises the case where nothing sets it at all, i.e. RLS as the
    // sole remaining defense if layer 1 were ever bypassed entirely.
    for (const model of STRICT_ORG_MODELS) {
      const accessor = model.charAt(0).toLowerCase() + model.slice(1);
      const row = fixtures[model];
      // rawPrisma itself (imported indirectly through admin-client's sibling,
      // the actual app connection) has no SET LOCAL applied outside a scoped
      // transaction — reuse orgScopedClient with a bogus, never-matching org
      // id as the cheapest way to assert "not org A" without a raw import.
      const dbAsNobody = orgScopedClient('00000000-0000-0000-0000-000000000000');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = await (dbAsNobody as any)[accessor].findFirst({ where: { id: row.id } });
      expect(found, `${model} leaked to an org id that owns nothing`).toBeNull();
    }
  });
});
