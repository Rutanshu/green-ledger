/**
 * Adds a large, structured reference factor library — DEFRA-style and
 * EPA-style, spanning real fuel/vehicle/waste/refrigerant/region taxonomy
 * crossed with multi-year vintages — so the platform holds a
 * production-realistic volume of emission factors (20,000+), not just
 * the ~35 curated rows actually bound to the demo questionnaire.
 *
 * HONESTY NOTE, read before trusting any one row for a real disclosure:
 * these values are procedurally derived (a family base intensity plus a
 * small deterministic year-over-year drift), not transcribed line-by-line
 * from the live DEFRA/EPA published tables the way the curated ~35 rows
 * in seed-data.ts are (those stay real, cited, and covered by
 * seed-integrity.test.ts — this script never touches them). Every row's
 * sourceCitation says so explicitly. This is a demo/scale reference
 * library: the right order of magnitude, the right taxonomy, the right
 * shape — not a substitute for the published tables in a real report.
 *
 * Lives in its own two EmissionFactorSet rows (publisher DEFRA / EPA,
 * name "... — Extended Reference Library"), kept apart from the curated
 * sets so the Factor Lab can tell "what's actually bound to a question"
 * from "what's available in the wider library" at a glance.
 *
 * A resolveFactor() match is keyed on (fuel, activityType, method, region,
 * basis) plus a validOn(date) check — never on unitDenominator. So EVERY
 * row here uses exactly one canonical unit per key (no "same fuel, two
 * units" rows — that would be genuinely ambiguous, not just a style
 * choice), and every year-vintage uses yearWindow() from
 * bulk-factor-taxonomy.ts so consecutive years get non-overlapping
 * validFrom/validTo windows instead of all staying valid forever and
 * colliding by the time they reach the present day.
 *
 * Safe against ambiguity: every fuelOrMaterialCode generated here is
 * checked against PROTECTED_CODES (every code any live FactorBinding
 * actually resolves against) and the full (fuel, activityType, method,
 * region, basis) + validity window is asserted non-overlapping within
 * this run before a single row is written — see assertNoCollisions().
 * Run again safely; it no-ops if the two bulk sets already have rows.
 *
 * Run with: npx tsx prisma/backfill-bulk-factor-library.ts
 */
import { adminPrisma } from '../src/lib/db/admin-client';
import * as T from './bulk-factor-taxonomy';

const prisma = adminPrisma;

// Every fuelOrMaterialCode a real FactorBinding in this system resolves
// against today (see seed-data.ts DEFRA_2026/EPA_2026/GRID_2026 + the
// Scope 3 expansion) — none of these may ever be emitted by this script.
const PROTECTED_CODES = new Set([
  'diesel', 'natural_gas', 'furnace_oil', 'lpg', 'r410a', 'r32', 'solvent_voc',
  'grid_electricity', 'waste_landfill_mixed', 'waste_recycled_mixed', 'air_short_haul',
  'rail_national', 'hgv_average', 'raw_materials', 'capital_goods', 'diesel_wtt',
  'electricity_td_losses', 'average_car_commute', 'leased_assets', 'processing_sold_products',
  'use_of_sold_products', 'franchise_operations', 'investments', 'cleaning_services',
]);

interface Row {
  set: 'DEFRA_BULK' | 'EPA_BULK';
  scope: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  scope3Category: number | null;
  activityType: string;
  method: string;
  fuelOrMaterialCode: string;
  region: string;
  basis: 'SINGLE' | 'LOCATION_BASED' | 'MARKET_BASED';
  value: string;
  unitNumerator: 'KG_CO2E';
  unitDenominator: string;
  validFrom: Date;
  validTo: Date | null;
  sourceCitation: string;
}

const CITE = (category: string) =>
  `Bulk reference library — ${category} — procedurally structured on published methodology; not individually verified against the current table. See prisma/backfill-bulk-factor-library.ts.`;

const round5 = (n: number) => Math.max(n, 0.00001).toFixed(5);
const drift = (baseValue: number, year: number, ratePerYear: number, baseYear = 2020) =>
  round5(baseValue * (1 + ratePerYear * (year - baseYear)));

const rows: Row[] = [];

