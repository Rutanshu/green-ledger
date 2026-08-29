import { describe, expect, it } from 'vitest';
import { calculateSbtiNearTermTarget, SbtiInputSchema, MINIMUM_AMBITION_RATE_PER_YEAR, SBTI_CALC_ENGINE_VERSION } from './sbti';

describe('calculateSbtiNearTermTarget', () => {
  it('at the minimum-ambition rate over 5 years, reduces by 5 x 4.2% = 21%', () => {
    const input = SbtiInputSchema.parse({ baseYear: 2020, baseYearEmissionsKgCo2e: '1000000', targetYear: 2025 });
    const r = calculateSbtiNearTermTarget(input);
    expect(r.yearsToTarget).toBe(5);
    expect(r.reductionRatePerYear.toString()).toBe(MINIMUM_AMBITION_RATE_PER_YEAR);
    expect(r.totalReductionPct.toString()).toBe('0.21');
    expect(r.targetYearEmissionsKgCo2e.toString()).toBe('790000');
    expect(r.meetsMinimumAmbition).toBe(true);
    expect(r.calcEngineVersion).toBe(SBTI_CALC_ENGINE_VERSION);
  });

  it('a rate below the minimum still computes but is flagged as not meeting minimum ambition', () => {
    const input = SbtiInputSchema.parse({
      baseYear: 2020,
      baseYearEmissionsKgCo2e: '1000000',
      targetYear: 2025,
      reductionRatePerYear: '0.02',
    });
    const r = calculateSbtiNearTermTarget(input);
    expect(r.meetsMinimumAmbition).toBe(false);
    expect(r.targetYearEmissionsKgCo2e.toString()).toBe('900000');
  });

  it('floors target-year emissions at zero rather than going negative', () => {
    const input = SbtiInputSchema.parse({
      baseYear: 2020,
      baseYearEmissionsKgCo2e: '1000',
      targetYear: 2050,
      reductionRatePerYear: '0.1', // 30 years x 10%/year = 300% > 100%
    });
    const r = calculateSbtiNearTermTarget(input);
    expect(r.targetYearEmissionsKgCo2e.toString()).toBe('0');
  });

  it('Zod schema rejects a target year at or before the base year', () => {
    const parsed = SbtiInputSchema.safeParse({ baseYear: 2025, baseYearEmissionsKgCo2e: '1000', targetYear: 2025 });
    expect(parsed.success).toBe(false);
  });

  it('Zod schema rejects negative base-year emissions', () => {
    const parsed = SbtiInputSchema.safeParse({ baseYear: 2020, baseYearEmissionsKgCo2e: '-500', targetYear: 2025 });
    expect(parsed.success).toBe(false);
  });

  it('same input always reproduces the same result', () => {
    const input = SbtiInputSchema.parse({ baseYear: 2022, baseYearEmissionsKgCo2e: '542000', targetYear: 2030 });
    const a = calculateSbtiNearTermTarget(input);
    const b = calculateSbtiNearTermTarget(input);
    expect(a.targetYearEmissionsKgCo2e.toString()).toBe(b.targetYearEmissionsKgCo2e.toString());
  });
});
