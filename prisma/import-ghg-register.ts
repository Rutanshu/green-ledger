/**
 * Imports github.com/Rutanshu/GHG's real, cited, verified emission
 * factor register (28,881 records, 8 government/research datasets) into
 * EmissionFactorSet/EmissionFactor. Replaces the procedurally-generated
 * "Extended Reference Library" removed earlier this session — this is
 * real, individually-sourced data, not derived values.
 *
 * Field mapping lives in src/lib/ghgRegister/mapping.ts (unit-tested
 * separately, since that's where the actual judgment calls are — unit
 * normalisation, activityType/CalcMethod inference). This script is
 * just: fetch, map, filter what doesn't map cleanly, insert.
 *
 * Every register record's `id` is already a unique, stable, kebab-case
 * string used directly as fuelOrMaterialCode — so unlike the bulk
 * reference library this replaces, no two register-derived rows can
 * ever share a resolveFactor match key with each other (each row's own
 * id is its own key), and collision with a real curated code (short
 * strings like "diesel") is not realistically possible. Still asserted,
 * not assumed.
 *
 * Run with: npx tsx prisma/import-ghg-register.ts
 */
import { adminPrisma } from '../src/lib/db/admin-client';
import { mapUnit, inferActivityType, inferCalcMethod, parseScope3Category, inferBasis, buildSourceCitation, type RegisterRecord } from '../src/lib/ghgRegister/mapping';

const prisma = adminPrisma;

const REGISTER_BASE = 'https://raw.githubusercontent.com/Rutanshu/GHG/main';

const DATASETS = [
  { file: 'defra-2025', publisher: 'DEFRA', name: 'UK GHG Conversion Factors 2025', version: '2025', regionScope: 'GB' },
  { file: 'epa-hub-2025', publisher: 'EPA', name: 'US EPA GHG Emission Factors Hub', version: '2025', regionScope: 'US' },
  { file: 'epa-egrid-2023', publisher: 'EPA', name: 'US EPA eGRID2023 (rev2)', version: '2023', regionScope: 'US' },
  { file: 'nz-mfe-2026', publisher: 'NZ_MFE', name: 'NZ Ministry for the Environment — Measuring Emissions 2026', version: '2026', regionScope: 'NZ' },
  { file: 'cea-india-2025', publisher: 'CEA_INDIA', name: 'India CEA CO2 Baseline Database v21.0', version: 'v21.0', regionScope: 'IN' },
  { file: 'eccc-canada-2026', publisher: 'ECCC_CANADA', name: 'Canada ECCC Federal GHG Offset System Factors', version: '2026', regionScope: 'CA' },
  { file: 'eurostat-2024', publisher: 'EUROSTAT', name: 'Eurostat/EEA GHG Intensity by NACE Sector', version: '2024', regionScope: 'EU' },
  { file: 'ember-electricity-2024', publisher: 'EMBER', name: 'Ember Yearly Electricity Data', version: '2024', regionScope: 'GLOBAL' },
] as const;

// Every real, live-bound fuelOrMaterialCode in the system today — see
// prior backfill scripts for the same list. Register ids never collide
// with these in practice (long kebab-case vs short words) but asserted,
// not assumed.
const PROTECTED_CODES = new Set([
  'diesel', 'natural_gas', 'furnace_oil', 'lpg', 'r410a', 'r32', 'solvent_voc',
  'grid_electricity', 'waste_landfill_mixed', 'waste_recycled_mixed', 'air_short_haul',
  'rail_national', 'hgv_average', 'raw_materials', 'capital_goods', 'diesel_wtt',
  'electricity_td_losses', 'average_car_commute', 'leased_assets', 'processing_sold_products',
  'use_of_sold_products', 'franchise_operations', 'investments', 'cleaning_services',
]);

async function fetchDataset(file: string): Promise<RegisterRecord[]> {
  const res = await fetch(`${REGISTER_BASE}/data/factors/${file}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${file}.json: ${res.status} ${res.statusText}`);
  return res.json();
}

interface Row {
  factorSetKey: string;
  scope: 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';
  scope3Category: number | null;
  activityType: string;
  method: string;
  fuelOrMaterialCode: string;
  region: string;
  basis: 'SINGLE' | 'LOCATION_BASED' | 'MARKET_BASED';
  value: string;
  unitNumerator: string;
  unitDenominator: string;
  validFrom: Date;
  sourceCitation: string;
}