// ─────────────────────────── 1. stationary combustion ───────────────────────────
// One canonical unit per fuel (the first in its `units` list) — see the
// file header on why a second unit variant can't be a second row.
for (const fuel of T.STATIONARY_FUELS) {
  const base = T.FAMILY_BASE[fuel.family];
  const unit = fuel.units[0];
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_1', scope3Category: null,
      activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED',
      fuelOrMaterialCode: fuel.code, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(base[unit], year, 0.003),
      unitNumerator: 'KG_CO2E', unitDenominator: unit,
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(`Stationary combustion — ${fuel.name}`),
    });
  }
}

// ─────────────────────────── 2. well-to-tank (Scope 3 cat 3) ───────────────────────────
for (const fuel of T.STATIONARY_FUELS) {
  const base = T.FAMILY_BASE[fuel.family];
  const unit = fuel.units[0];
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 3,
      activityType: 'OTHER', method: 'FUEL_BASED',
      fuelOrMaterialCode: `${fuel.code}_wtt_bulk`, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(base[unit] * 0.22, year, 0.004),
      unitNumerator: 'KG_CO2E', unitDenominator: unit,
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(`Well-to-tank — ${fuel.name}`),
    });
  }
}

// ─────────────────────────── 3. mobile combustion (passenger vehicles) ───────────────────────────
for (const size of T.VEHICLE_SIZES) {
  for (const fuel of T.VEHICLE_FUELS) {
    const carBase = fuel === 'battery_electric' ? 0 : fuel === 'hybrid' || fuel === 'plug_in_hybrid' ? 0.09 : fuel === 'diesel' ? 0.168 : 0.155;
    const sizeMult = size === 'small' ? 0.8 : size === 'large' ? 1.35 : 1.0;
    for (const year of T.YEARS_DEFRA) {
      const w = T.yearWindow(T.YEARS_DEFRA, year);
      rows.push({
        set: 'DEFRA_BULK', scope: 'SCOPE_1', scope3Category: null,
        activityType: 'MOBILE_COMBUSTION', method: 'DISTANCE_BASED',
        fuelOrMaterialCode: `car_${size}_${fuel}`, region: 'GLOBAL', basis: 'SINGLE',
        value: drift(carBase * sizeMult, year, -0.006), // efficiency improves YoY
        unitNumerator: 'KG_CO2E', unitDenominator: 'KM',
        validFrom: w.validFrom, validTo: w.validTo,
        sourceCitation: CITE(`Mobile combustion — ${size} car, ${fuel.replaceAll('_', ' ')}`),
      });
    }
  }
}

// ─────────────────────────── 4. freight ───────────────────────────
const freightRows: { code: string; base: number; label: string }[] = [
  ...T.HGV_RIGID_WEIGHTS.flatMap((wt) => T.LADEN_BANDS.map((l) => ({ code: `hgv_rigid_${wt}_${l}`, base: 0.35, label: `HGV rigid ${wt}, ${l} laden` }))),
  ...T.HGV_ARTIC_WEIGHTS.flatMap((wt) => T.LADEN_BANDS.map((l) => ({ code: `hgv_artic_${wt}_${l}`, base: 0.12, label: `HGV articulated ${wt}, ${l} laden` }))),
  ...T.SEA_FREIGHT_CLASSES.map((c) => ({ code: `sea_freight_${c}`, base: 0.012, label: `Sea freight — ${c.replaceAll('_', ' ')}` })),
  ...T.AIR_FREIGHT_HAUL.map((h) => ({ code: `air_freight_${h}`, base: 0.6, label: `Air freight — ${h.replaceAll('_', ' ')}` })),
];
for (const f of freightRows) {
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 4,
      activityType: 'MASS', method: 'DISTANCE_BASED',
      fuelOrMaterialCode: f.code, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(f.base, year, 0.002),
      unitNumerator: 'KG_CO2E', unitDenominator: 'TONNE_KM',
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(f.label),
    });
  }
}

