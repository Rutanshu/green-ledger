/**
 * Factor resolution. See SPEC.md §3.6.
 *
 * PURE: takes a candidate list, never a database. Ties are an ERROR, not a silent pick.
 * An activity spanning a factor change is SPLIT pro-rata by days.
 */
import Decimal from 'decimal.js';
import type { UnitCode } from '../units';

export type Scope = 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
export type ActivityType =
  | 'STATIONARY_COMBUSTION' | 'MOBILE_COMBUSTION' | 'FUGITIVE' | 'PROCESS'
  | 'PURCHASED_ELECTRICITY' | 'PURCHASED_HEAT' | 'PURCHASED_STEAM' | 'PURCHASED_COOLING'
  | 'SPEND' | 'DISTANCE' | 'MASS' | 'WASTE' | 'OTHER';
export type CalcMethod =
  | 'FUEL_BASED' | 'DISTANCE_BASED' | 'SPEND_BASED' | 'AVERAGE_DATA'
  | 'SUPPLIER_SPECIFIC' | 'WASTE_TYPE_SPECIFIC' | 'MATERIAL_BASED' | 'HYBRID';
export type EmissionBasis = 'LOCATION_BASED' | 'MARKET_BASED' | 'SINGLE';
export type Gas = 'CO2' | 'CH4' | 'N2O' | 'HFC' | 'PFC' | 'SF6' | 'NF3' | 'CO2E_BLENDED';
export type RegionStrategy =
  | 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL' | 'SITE_GRID_ONLY' | 'FIXED_REGION' | 'GLOBAL_ONLY';

export interface CandidateFactor {
  id: string;
  scope: Scope;
  scope3Category?: number | null;
  activityType: ActivityType;
  method: CalcMethod;
  fuelOrMaterialCode: string;
  region: string;
  gas: Gas;
  basis: EmissionBasis;
  value: Decimal | string;
  unitNumerator: UnitCode;
  unitDenominator: UnitCode;
  validFrom: Date;
  validTo?: Date | null;
  sourceCitation: string;
  factorSetName: string;
  factorSetVersion: string;
}

export interface ResolveQuery {
  activityType: ActivityType;
  method: CalcMethod;
  fuelOrMaterialCode: string;
  basis?: EmissionBasis;
  regionStrategy: RegionStrategy;
  fixedRegion?: string | null;
  siteCountry: string;
  siteGridRegion?: string | null;
  /** the day the factor must be valid on */
  on: Date;
}

export class NoFactorError extends Error {
  readonly kind = 'BROKEN' as const;
  constructor(readonly query: ResolveQuery) {
    super(
      `No factor matches fuel=${query.fuelOrMaterialCode}, activity=${query.activityType}, ` +
        `method=${query.method}, region strategy=${query.regionStrategy} on ${query.on.toISOString().slice(0, 10)}. ` +
        `Add one in the Factor Lab, or change the region strategy.`,
    );
    this.name = 'NoFactorError';
  }
}

export class AmbiguousFactorError extends Error {
  readonly kind = 'AMBIGUOUS' as const;
  constructor(readonly matches: CandidateFactor[]) {
    super(
      `${matches.length} factors match equally well (${matches.map((m) => m.id).join(', ')}). ` +
        `Resolution must be deterministic — narrow the region or deactivate one factor set.`,
    );
    this.name = 'AmbiguousFactorError';
  }
}

/** Most specific region first. This order is the rule, not a heuristic. */
export function regionPreference(q: ResolveQuery): string[] {
  switch (q.regionStrategy) {
    case 'FIXED_REGION':
      return q.fixedRegion ? [q.fixedRegion] : [];
    case 'GLOBAL_ONLY':
      return ['GLOBAL'];
    case 'SITE_GRID_ONLY':
      return q.siteGridRegion ? [q.siteGridRegion] : [];
    case 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL':
    default:
      return [q.siteGridRegion, q.siteCountry, 'GLOBAL'].filter(Boolean) as string[];
  }
}

