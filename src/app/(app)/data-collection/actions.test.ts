/**
 * Integration test against the real (seeded, live) database — calls the
 * server action directly, bypassing Next's Server Action wire protocol
 * entirely, which is the framework's concern, not this app's. Mocks only
 * the session (cookies) and Next's revalidation cache, both of which
 * require a real request scope this test doesn't have.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '@/lib/db/client';

let orgId: string;
let sessionOrgId: string;
let otherOrgId: string;
let assignmentId: string;
let questionId: string;
let originalValue: string | null;
let originalUnit: string | null;
let periodId: string;
let originalPeriodStatus: string;
let cleaningSpendQuestionId: string;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'gl_org' ? { value: sessionOrgId } : undefined),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({ redirect: () => {} }));

const { submitAnswer } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
  sessionOrgId = orgId;

  const other = await rawPrisma.organization.create({ data: { legalName: 'Zzz Cross-Tenant Test Org (delete me)' } });
  otherOrgId = other.id;

  const site = await rawPrisma.site.findFirstOrThrow({ where: { organizationId: orgId, code: 'MI-NG-01' } });
  const assignment = await rawPrisma.questionnaireAssignment.findFirstOrThrow({ where: { siteId: site.id } });
  assignmentId = assignment.id;
  periodId = assignment.reportingPeriodId;

  const period = await rawPrisma.reportingPeriod.findFirstOrThrow({ where: { id: periodId } });
  originalPeriodStatus = period.status;

  const question = await rawPrisma.question.findFirstOrThrow({ where: { code: 'diesel_qty' } });
  questionId = question.id;

  const cleaningSpend = await rawPrisma.question.findFirstOrThrow({ where: { code: 'cleaning_spend' } });
  cleaningSpendQuestionId = cleaningSpend.id;

  const existing = await rawPrisma.answer.findFirst({ where: { assignmentId, questionId } });
  originalValue = existing?.valueNumeric?.toString() ?? null;
  originalUnit = existing?.unit ?? null;
});

afterAll(async () => {
  // restore whatever was there before this test ran, and remove the
  // ActivityRecord/EmissionRecord these tests generated — otherwise the
  // Answer reverts but its calculated lineage stays pointed at test data,
  // which is exactly the kind of drift this product exists to prevent.
  const testActivity = await rawPrisma.activityRecord.findFirst({
    where: { answer: { assignmentId, questionId } },
  });
  if (testActivity) await rawPrisma.activityRecord.delete({ where: { id: testActivity.id } });

  const cleaningActivity = await rawPrisma.activityRecord.findFirst({
    where: { answer: { assignmentId, questionId: cleaningSpendQuestionId } },
  });
  if (cleaningActivity) await rawPrisma.activityRecord.delete({ where: { id: cleaningActivity.id } });
  await rawPrisma.answer.deleteMany({ where: { assignmentId, questionId: cleaningSpendQuestionId } });

  if (originalValue !== null && originalUnit !== null) {
    await rawPrisma.answer.update({
      where: { assignmentId_questionId: { assignmentId, questionId } },
      data: { valueNumeric: originalValue, unit: originalUnit as never },
    });
  }
  await rawPrisma.reportingPeriod.update({ where: { id: periodId }, data: { status: originalPeriodStatus as never } });
  await rawPrisma.organization.delete({ where: { id: otherOrgId } });
  await rawPrisma.$disconnect();
});

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe('submitAnswer', () => {
  it('rejects a negative quantity', async () => {
    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '-500', unit: 'L', dataQuality: 'MEASURED' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/negative/i);
  });

  it('rejects a unit not in the question\'s allowed units', async () => {
    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '100', unit: 'KG', dataQuality: 'MEASURED' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/unit must be one of/i);
  });

  it('rejects a missing/invalid data quality', async () => {
    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '100', unit: 'L', dataQuality: 'NOT_A_QUALITY' }));
    expect(result?.ok).toBe(false);
  });

  it('accepts a valid submission and actually writes it to the database', async () => {
    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '15000', unit: 'L', dataQuality: 'MEASURED' }));
    expect(result?.ok).toBe(true);

    const row = await rawPrisma.answer.findUnique({ where: { assignmentId_questionId: { assignmentId, questionId } } });
    expect(row?.valueNumeric?.toString()).toBe('15000');
    expect(row?.unit).toBe('L');
  });

  it('refuses to write into another org\'s assignment, even with a valid session', async () => {
    sessionOrgId = otherOrgId; // a real session — just for a different org
    try {
      const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '1', unit: 'L', dataQuality: 'MEASURED' }));
      expect(result?.ok).toBe(false);
      expect(result?.error).toMatch(/not found/i);
    } finally {
      sessionOrgId = orgId;
    }
  });

  it('refuses edits when the reporting period is locked', async () => {
    await rawPrisma.reportingPeriod.update({ where: { id: periodId }, data: { status: 'LOCKED' } });

    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '999', unit: 'L', dataQuality: 'MEASURED' }));
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/locked/i);

    await rawPrisma.reportingPeriod.update({ where: { id: periodId }, data: { status: originalPeriodStatus as never } });
  });

  it('actually calculates emissions — 15000 L diesel at the real DEFRA factor, not a guess', async () => {
    const result = await submitAnswer(null, fd({ assignmentId, questionId, value: '15000', unit: 'L', dataQuality: 'MEASURED' }));
    expect(result?.ok).toBe(true);

    // DEFRA factor for diesel/stationary combustion is 2.68000 kg CO2e/L
    // (seed-data.ts). No day-split (full-year activity), no consolidation
    // discount, multiplier 1 — so this must be exact, not approximate.
    expect(result?.emissionsKgCo2e).toBe('40200.000');

    const activity = await rawPrisma.activityRecord.findFirstOrThrow({ where: { answer: { assignmentId, questionId } } });
    expect(activity.quantity.toString()).toBe('15000'); // raw reported value, not multiplier-scaled
    expect(activity.fuelOrMaterialCode).toBe('diesel');

    const records = await rawPrisma.emissionRecord.findMany({ where: { activityRecordId: activity.id } });
    expect(records).toHaveLength(1);
    expect(records[0].emissionsKgCo2e.toString()).toBe('40200');
    expect(records[0].factorValue.toString()).toBe('2.68');
    expect(records[0].factorSource).toContain('UK Government GHG Conversion Factors');
    expect(records[0].factorSource).toContain('Fuels, Table 5');

    const events = await rawPrisma.auditEvent.findMany({
      where: { entityType: { in: ['Answer', 'ActivityRecord', 'EmissionRecord'] }, entityId: { in: [activity.id, records[0].id, activity.answerId ?? ''] } },
      orderBy: { occurredAt: 'desc' },
    });
    expect(events.some((e) => e.entityType === 'ActivityRecord')).toBe(true);
  });

  it('never fabricates a zero for a broken binding — saves the answer, skips the calculation, says why', async () => {
    // cleaning_spend is deliberately broken in seed-data.ts: no factor
    // exists for fuelOrMaterialCode "cleaning_services".
    const result = await submitAnswer(
      null,
      fd({ assignmentId, questionId: cleaningSpendQuestionId, value: '5000', unit: 'GBP', dataQuality: 'ESTIMATED' }),
    );
    expect(result?.ok).toBe(true); // the answer itself is valid and gets saved
    expect(result?.emissionsKgCo2e).toBeUndefined(); // but nothing was calculated
    expect(result?.calcWarning).toBeTruthy();

    const activity = await rawPrisma.activityRecord.findFirst({ where: { answer: { assignmentId, questionId: cleaningSpendQuestionId } } });
    expect(activity).not.toBeNull();

    const records = await rawPrisma.emissionRecord.findMany({ where: { activityRecordId: activity!.id } });
    expect(records).toHaveLength(0); // exactly zero rows — not one row holding a fabricated 0
  });
});