// ─────────────────────────── 5. passenger transport (non-vehicle) ───────────────────────────
const passengerRows: { code: string; base: number; label: string; cat: number }[] = [
  ...T.RAIL_MODES.map((m) => ({ code: `rail_${m}`, base: 0.041, label: `Rail — ${m.replaceAll('_', ' ')}`, cat: 6 })),
  ...T.AIR_HAUL.flatMap((h) => T.AIR_CLASS.map((c) => ({ code: `air_${h}_${c}`, base: h === 'long_haul' ? 0.19 : h === 'short_haul' ? 0.156 : 0.24, label: `Air — ${h.replaceAll('_', ' ')}, ${c}`, cat: 6 }))),
  ...T.SEA_PASSENGER.map((m) => ({ code: `sea_passenger_${m}`, base: 0.11, label: `Sea passenger — ${m.replaceAll('_', ' ')}`, cat: 6 })),
  ...T.BUS_TYPES.map((m) => ({ code: `bus_${m}`, base: 0.1, label: `Bus — ${m.replaceAll('_', ' ')}`, cat: 6 })),
];
for (const p of passengerRows) {
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: p.cat,
      activityType: 'DISTANCE', method: 'DISTANCE_BASED',
      fuelOrMaterialCode: p.code, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(p.base, year, 0.001),
      unitNumerator: 'KG_CO2E', unitDenominator: 'PASSENGER_KM',
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(p.label),
    });
  }
}

// ─────────────────────────── 6. refrigerants / fugitive ───────────────────────────
// Two non-overlapping GWP vintages, not a live year series — AR5 covers
// up to end-2021, AR6 takes over from 2022 with no expiry (current).
for (const gas of T.REFRIGERANTS) {
  rows.push({
    set: 'DEFRA_BULK', scope: 'SCOPE_1', scope3Category: null,
    activityType: 'FUGITIVE', method: 'MATERIAL_BASED',
    fuelOrMaterialCode: gas.code, region: 'GLOBAL', basis: 'SINGLE',
    value: round5(Math.max(gas.approxGwp100 * 0.97, 0.001)),
    unitNumerator: 'KG_CO2E', unitDenominator: 'KG',
    validFrom: new Date('2015-01-01'), validTo: new Date('2021-12-31'),
    sourceCitation: CITE(`Refrigerant GWP — ${gas.label} (AR5)`),
  });
  rows.push({
    set: 'DEFRA_BULK', scope: 'SCOPE_1', scope3Category: null,
    activityType: 'FUGITIVE', method: 'MATERIAL_BASED',
    fuelOrMaterialCode: gas.code, region: 'GLOBAL', basis: 'SINGLE',
    value: round5(Math.max(gas.approxGwp100, 0.001)),
    unitNumerator: 'KG_CO2E', unitDenominator: 'KG',
    validFrom: new Date('2022-01-01'), validTo: null,
    sourceCitation: CITE(`Refrigerant GWP — ${gas.label} (AR6)`),
  });
}

// ─────────────────────────── 7. waste ───────────────────────────
for (const material of T.WASTE_BASE_MATERIALS) {
  for (const method of T.WASTE_DISPOSAL_METHODS) {
    for (const year of T.YEARS_DEFRA) {
      const w = T.yearWindow(T.YEARS_DEFRA, year);
      rows.push({
        set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 5,
        activityType: 'WASTE', method: 'WASTE_TYPE_SPECIFIC',
        fuelOrMaterialCode: `${material}__${method.code}`, region: 'GLOBAL', basis: 'SINGLE',
        value: drift(0.5 * method.factor, year, -0.002),
        unitNumerator: 'KG_CO2E', unitDenominator: 'KG',
        validFrom: w.validFrom, validTo: w.validTo,
        sourceCitation: CITE(`Waste — ${material.replaceAll('_', ' ')}, ${method.label}`),
      });
    }
  }
}

// ─────────────────────────── 8. hotel stay ───────────────────────────
for (const country of T.HOTEL_COUNTRIES) {
  for (const star of T.STAR_RATINGS) {
    const starMult = star === '5_star' ? 1.6 : star === '4_star' ? 1.25 : 1.0;
    for (const year of T.YEARS_DEFRA) {
      const w = T.yearWindow(T.YEARS_DEFRA, year);
      rows.push({
        set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 6,
        activityType: 'OTHER', method: 'AVERAGE_DATA',
        fuelOrMaterialCode: `hotel_${country}_${star}`, region: country, basis: 'SINGLE',
        value: drift(12 * starMult, year, -0.003),
        unitNumerator: 'KG_CO2E', unitDenominator: 'UNIT',
        validFrom: w.validFrom, validTo: w.validTo,
        sourceCitation: CITE(`Hotel stay (per room-night) — ${country}, ${star.replace('_', '-')}`),
      });
    }
  }
}

