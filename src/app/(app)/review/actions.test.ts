/**
 * Integration test against the real (seeded, live) database — same
 * approach as data-collection/actions.test.ts: call the server action
 * directly, mock only the session and Next's cache/navigation.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { adminPrisma as rawPrisma } from '@/lib/db/admin-client';

let orgId: string;
let sessionOrgId: string;
let managerUserId: string;
let inputterUserId: string;
let siteId: string;
let periodId: string;
let assignmentId: string;
let questionId: string;
let dieselPositionId: string;
let originalValue: string | null;
let originalUnit: string | null;
let createdCorrectionIds: string[] = [];

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'gl_org') return { value: sessionOrgId };
      if (name === 'gl_user') return { value: sessionUserId };
      return undefined;
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({ redirect: () => {} }));

let sessionUserId: string;

const { requestCorrection } = await import('./actions');
const { submitAnswer } = await import('../data-collection/actions');

function positionValueKey(positionId: string) {
  return { positionId_siteId_reportingPeriodId_line: { positionId, siteId, reportingPeriodId: periodId, line: 1 } } as const;
}

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
  sessionOrgId = orgId;

  const manager = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'DATA_MANAGER' } });
  managerUserId = manager.userId;
  const inputter = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'DATA_INPUTTER' } });
  inputterUserId = inputter.userId;

  // A different site from data-collection/actions.test.ts's MI-NG-01 —
  // both files run concurrently against the same live database, and
  // PositionValue rows are keyed by (position, site, period), so sharing
  // a site here would race the other file's writes to the same row.
  const site = await rawPrisma.site.findFirstOrThrow({ where: { organizationId: orgId, code: 'MI-CW-07' } });
  siteId = site.id;
  const assignment = await rawPrisma.questionnaireAssignment.findFirstOrThrow({ where: { siteId: site.id } });
  assignmentId = assignment.id;
  periodId = assignment.reportingPeriodId;

  const question = await rawPrisma.question.findFirstOrThrow({ where: { code: 'diesel_qty' } });
  questionId = question.id;
  const dieselPosition = await rawPrisma.position.findFirstOrThrow({ where: { organizationId: orgId, positionCode: 'diesel_qty' } });
  dieselPositionId = dieselPosition.id;

  const existing = await rawPrisma.positionValue.findUnique({ where: positionValueKey(dieselPositionId) });
  originalValue = existing?.valueNumeric?.toString() ?? null;
  originalUnit = existing?.unit ?? null;
  if (!existing) {
    // requestCorrection needs a real PositionValue to point at — a cold
    // Neon connection plus the full calc pipeline this exercises can take
    // well over the default hook timeout.
    sessionUserId = inputterUserId;
    await submitAnswer(null, fd({ assignmentId, questionId, value: '1000', unit: 'L', dataQuality: 'MEASURED' }));
  }
}, 60000);

afterAll(async () => {
  await rawPrisma.correctionRequest.deleteMany({ where: { id: { in: createdCorrectionIds } } });
  const testActivity = await rawPrisma.activityRecord.findFirst({
    where: { positionValueId: (await rawPrisma.positionValue.findUnique({ where: positionValueKey(dieselPositionId) }))?.id },
  });
  if (testActivity) await rawPrisma.activityRecord.delete({ where: { id: testActivity.id } });
  if (originalValue !== null && originalUnit !== null) {
    await rawPrisma.positionValue.update({
      where: positionValueKey(dieselPositionId),
      data: { valueNumeric: originalValue, unit: originalUnit as never, status: 'ANSWERED' },
    });
  } else {
    await rawPrisma.positionValue.delete({ where: positionValueKey(dieselPositionId) }).catch(() => {});
  }
  await rawPrisma.$disconnect();
}, 60000);

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe('requestCorrection', () => {
  it('rejects a role without manage_questionnaire', async () => {
    sessionUserId = inputterUserId;
    const positionValue = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    const result = await requestCorrection(null, fd({ positionValueId: positionValue.id, note: 'looks off' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/can't send this back/i);
  });

  it('rejects an empty note', async () => {
    sessionUserId = managerUserId;
    const positionValue = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    const result = await requestCorrection(null, fd({ positionValueId: positionValue.id, note: '' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/explain what needs fixing/i);
  });

  it('flags the entry, opens a CorrectionRequest, and records an audit event', async () => {
    sessionUserId = managerUserId;
    const positionValue = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    const result = await requestCorrection(null, fd({ positionValueId: positionValue.id, note: 'Meter reading looks 10x too high' }));
    expect(result?.ok).toBe(true);

    const updated = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    expect(updated.status).toBe('FLAGGED');

    const correction = await rawPrisma.correctionRequest.findFirstOrThrow({ where: { positionValueId: positionValue.id, status: 'OPEN' } });
    createdCorrectionIds.push(correction.id);
    expect(correction.note).toMatch(/10x too high/);
    expect(correction.requestedById).toBe(managerUserId);

    const audit = await rawPrisma.auditEvent.findFirst({
      where: { entityType: 'PositionValue', entityId: positionValue.id, action: 'REJECT' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('refuses to flag an entry that is already flagged', async () => {
    sessionUserId = managerUserId;
    const positionValue = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    const result = await requestCorrection(null, fd({ positionValueId: positionValue.id, note: 'again' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/already sent back/i);
  });

  it('resolves automatically when the owner resubmits through submitAnswer', async () => {
    sessionUserId = inputterUserId;
    const before = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    const result = await submitAnswer(null, fd({
      assignmentId, questionId, value: '1100', unit: 'L', dataQuality: 'MEASURED',
      expectedUpdatedAt: before.updatedAt.toISOString(),
    }));
    expect(result?.ok).toBe(true);

    const updated = await rawPrisma.positionValue.findUniqueOrThrow({ where: positionValueKey(dieselPositionId) });
    expect(updated.status).toBe('ANSWERED');

    const correction = await rawPrisma.correctionRequest.findFirstOrThrow({ where: { positionValueId: before.id }, orderBy: { createdAt: 'desc' } });
    expect(correction.status).toBe('RESOLVED');
    expect(correction.resolvedById).toBe(inputterUserId);
  });
});
