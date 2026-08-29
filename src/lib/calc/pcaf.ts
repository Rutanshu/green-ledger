/**
 * PCAF financed emissions — Phase D of the scoped-fixes plan (imperative-
 * coalescing-hollerith.md). A separate methodology from the core factor-
 * binding engine (no fuel, no emission factor — an investee's own
 * emissions attributed by ownership share), so it gets its own engine
 * version rather than bumping CALC_ENGINE_VERSION.
 *
 * v1 covers the two asset classes with the broadest applicability
 * (any org holding public equity/bonds, or business loans) per the
 * PCAF Global GHG Accounting and Reporting Standard for the Financial
 * Industry — not the full PCAF asset-class list.
 *
 * PURE: Decimal in, Decimal out, no Prisma, no fetch, no Date.now().
 */
import Decimal from 'decimal.js';
import { z } from 'zod';

export const PCAF_CALC_ENGINE_VERSION = '1.0.0';

export const PcafInputSchema = z
  .object({
    assetClass: z.enum(['LISTED_EQUITY_CORPORATE_BONDS', 'BUSINESS_LOANS']),
    outstandingAmount: z.string().refine((v) => !new Decimal(v).isNegative(), 'Outstanding amount cannot be negative.'),
    // LISTED_EQUITY_CORPORATE_BONDS: attribution = outstanding / EVIC
    evic: z.string().optional(),
    // BUSINESS_LOANS: attribution = outstanding / (total equity + total debt)
    totalEquity: z.string().optional(),
    totalDebt: z.string().optional(),
    investeeEmissionsKgCo2e: z.string(),
    /** PCAF's own 1 (best) - 5 (worst) data-quality score for the investee emissions figure used — recorded, not computed. */
    dataQualityScore: z.number().int().min(1).max(5).optional(),
  })
  .refine(
    (d) =>
      d.assetClass === 'LISTED_EQUITY_CORPORATE_BONDS'
        ? d.evic !== undefined
        : d.totalEquity !== undefined && d.totalDebt !== undefined,
    { message: 'Missing the denominator field(s) for this asset class.' },
  );

export type PcafInput = z.infer<typeof PcafInputSchema>;

export class PcafZeroDenominatorError extends Error {
  constructor(readonly assetClass: string) {
    super(`Cannot compute an attribution factor for ${assetClass}: the denominator is zero.`);
    this.name = 'PcafZeroDenominatorError';
  }
}

export interface PcafResult {
  assetClass: string;
  attributionFactor: Decimal;
  denominatorUsed: Decimal;
  financedEmissionsKgCo2e: Decimal;
  dataQualityScore: number | null;
  calcEngineVersion: string;
}

export function calculatePcafFinancedEmissions(input: PcafInput): PcafResult {
  const outstanding = new Decimal(input.outstandingAmount);
  const investeeEmissions = new Decimal(input.investeeEmissionsKgCo2e);

  const denominator =
    input.assetClass === 'LISTED_EQUITY_CORPORATE_BONDS'
      ? new Decimal(input.evic!)
      : new Decimal(input.totalEquity!).plus(input.totalDebt!);

  if (denominator.isZero()) throw new PcafZeroDenominatorError(input.assetClass);

  const attributionFactor = outstanding.div(denominator);
  const financedEmissionsKgCo2e = attributionFactor.mul(investeeEmissions);

  return {
    assetClass: input.assetClass,
    attributionFactor,
    denominatorUsed: denominator,
    financedEmissionsKgCo2e,
    dataQualityScore: input.dataQualityScore ?? null,
    calcEngineVersion: PCAF_CALC_ENGINE_VERSION,
  };
}