// ─────────────────────────── 9. homeworking ───────────────────────────
for (const profile of ['electricity_only_small_home', 'electricity_only_large_home', 'electricity_and_heating_small_home', 'electricity_and_heating_large_home']) {
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 7,
      activityType: 'OTHER', method: 'AVERAGE_DATA',
      fuelOrMaterialCode: `homeworking_${profile}`, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(profile.includes('heating') ? 0.9 : 0.32, year, -0.004),
      unitNumerator: 'KG_CO2E', unitDenominator: 'UNIT',
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(`Homeworking (per working day) — ${profile.replaceAll('_', ' ')}`),
    });
  }
}

// ─────────────────────────── 10. water supply & treatment ───────────────────────────
for (const activity of ['water_supply', 'water_treatment']) {
  for (const year of T.YEARS_DEFRA) {
    const w = T.yearWindow(T.YEARS_DEFRA, year);
    rows.push({
      set: 'DEFRA_BULK', scope: 'SCOPE_3', scope3Category: 1,
      activityType: 'OTHER', method: 'AVERAGE_DATA',
      fuelOrMaterialCode: activity, region: 'GLOBAL', basis: 'SINGLE',
      value: drift(activity === 'water_treatment' ? 0.7 : 0.3, year, 0.001),
      unitNumerator: 'KG_CO2E', unitDenominator: 'M3',
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(`${activity.replaceAll('_', ' ')}`),
    });
  }
}

// ─────────────────────────── 11. EEIO-style spend sectors (DEFRA=GBP, EPA=USD) ───────────────────────────
for (const sector of T.EEIO_SECTORS) {
  for (const [set, currency, region] of [['DEFRA_BULK', 'GBP', 'GB'], ['EPA_BULK', 'USD', 'US']] as const) {
    for (const year of T.YEARS_DEFRA) {
      const w = T.yearWindow(T.YEARS_DEFRA, year);
      rows.push({
        set, scope: 'SCOPE_3', scope3Category: 1,
        activityType: 'SPEND', method: 'SPEND_BASED',
        fuelOrMaterialCode: `eeio_${sector.code}`, region, basis: 'SINGLE',
        value: drift(0.28, year, -0.001),
        unitNumerator: 'KG_CO2E', unitDenominator: currency,
        validFrom: w.validFrom, validTo: w.validTo,
        sourceCitation: CITE(`EEIO spend-based — ${sector.label}`),
      });
    }
  }
}

// ─────────────────────────── 12. eGRID subregions (EPA) ───────────────────────────
for (const subregion of T.EGRID_SUBREGIONS) {
  for (const year of T.YEARS_EGRID) {
    const w = T.yearWindow(T.YEARS_EGRID, year);
    rows.push({
      set: 'EPA_BULK', scope: 'SCOPE_2', scope3Category: null,
      activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA',
      fuelOrMaterialCode: `grid_electricity_egrid`, region: subregion, basis: 'LOCATION_BASED',
      value: drift(0.42, year, -0.014), // US grid intensity has been declining steadily
      unitNumerator: 'KG_CO2E', unitDenominator: 'KWH',
      validFrom: w.validFrom, validTo: w.validTo,
      sourceCitation: CITE(`eGRID subregion — ${subregion}`),
    });
  }
}

// ─────────────────────────── 13. US mobile combustion by vehicle/fuel ───────────────────────────
for (const vehicle of T.US_VEHICLE_TYPES) {
  for (const fuel of (['gasoline', 'diesel', 'e85_flex_fuel', 'cng'] as const)) {
    const base = vehicle === 'heavy_truck' ? 10.1 : vehicle === 'transit_bus' ? 10.4 : fuel === 'diesel' ? 10.2 : 8.9;
    for (const year of T.YEARS_DEFRA) {
      const w = T.yearWindow(T.YEARS_DEFRA, year);
      rows.push({
        set: 'EPA_BULK', scope: 'SCOPE_1', scope3Category: null,
        activityType: 'MOBILE_COMBUSTION', method: 'FUEL_BASED',
        fuelOrMaterialCode: `us_${vehicle}_${fuel}`, region: 'US', basis: 'SINGLE',
        value: drift(base, year, -0.002),
        unitNumerator: 'KG_CO2E', unitDenominator: fuel === 'cng' ? 'KG' : 'GAL_US',
        validFrom: w.validFrom, validTo: w.validTo,
        sourceCitation: CITE(`EPA-style mobile combustion — ${vehicle.replaceAll('_', ' ')}, ${fuel.replaceAll('_', ' ')}`),
      });
    }
  }
}

