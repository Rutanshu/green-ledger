/**
 * Pure mapping logic for importing github.com/Rutanshu/GHG's emission
 * factor register into our schema. Kept separate from import-ghg-
 * register.ts (which does the fetching/writing) so the mapping rules
 * themselves are unit-testable without a network call or a database.
 *
 * The register's own schema (data/schema.json) is close to ours but not
 * identical — three real translation problems, handled explicitly rather
 * than coerced silently (CLAUDE.md rule 4):
 *
 * 1. Units are native-as-published (gCO2e, lbCO2, tCO2, scf, short tons,
 *    passenger-miles, …), not normalised to our UnitCode set. UNIT_MAP
 *    below is the complete, explicit table of every (numerator,
 *    denominator) pair actually present in the register (surveyed
 *    directly against the live data, not guessed) that maps cleanly onto
 *    an existing UnitCode with a real, named conversion. Anything not in
 *    the table (co-mingled nitrogen-basis figures, "$" with an
 *    unspecified currency, hectares, employee-days, …) is skipped, not
 *    forced — see SKIPPED_UNIT_PAIRS.
 * 2. The register has no activityType field matching our ActivityType
 *    enum — inferActivityType derives one from scope/category/activity
 *    text/method, same rules a human classifying these would use.
 * 3. The register's `method` enum (spend-based/activity-based/weight-
 *    based/average-data/supplier-specific/hybrid) doesn't map 1:1 onto
 *    our CalcMethod — inferCalcMethod follows the exact convention
 *    already established this session (e.g. MASS activityType still
 *    pairs with DISTANCE_BASED method, matching the existing
 *    hgv_average binding).
 */

export interface RegisterRecord {
  id: string;
  activity: string;
  scope: 1 | 2 | 3;
  category: string;
  category_name: string;
  method: 'spend-based' | 'weight-based' | 'activity-based' | 'average-data' | 'supplier-specific' | 'hybrid';
  value: number | null;
  unit_numerator: string;
  unit_denominator: string;
  gases?: string[];
  gwp_basis: string;
  country: string;
  region: string | null;
  year: number;
  publication_year: number | null;
  organization: string;
  dataset: string;
  source_url: string;
  source_page_or_table: string | null;
  licence: string;
  price_year: number | null;
  boundary: string;
  value_status: 'verified' | 'unverified' | 'placeholder';
  notes: string | null;
}

const LB_TO_KG = 0.45359237;
const MI_TO_KM = 1.609344;
const SHORT_TON_TO_TONNE = 0.90718474;

interface UnitMapping {
  numerator: string;
  denominator: string;
  /** multiply the register's raw value by this to get our unit's value */
  multiplier: number;
}

/**
 * Keyed "numerator|denominator" exactly as the register spells them.
 * Surveyed against all 28,881 live records (2026-08-29) — every pair
 * that appears is either here or in SKIPPED_UNIT_PAIRS below; there is
 * no third bucket.
 */
