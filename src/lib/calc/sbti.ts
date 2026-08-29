/**
 * SBTi near-term target — Phase D of the scoped-fixes plan. Absolute
 * Contraction Approach (ACA): a straight-line reduction from base-year
 * emissions to a target year, at a chosen or minimum-ambition annual
 * rate. Own engine version, same reasoning as pcaf.ts.
 *
 * MINIMUM_AMBITION_RATE_PER_YEAR (4.2%/year) is the SBTi Corporate
 * Net-Zero Standard's published cross-sector minimum for a 1.5°C-aligned
 * near-term target under the Absolute Contraction Approach. Real,
 * sector-specific pathways (SDA, FLAG, etc.) can differ — this is a v1
 * cross-sector default for a first-pass check, not a substitute for
 * SBTi's own validation before submitting a real target.
 *
 * PURE: Decimal in, Decimal out, no Prisma, no fetch, no Date.now().
 */
import Decimal from 'decimal.js';
import { z } from 'zod';

export const SBTI_CALC_ENGINE_VERSION = '1.0.0';
export const MINIMUM_AMBITION_RATE_PER_YEAR = '0.042';
export const MINIMUM_AMBITION_SOURCE = 'SBTi Corporate Net-Zero Standard — Absolute Contraction Approach, 1.5°C cross-sector minimum';

export const SbtiInputSchema = z
  .object({
    baseYear: z.number().int(),
    baseYearEmissionsKgCo2e: z.string().refine((v) => !new Decimal(v).isNegative(), 'Base-year emissions cannot be negative.'),
    targetYear: z.number().int(),
    /** Defaults to the minimum-ambition rate if omitted. */
    reductionRatePerYear: z.string().optional(),
  })
  .refine((d) => d.targetYear > d.baseYear, { message: 'Target year must be after the base year.' });

export type SbtiInput = z.infer<typeof SbtiInputSchema>;

export interface SbtiResult {
  yearsToTarget: number;
  reductionRatePerYear: Decimal;
  totalReductionPct: Decimal;
  targetYearEmissionsKgCo2e: Decimal;
  meetsMinimumAmbition: boolean;
  minimumAmbitionRatePerYear: Decimal;
  minimumAmbitionSource: string;
  calcEngineVersion: string;
}

export function calculateSbtiNearTermTarget(input: SbtiInput): SbtiResult {
  const base = new Decimal(input.baseYearEmissionsKgCo2e);
  const yearsToTarget = input.targetYear - input.baseYear;
  const minRate = new Decimal(MINIMUM_AMBITION_RATE_PER_YEAR);
  const rate = new Decimal(input.reductionRatePerYear ?? MINIMUM_AMBITION_RATE_PER_YEAR);

  const totalReductionPct = rate.mul(yearsToTarget);
  // Absolute Contraction Approach is a straight line — it can reach but
  // never usefully go below zero (a rate/duration combination that would
  // imply negative emissions just means the pathway floors at zero).
  const targetYearEmissionsKgCo2e = Decimal.max(0, base.mul(new Decimal(1).minus(totalReductionPct)));

  return {
    yearsToTarget,
    reductionRatePerYear: rate,
    totalReductionPct,
    targetYearEmissionsKgCo2e,
    meetsMinimumAmbition: rate.gte(minRate),
    minimumAmbitionRatePerYear: minRate,
    minimumAmbitionSource: MINIMUM_AMBITION_SOURCE,
    calcEngineVersion: SBTI_CALC_ENGINE_VERSION,
  };
}
