/**
 * Integration test against the real (seeded, live) database, same
 * approach as data-collection/actions.test.ts.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { adminPrisma as rawPrisma } from '@/lib/db/admin-client';

let orgId: string;
let sessionOrgId: string;
let sessionUserId: string;
let periodId: string;

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

const { getPeriodReadinessAction } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
  sessionOrgId = orgId;
  const superAdmin = await rawPrisma.membership.findFirstOrThrow({ where: { organizationId: orgId, role: 'SUPER_ADMIN' } });
  sessionUserId = superAdmin.userId;

  const assignment = await rawPrisma.questionnaireAssignment.findFirstOrThrow({
    where: { site: { organizationId: orgId, code: 'MI-NG-01' } },
  });
  periodId = assignment.reportingPeriodId;
}, 30000);

afterAll(async () => {
  await rawPrisma.$disconnect();
});

describe('getPeriodReadiness — checks every published scope template, not just one', () => {
  it("counts broken/ambiguous bindings across ALL of the org's published templates (a site now holds up to 17)", async () => {
    // Independently compute the real answer by walking every published
    // template, so this test is sensitive to the actual bug: before the
    // fix, only whichever ONE template Prisma returned first for a bare
    // findFirst() got checked, silently ignoring the other ~16.
    const templates = await rawPrisma.questionnaireTemplate.findMany({
      where: { organizationId: orgId, status: 'PUBLISHED' },
      include: { sections: { include: { questions: { include: { binding: true } } } } },
    });
    expect(templates.length).toBeGreaterThan(1); // otherwise this test can't actually distinguish findFirst from findMany

    const expectedBroken = templates
      .flatMap((t) => t.sections)
      .flatMap((s) => s.questions)
      .map((q) => q.binding)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .filter((b) => b.health === 'BROKEN' || b.health === 'AMBIGUOUS').length;

    // cleaning_spend's binding is deliberately broken in seed data, and it
    // lives in "Scope 3.1 — Purchased Goods & Services" — not the first
    // template created — so this is a real, non-contrived regression case.
    expect(expectedBroken).toBeGreaterThan(0);

    const readiness = await getPeriodReadinessAction(periodId);
    expect(readiness).not.toBeNull();
    expect(readiness!.brokenBindings).toBe(expectedBroken);
    expect(readiness!.ready).toBe(false); // can't be ready with a broken binding outstanding
  });
});