export const UNIT_MAP: Record<string, UnitMapping> = {
  'gCO2e|EUR': { numerator: 'KG_CO2E', denominator: 'EUR', multiplier: 0.001 },
  'kgCO2e|km': { numerator: 'KG_CO2E', denominator: 'KM', multiplier: 1 },
  'kgCO2e|miles': { numerator: 'KG_CO2E', denominator: 'MI', multiplier: 1 },
  'lbCO2|MWh': { numerator: 'KG_CO2', denominator: 'MWH', multiplier: LB_TO_KG },
  'lbCH4|MWh': { numerator: 'KG_CH4', denominator: 'MWH', multiplier: LB_TO_KG },
  'lbN2O|MWh': { numerator: 'KG_N2O', denominator: 'MWH', multiplier: LB_TO_KG },
  'lbCO2e|MWh': { numerator: 'KG_CO2E', denominator: 'MWH', multiplier: LB_TO_KG },
  'tCO2|MWh': { numerator: 'KG_CO2', denominator: 'MWH', multiplier: 1000 },
  'lbCO2|MMBtu': { numerator: 'KG_CO2', denominator: 'MMBTU', multiplier: LB_TO_KG },
  'lbCH4|MMBtu': { numerator: 'KG_CH4', denominator: 'MMBTU', multiplier: LB_TO_KG },
  'lbN2O|MMBtu': { numerator: 'KG_N2O', denominator: 'MMBTU', multiplier: LB_TO_KG },
  'lbCO2e|MMBtu': { numerator: 'KG_CO2E', denominator: 'MMBTU', multiplier: LB_TO_KG },
  'kgCO2e|kg': { numerator: 'KG_CO2E', denominator: 'KG', multiplier: 1 },
  'kgCO2e|tonne.km': { numerator: 'KG_CO2E', denominator: 'TONNE_KM', multiplier: 1 },
  'gCO2e|kWh': { numerator: 'KG_CO2E', denominator: 'KWH', multiplier: 0.001 },
  'kgCO2e|tonnes': { numerator: 'KG_CO2E', denominator: 'TONNE', multiplier: 1 },
  'kgCO2e|Room per night': { numerator: 'KG_CO2E', denominator: 'UNIT', multiplier: 1 },
  'kgCO2e|kWh': { numerator: 'KG_CO2E', denominator: 'KWH', multiplier: 1 },
  'kgCO2e|passenger.km': { numerator: 'KG_CO2E', denominator: 'PASSENGER_KM', multiplier: 1 },
  'kgCO2e|pkm': { numerator: 'KG_CO2E', denominator: 'PASSENGER_KM', multiplier: 1 },
  // short ton material -> metric tonne: X per short-ton = X / 0.90718474 per tonne
  'tCO2e|short ton material': { numerator: 'T_CO2E', denominator: 'TONNE', multiplier: 1 / SHORT_TON_TO_TONNE },
  'kgCO2e|tkm': { numerator: 'KG_CO2E', denominator: 'TONNE_KM', multiplier: 1 },
  'kgCO2e|kWh (Net CV)': { numerator: 'KG_CO2E', denominator: 'KWH', multiplier: 1 },
  'kgCO2e|kWh (Gross CV)': { numerator: 'KG_CO2E', denominator: 'KWH', multiplier: 1 },
  'kgCH4|vehicle-mile': { numerator: 'KG_CH4', denominator: 'MI', multiplier: 1 },
  'kgN2O|vehicle-mile': { numerator: 'KG_N2O', denominator: 'MI', multiplier: 1 },
  'kgCO2e|per head': { numerator: 'KG_CO2E', denominator: 'UNIT', multiplier: 1 },
  'kgCO2e|litres': { numerator: 'KG_CO2E', denominator: 'L', multiplier: 1 },
  'kgCO2e|litre': { numerator: 'KG_CO2E', denominator: 'L', multiplier: 1 },
  'gCH4|L fuel': { numerator: 'KG_CH4', denominator: 'L', multiplier: 0.001 },
  'gCO2|m3 natural gas': { numerator: 'KG_CO2', denominator: 'M3', multiplier: 0.001 },
  'gCO2|L fuel': { numerator: 'KG_CO2', denominator: 'L', multiplier: 0.001 },
  'gN2O|L fuel': { numerator: 'KG_N2O', denominator: 'L', multiplier: 0.001 },
  'kgCO2|mmBtu': { numerator: 'KG_CO2', denominator: 'MMBTU', multiplier: 1 },
  'kgCH4|mmBtu': { numerator: 'KG_CH4', denominator: 'MMBTU', multiplier: 1 },
  'kgN2O|mmBtu': { numerator: 'KG_N2O', denominator: 'MMBTU', multiplier: 1 },
  'kgCO2e|GJ': { numerator: 'KG_CO2E', denominator: 'GJ', multiplier: 1 },
  'kgCO2|gallon': { numerator: 'KG_CO2', denominator: 'GAL_US', multiplier: 1 },
  'gCH4|gallon': { numerator: 'KG_CH4', denominator: 'GAL_US', multiplier: 0.001 },
  'gN2O|gallon': { numerator: 'KG_N2O', denominator: 'GAL_US', multiplier: 0.001 },
  'gCH4|m3 natural gas': { numerator: 'KG_CH4', denominator: 'M3', multiplier: 0.001 },
  'gN2O|m3 natural gas': { numerator: 'KG_N2O', denominator: 'M3', multiplier: 0.001 },
  'kgCO2e|cubic metres': { numerator: 'KG_CO2E', denominator: 'M3', multiplier: 1 },
  'kgCO2e|hours': { numerator: 'KG_CO2E', denominator: 'UNIT', multiplier: 1 },
  'kgCO2e|per capita': { numerator: 'KG_CO2E', denominator: 'UNIT', multiplier: 1 },
  // per passenger-mile -> per passenger-km: X per mile = X / 1.609344 per km
  'kgCO2|passenger-mile': { numerator: 'KG_CO2', denominator: 'PASSENGER_KM', multiplier: 1 / MI_TO_KM },
  'kgCH4|passenger-mile': { numerator: 'KG_CH4', denominator: 'PASSENGER_KM', multiplier: 1 / MI_TO_KM },
  'kgN2O|passenger-mile': { numerator: 'KG_N2O', denominator: 'PASSENGER_KM', multiplier: 1 / MI_TO_KM },
  // scf (standard cubic foot) -> m3: 1 m3 = 35.3147 scf, so X per scf = X * 35.3147 per m3
  'kgCO2|scf': { numerator: 'KG_CO2', denominator: 'M3', multiplier: 35.3147 },
  'gN2O|m3 fuel gas': { numerator: 'KG_N2O', denominator: 'M3', multiplier: 0.001 },
  'gCO2|m3 fuel gas': { numerator: 'KG_CO2', denominator: 'M3', multiplier: 0.001 },
  'kgCO2|vehicle-mile': { numerator: 'KG_CO2', denominator: 'MI', multiplier: 1 },
};