function validOn(f: CandidateFactor, on: Date): boolean {
  if (f.validFrom > on) return false;
  if (f.validTo && f.validTo < on) return false;
  return true;
}

export interface ResolveResult {
  factor: CandidateFactor;
  /** true when we fell back to a less specific region than was available in principle */
  usedFallbackRegion: boolean;
  regionMatched: string;
}

export function resolveFactor(candidates: readonly CandidateFactor[], q: ResolveQuery): ResolveResult {
  const base = candidates.filter(
    (f) =>
      f.activityType === q.activityType &&
      f.method === q.method &&
      f.fuelOrMaterialCode === q.fuelOrMaterialCode &&
      (q.basis ? f.basis === q.basis : true) &&
      validOn(f, q.on),
  );

  const prefs = regionPreference(q);
  for (let i = 0; i < prefs.length; i++) {
    const hits = base.filter((f) => f.region === prefs[i]);
    if (hits.length === 1) {
      return { factor: hits[0], usedFallbackRegion: i > 0, regionMatched: prefs[i] };
    }
    if (hits.length > 1) throw new AmbiguousFactorError(hits);
  }
  throw new NoFactorError(q);
}

export type BindingHealth = 'OK' | 'FALLBACK_REGION' | 'AMBIGUOUS' | 'BROKEN';

export interface HealthResult {
  health: BindingHealth;
  message: string | null;
}

/**
 * What the Builder's "Test binding" button runs, and what the nightly job recomputes.
 * A binding whose health is BROKEN or AMBIGUOUS cannot be published — the single rule
 * that stops a beautiful form silently recording zeros.
 */
export function checkBindingHealth(candidates: readonly CandidateFactor[], q: ResolveQuery): HealthResult {
  try {
    const r = resolveFactor(candidates, q);
    return r.usedFallbackRegion
      ? {
          health: 'FALLBACK_REGION',
          message: `Resolved via ${r.regionMatched}. A factor specific to ${q.siteCountry} would be better.`,
        }
      : { health: 'OK', message: null };
  } catch (e) {
    if (e instanceof AmbiguousFactorError) return { health: 'AMBIGUOUS', message: e.message };
    if (e instanceof NoFactorError) return { health: 'BROKEN', message: e.message };
    throw e;
  }
}

export function isPublishable(h: BindingHealth): boolean {
  return h === 'OK' || h === 'FALLBACK_REGION';
}

// ─────────────── mid-year factor changes ───────────────

export interface PeriodSlice {
  from: Date;
  to: Date;
  days: number;
  factor: CandidateFactor;
}

const DAY_MS = 86_400_000;
const dayCount = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;

/**
 * An activity spanning a factor change produces one EmissionRecord per factor,
 * weighted by days. See SPEC.md §5.5 — this is a correctness requirement, not a nicety.
 */
export function sliceByFactorValidity(
  candidates: readonly CandidateFactor[],
  q: Omit<ResolveQuery, 'on'>,
  activityStart: Date,
  activityEnd: Date,
): PeriodSlice[] {
  if (activityEnd < activityStart) throw new Error('activityEnd is before activityStart');

  const slices: PeriodSlice[] = [];
  let cursor = new Date(activityStart);

  while (cursor <= activityEnd) {
    const { factor } = resolveFactor(candidates, { ...q, on: cursor });
    // this factor applies until it expires or the activity ends, whichever comes first
    const expiry = factor.validTo ?? activityEnd;
    const sliceEnd = expiry < activityEnd ? expiry : activityEnd;
    slices.push({
      from: new Date(cursor),
      to: new Date(sliceEnd),
      days: dayCount(cursor, sliceEnd),
      factor,
    });
    cursor = new Date(sliceEnd.getTime() + DAY_MS);
  }
  return slices;
}
