/**
 * THE CALCULATION ENGINE. See SPEC.md §7.
 *
 * PURE. No Prisma import, no fetch, no Date.now(), no Math.random().
 * Every input is an argument; every input is returned in the result so it can be
 * snapshotted onto the EmissionRecord.
 *
 *   emissions_kg_co2e = quantity_normalised x factor_value x gwp x consolidation_share
 *
 * Bump CALC_ENGINE_VERSION whenever the formula changes. It is stored on every record.
 */
import Decimal from 'decimal.js';
import { convert, type UnitCode } from '../units';
import {
  resolveFactor, sliceByFactorValidity,
  type CandidateFactor, type ResolveQuery, type EmissionBasis, type Gas,
} from '../factors';

export const CALC_ENGINE_VERSION = '1.0.0';

// Enough precision that repeated multiplication never loses a kilogram.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export interface CalcActivity {
  quantity: Decimal | string | number;
  unit: UnitCode;
  activityStart: Date;
  activityEnd: Date;
}

export interface CalcInput {
  activity: CalcActivity;
  /** all factors that could possibly apply — resolution happens in here, purely */
  candidates: readonly CandidateFactor[];
  query: Omit<ResolveQuery, 'on'>;
  /** gas -> GWP100 */
  gwpValues: Readonly<Record<string, Decimal | string | number>>;
  gwpSetName: string;
  consolidationShare: Decimal | string | number;
  /** from the FactorBinding; e.g. 12 for a question answered per month */
  multiplier?: Decimal | string | number;
}

export interface CalcResult {
  basis: EmissionBasis;
  gas: Gas;
  // --- snapshotted inputs ---
  quantityNormalised: Decimal;
  unitNormalised: UnitCode;
  unitConversionFactor: Decimal;
  factorId: string;
  factorValue: Decimal;
  factorUnitNumerator: UnitCode;
  factorUnitDenominator: UnitCode;
  factorSource: string;
  factorVersion: string;
  factorValidFrom: Date;
  factorValidTo: Date | null;
  gwpValue: Decimal;
  gwpSet: string;
  consolidationShare: Decimal;
  daysCovered: number;
  daysTotal: number;
  // --- output ---
  emissionsKgCo2e: Decimal;
  calcEngineVersion: string;
}

const DAY_MS = 86_400_000;
const dayCount = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;

/**
 * One activity -> one or more emission results.
 * More than one when the activity spans a factor change (day-weighted split).
 */
export function calculateEmissions(input: CalcInput): CalcResult[] {
  const { activity, candidates, query, gwpValues, gwpSetName } = input;

  const rawQuantity = new Decimal(activity.quantity);
  if (rawQuantity.isNegative()) throw new Error('Quantity cannot be negative.');

  const share = new Decimal(input.consolidationShare);
  const multiplier = new Decimal(input.multiplier ?? 1);
  const totalDays = dayCount(activity.activityStart, activity.activityEnd);

  const slices = sliceByFactorValidity(candidates, query, activity.activityStart, activity.activityEnd);

  return slices.map((slice) => {
    const f = slice.factor;

    // Unit conversion. Throws UnitMismatchError across dimensions — by design.
    const conv = convert(rawQuantity, activity.unit, f.unitDenominator);

    // Day-weight this slice's share of the activity.
    const weight = new Decimal(slice.days).div(totalDays);
    const quantityNormalised = conv.quantity.mul(weight).mul(multiplier);

    const gwpRaw = gwpValues[f.gas] ?? (f.gas === 'CO2E_BLENDED' ? 1 : undefined);
    if (gwpRaw === undefined) throw new Error(`No GWP value for gas ${f.gas} in set ${gwpSetName}.`);
    const gwpValue = new Decimal(gwpRaw);

    const factorValue = new Decimal(f.value);
    const emissionsKgCo2e = quantityNormalised.mul(factorValue).mul(gwpValue).mul(share);

    return {
      basis: f.basis,
      gas: f.gas,
      quantityNormalised,
      unitNormalised: f.unitDenominator,
      unitConversionFactor: conv.factor,
      factorId: f.id,
      factorValue,
      factorUnitNumerator: f.unitNumerator,
      factorUnitDenominator: f.unitDenominator,
      factorSource: `${f.factorSetName} ${f.factorSetVersion}, ${f.sourceCitation}`,
      factorVersion: f.factorSetVersion,
      factorValidFrom: f.validFrom,
      factorValidTo: f.validTo ?? null,
      gwpValue,
      gwpSet: gwpSetName,
      consolidationShare: share,
      daysCovered: slice.days,
      daysTotal: totalDays,
      emissionsKgCo2e,
      calcEngineVersion: CALC_ENGINE_VERSION,
    };
  });
}

/**
 * Scope 2 must be reported on BOTH bases — ESRS E1-6. The UI never lets a user pick one.
 * Market-based falls back to location-based when nothing contractual exists, and says so.
 */
export interface DualBasisResult {
  locationBased: CalcResult[];
  marketBased: CalcResult[];
  marketFellBackToLocation: boolean;
}

export function calculateDualBasis(input: CalcInput): DualBasisResult {
  const locationBased = calculateEmissions({
    ...input,
    query: { ...input.query, basis: 'LOCATION_BASED' },
  });

  try {
    const marketBased = calculateEmissions({
      ...input,
      query: { ...input.query, basis: 'MARKET_BASED' },
    });
    return { locationBased, marketBased, marketFellBackToLocation: false };
  } catch {
    return {
      locationBased,
      marketBased: locationBased.map((r) => ({ ...r, basis: 'MARKET_BASED' as const })),
      marketFellBackToLocation: true,
    };
  }
}

/** Reports round; storage never does. */
export function toTonnes(kg: Decimal, dp = 2): string {
  return kg.div(1000).toFixed(dp);
}

export function sumKg(results: readonly CalcResult[]): Decimal {
  return results.reduce((acc, r) => acc.plus(r.emissionsKgCo2e), new Decimal(0));
}