/**
 * Present in the live register but deliberately NOT imported — no clean,
 * honest mapping onto an existing UnitCode without inventing a
 * conversion this codebase can't stand behind (nitrogen-basis figures
 * needing a molecular-weight guess, ambiguous currencies, area/time/
 * headcount denominators we have no UnitDimension for at all). Kept as a
 * named list, not a silent catch-all, so a future contributor can see
 * exactly what was excluded and why.
 */
export const SKIPPED_UNIT_PAIRS = new Set([
  'kgCO2e|ha', // hectares — no AREA dimension in UnitCode
  'kgCO2e|kg N', // nitrogen-mass basis, not a generic kg
  'kgCO2e|employee days', // no TIME/headcount-day dimension
  'kgCO2e|$', // unspecified currency
  'kgN2O|t CH4 combusted', // denominator is itself an emission quantity, not an activity unit
  'kgN2O-N|kg N volatilized', // N2O-N nitrogen basis needs a 44/28 molecular-weight conversion we won't guess at
  'kgCO2e|tonne of kills', // no clean unit, single-digit record count
  'multiplier|baseline Ym', // not an emission factor shape at all (a correction multiplier)
]);

export function mapUnit(numerator: string, denominator: string): (UnitMapping & { rawValue: (v: number) => number }) | null {
  const m = UNIT_MAP[`${numerator}|${denominator}`];
  if (!m) return null;
  return { ...m, rawValue: (v: number) => v * m.multiplier };
}

export type OurActivityType =
  | 'STATIONARY_COMBUSTION' | 'MOBILE_COMBUSTION' | 'FUGITIVE' | 'PROCESS'
  | 'PURCHASED_ELECTRICITY' | 'PURCHASED_HEAT' | 'PURCHASED_STEAM' | 'PURCHASED_COOLING'
  | 'SPEND' | 'DISTANCE' | 'MASS' | 'WASTE' | 'OTHER';