async function main() {
  console.log('Fetching 8 datasets from github.com/Rutanshu/GHG…');
  const allRows: Row[] = [];
  const skippedByReason: Record<string, number> = {};

  for (const ds of DATASETS) {
    const records = await fetchDataset(ds.file);
    let kept = 0;
    for (const r of records) {
      if (r.value_status !== 'verified' || r.value === null) {
        skippedByReason['not verified / null value'] = (skippedByReason['not verified / null value'] ?? 0) + 1;
        continue;
      }
      const unit = mapUnit(r.unit_numerator, r.unit_denominator);
      if (!unit) {
        const key = `${r.unit_numerator}|${r.unit_denominator}`;
        skippedByReason[`no unit mapping (${key})`] = (skippedByReason[`no unit mapping (${key})`] ?? 0) + 1;
        continue;
      }
      if (PROTECTED_CODES.has(r.id)) {
        throw new Error(`Register id "${r.id}" collides with a real, live-bound fuelOrMaterialCode. Aborting before any write.`);
      }

      const activityType = inferActivityType(r);
      const method = inferCalcMethod(r.method, activityType);
      const basis = inferBasis(activityType, r.boundary);

      allRows.push({
        factorSetKey: ds.file,
        scope: `SCOPE_${r.scope}` as Row['scope'],
        scope3Category: parseScope3Category(r.category),
        activityType,
        method,
        fuelOrMaterialCode: r.id,
        region: r.region ?? r.country,
        basis,
        value: unit.rawValue(r.value).toString(),
        unitNumerator: unit.numerator,
        unitDenominator: unit.denominator,
        validFrom: new Date(`${r.year}-01-01`),
        sourceCitation: buildSourceCitation(r),
      });
      kept++;
    }
    console.log(`  ${ds.file}: ${kept} / ${records.length} imported`);
  }

  console.log(`\nTotal rows to insert: ${allRows.length}`);
  console.log('Skipped:');
  for (const [reason, count] of Object.entries(skippedByReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toLocaleString().padStart(6)}  ${reason}`);
  }

  // Duplicate-key check: every id is already unique per the register's
  // own schema, but assert it rather than assume it (two datasets could
  // theoretically reuse an id, however unlikely).
  const seen = new Set<string>();
  for (const row of allRows) {
    if (seen.has(row.fuelOrMaterialCode)) {
      throw new Error(`Duplicate register id "${row.fuelOrMaterialCode}" across datasets. Aborting before any write.`);
    }
    seen.add(row.fuelOrMaterialCode);
  }

  const setIds: Record<string, string> = {};
  for (const ds of DATASETS) {
    let set = await prisma.emissionFactorSet.findFirst({
      where: { organizationId: null, publisher: ds.publisher, name: ds.name, version: ds.version },
    });
    if (!set) {
      set = await prisma.emissionFactorSet.create({
        data: {
          organizationId: null,
          publisher: ds.publisher,
          name: ds.name,
          version: ds.version,
          publishedOn: new Date(`${ds.version.match(/\d{4}/)?.[0] ?? '2025'}-01-01`),
          regionScope: ds.regionScope,
          licence: 'See per-record citation — each publisher licenses its own data',
          sourceUrl: 'https://github.com/Rutanshu/GHG',
        },
      });
      console.log(`Created factor set: ${ds.publisher} — ${ds.name}`);
    }
    setIds[ds.file] = set.id;
    const existingCount = await prisma.emissionFactor.count({ where: { factorSetId: set.id } });
    if (existingCount > 0) {
      console.log(`${ds.name} already has ${existingCount} factors — skipping (this script only runs once per set).`);
      delete setIds[ds.file];
    }
  }

  const toInsert = allRows.filter((r) => setIds[r.factorSetKey]);
  const BATCH_SIZE = 2000;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE).map((r) => ({
      factorSetId: setIds[r.factorSetKey],
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
      sourceCitation: r.sourceCitation,
    }));
    await prisma.emissionFactor.createMany({ data: batch });
    inserted += batch.length;
    console.log(`  inserted ${inserted} / ${toInsert.length}`);
  }

  console.log(`\nDone. ${inserted} real, cited emission factors inserted.`);
  const total = await prisma.emissionFactor.count();
  console.log(`Total EmissionFactor rows in the system now: ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