function overlaps(aFrom: Date, aTo: Date | null, bFrom: Date, bTo: Date | null): boolean {
  const aEnd = aTo ?? new Date('9999-12-31');
  const bEnd = bTo ?? new Date('9999-12-31');
  return aFrom <= bEnd && bFrom <= aEnd;
}

function assertNoCollisions() {
  for (const r of rows) {
    if (PROTECTED_CODES.has(r.fuelOrMaterialCode)) {
      throw new Error(`Generated code "${r.fuelOrMaterialCode}" collides with a real, live-bound fuelOrMaterialCode. Aborting before any write.`);
    }
  }
  // Group by the exact resolveFactor match key (everything except validity),
  // then check every pair within a group for an overlapping window — this
  // is the real ambiguity test, not just an exact-duplicate check.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.fuelOrMaterialCode}|${r.activityType}|${r.method}|${r.region}|${r.basis}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
    for (let i = 1; i < sorted.length; i++) {
      if (overlaps(sorted[i - 1].validFrom, sorted[i - 1].validTo, sorted[i].validFrom, sorted[i].validTo)) {
        throw new Error(`Overlapping validity for key "${key}": ${sorted[i - 1].validFrom.toISOString()}..${sorted[i - 1].validTo?.toISOString() ?? 'open'} vs ${sorted[i].validFrom.toISOString()}..${sorted[i].validTo?.toISOString() ?? 'open'}. Aborting before any write.`);
      }
    }
  }
}

async function main() {
  assertNoCollisions();
  console.log(`Generated ${rows.length} candidate rows (DEFRA_BULK: ${rows.filter((r) => r.set === 'DEFRA_BULK').length}, EPA_BULK: ${rows.filter((r) => r.set === 'EPA_BULK').length}).`);

  const setDefs = {
    DEFRA_BULK: {
      publisher: 'DEFRA', name: 'DEFRA — Extended Reference Library', version: '2026-bulk-v1',
      publishedOn: new Date('2026-01-01'), regionScope: 'GLOBAL', licence: 'Open Government Licence v3.0 (structure only)',
      sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
    },
    EPA_BULK: {
      publisher: 'EPA', name: 'EPA — Extended Reference Library', version: '2026-bulk-v1',
      publishedOn: new Date('2026-01-01'), regionScope: 'US', licence: 'US Government Work (public domain, structure only)',
      sourceUrl: 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
    },
  } as const;

  const setIds: Record<'DEFRA_BULK' | 'EPA_BULK', string> = { DEFRA_BULK: '', EPA_BULK: '' };
  for (const key of ['DEFRA_BULK', 'EPA_BULK'] as const) {
    const def = setDefs[key];
    let set = await prisma.emissionFactorSet.findFirst({ where: { organizationId: null, publisher: def.publisher, name: def.name, version: def.version } });
    if (!set) {
      set = await prisma.emissionFactorSet.create({ data: { organizationId: null, ...def } });
      console.log(`Created factor set: ${def.name}`);
    }
    setIds[key] = set.id;
    const existingCount = await prisma.emissionFactor.count({ where: { factorSetId: set.id } });
    if (existingCount > 0) {
      console.log(`${def.name} already has ${existingCount} factors. Skipping — this script only runs once.`);
      return;
    }
  }

  const BATCH_SIZE = 2000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
      factorSetId: setIds[r.set],
      scope: r.scope as never,
      scope3Category: r.scope3Category,
      activityType: r.activityType as never,
      method: r.method as never,
      fuelOrMaterialCode: r.fuelOrMaterialCode,
      region: r.region,
      basis: r.basis as never,
      value: r.value,
      unitNumerator: r.unitNumerator as never,
      unitDenominator: r.unitDenominator as never,
      validFrom: r.validFrom,
      validTo: r.validTo,
      sourceCitation: r.sourceCitation,
    }));
    await prisma.emissionFactor.createMany({ data: batch });
    inserted += batch.length;
    console.log(`  inserted ${inserted} / ${rows.length}`);
  }

  console.log(`\nDone. ${inserted} bulk reference factors inserted across 2 factor sets.`);
  const totalFactors = await prisma.emissionFactor.count();
  console.log(`Total EmissionFactor rows in the system now: ${totalFactors}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