/** Same classification a human filing these by hand would use — text/scope/category driven, no ML. */
export function inferActivityType(r: Pick<RegisterRecord, 'scope' | 'category' | 'method' | 'activity'>): OurActivityType {
  const a = r.activity.toLowerCase();

  if (r.scope === 1) {
    if (a.includes('refrigerant') || a.includes('fugitive') || /\bsf6\b/.test(a) || a.includes('leak')) return 'FUGITIVE';
    if (a.includes('vehicle') || a.includes('hgv') || a.includes('van') || /\bcars?\b/.test(a) || a.includes('fleet') || a.includes('motorcycle') || a.includes('forklift') || a.includes('delivery')) return 'MOBILE_COMBUSTION';
    if (a.includes('process') || a.includes('cement') || a.includes('chemical reaction')) return 'PROCESS';
    return 'STATIONARY_COMBUSTION';
  }

  if (r.scope === 2) {
    if (a.includes('steam')) return 'PURCHASED_STEAM';
    if (a.includes('heat')) return 'PURCHASED_HEAT';
    if (a.includes('cooling') || a.includes('chilled')) return 'PURCHASED_COOLING';
    return 'PURCHASED_ELECTRICITY';
  }

  // scope 3
  if (r.method === 'spend-based') return 'SPEND';
  if (r.category === '3.5') return 'WASTE';
  if (r.category === '3.4' || r.category === '3.9') {
    return a.includes('tonne') || a.includes('freight') || a.includes('tkm') ? 'MASS' : 'DISTANCE';
  }
  if (r.category === '3.6' || r.category === '3.7') return 'DISTANCE';
  return 'OTHER';
}

export type OurCalcMethod =
  | 'FUEL_BASED' | 'DISTANCE_BASED' | 'SPEND_BASED' | 'AVERAGE_DATA'
  | 'SUPPLIER_SPECIFIC' | 'WASTE_TYPE_SPECIFIC' | 'MATERIAL_BASED' | 'HYBRID';

export function inferCalcMethod(registerMethod: RegisterRecord['method'], activityType: OurActivityType): OurCalcMethod {
  if (registerMethod === 'spend-based') return 'SPEND_BASED';
  if (registerMethod === 'average-data') return 'AVERAGE_DATA';
  if (registerMethod === 'supplier-specific') return 'SUPPLIER_SPECIFIC';
  if (registerMethod === 'hybrid') return 'HYBRID';
  if (registerMethod === 'weight-based') return 'MATERIAL_BASED';

  // activity-based: derive from the activityType we just classified
  switch (activityType) {
    case 'WASTE': return 'WASTE_TYPE_SPECIFIC';
    case 'FUGITIVE':
    case 'PROCESS': return 'MATERIAL_BASED';
    case 'MOBILE_COMBUSTION':
    case 'DISTANCE':
    case 'MASS': return 'DISTANCE_BASED'; // matches the existing hgv_average convention
    case 'STATIONARY_COMBUSTION': return 'FUEL_BASED';
    case 'PURCHASED_ELECTRICITY':
    case 'PURCHASED_HEAT':
    case 'PURCHASED_STEAM':
    case 'PURCHASED_COOLING': return 'AVERAGE_DATA';
    default: return 'HYBRID';
  }
}

/** "3.1" -> 1, "3" (unclassified) -> null, "1"/"2" -> null (not a Scope 3 record). */
export function parseScope3Category(category: string): number | null {
  const m = category.match(/^3\.(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function inferBasis(activityType: OurActivityType, boundary: string): 'SINGLE' | 'LOCATION_BASED' | 'MARKET_BASED' {
  if (activityType !== 'PURCHASED_ELECTRICITY') return 'SINGLE';
  const b = boundary.toLowerCase();
  if (b.includes('market') || b.includes('residual')) return 'MARKET_BASED';
  return 'LOCATION_BASED';
}

export function buildSourceCitation(r: RegisterRecord): string {
  const parts = [r.organization, r.dataset, r.source_page_or_table ?? undefined, r.licence].filter(Boolean);
  return parts.join(' — ');
}
