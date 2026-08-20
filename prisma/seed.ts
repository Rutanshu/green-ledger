/**
 * Runnable seed. Writes the content in seed-data.ts into the database.
 *
 * Binding health is not hardcoded — it's computed with the real
 * checkBindingHealth() from lib/factors, against the factors this script
 * just created. If the demo data changes and a binding breaks, the seed
 * output changes with it instead of silently going stale.
 */
import { PrismaClient } from '../src/generated/prisma';
import {
  checkBindingHealth,
  type CandidateFactor,
  type BindingHealth,
} from '../src/lib/factors';
import { computeCompleteness, type VisibilityRule } from '../src/lib/visibility';
import {
  GWP_AR6,
  ASSET_TYPES,
  SITE_TYPES,
  DEFRA_2026,
  GRID_2026,
  DEMO_SITES,
  DEMO_ASSETS,
  DEMO_LABELS,
  DEMO_DENOMINATORS,
  DEMO_TEMPLATE,
  DEMO_ANSWERS,
} from './seed-data';

const prisma = new PrismaClient();

const HEALTH_RANK: Record<BindingHealth, number> = {
  OK: 0,
  FALLBACK_REGION: 1,
  AMBIGUOUS: 2,
  BROKEN: 3,
};

const FUEL_OR_MATERIAL_LABELS: Record<string, string> = {
  diesel: 'Diesel',
  natural_gas: 'Natural gas',
  furnace_oil: 'Furnace oil',
  lpg: 'LPG',
  r410a: 'R-410A',
  r32: 'R-32',
  solvent_voc: 'Solvent (VOC)',
  grid_electricity: 'Grid electricity',
  waste_landfill_mixed: 'Mixed waste to landfill',
  waste_recycled_mixed: 'Mixed waste recycled',
  air_short_haul: 'Short-haul air travel',
  rail_national: 'National rail travel',
  hgv_average: 'HGV freight (average)',
  raw_materials: 'Raw materials',
  cleaning_services: 'Contract cleaning services',
};

/**
 * Realistic follow-up work tied to real broken bindings and a real
 * not-started site — not invented numbers, just Task rows pointing at
 * entities that already exist. Idempotent: skips if any tasks exist.
 */
async function ensureTasks(orgId: string) {
  const existingCount = await prisma.task.count({ where: { organizationId: orgId } });
  if (existingCount > 0) {
    console.log(`Tasks already seeded (${existingCount}). Skipping.`);
    return;
  }

  const [notStartedSite, template] = await Promise.all([
    prisma.site.findFirst({
      where: { organizationId: orgId, assignments: { some: { status: 'NOT_STARTED' } } },
    }),
    prisma.questionnaireTemplate.findFirst({
      where: { organizationId: orgId, status: 'PUBLISHED' },
      include: { sections: { include: { questions: { include: { binding: true } } } } },
    }),
  ]);

  const brokenBindings = (template?.sections ?? [])
    .flatMap((s) => s.questions)
    .filter((q) => q.binding && (q.binding.health === 'BROKEN' || q.binding.health === 'AMBIGUOUS'));

  const tasks: Array<{ title: string; description: string; priority: number; entityType: string; entityId: string }> = [];

  for (const q of brokenBindings) {
    tasks.push({
      title: `Fix broken binding: ${q.label}`,
      description: q.binding!.healthMessage ?? 'No matching emission factor.',
      priority: 1,
      entityType: 'FactorBinding',
      entityId: q.binding!.id,
    });
  }

  if (notStartedSite) {
    tasks.push({
      title: `Chase ${notStartedSite.name} — data collection not started`,
      description: 'No answers submitted yet for the current reporting period.',
      priority: 2,
      entityType: 'Site',
      entityId: notStartedSite.id,
    });
  }

  if (tasks.length === 0) {
    console.log('No follow-up conditions found — nothing to seed for Tasks.');
    return;
  }

  await prisma.task.createMany({
    data: tasks.map((t) => ({ organizationId: orgId, status: 'OPEN' as const, ...t })),
  });
  console.log(`Seeded ${tasks.length} tasks.`);
}

async function main() {
  const existing = await prisma.organization.findFirst({ where: { legalName: 'Meridian Industries (Demo)' } });
  if (existing) {
    console.log(`Organization "Meridian Industries (Demo)" already exists (${existing.id}).`);
    await ensureTasks(existing.id);
    return;
  }

  console.log('Creating organization…');
  const org = await prisma.organization.create({
    data: {
      legalName: 'Meridian Industries (Demo)',
      consolidationApproach: 'OPERATIONAL_CONTROL',
      baseYear: 2025,
      baseYearRationale: 'First full year of consolidated site data.',
      defaultGwpSetId: 'AR6',
      locale: 'en-GB',
      isSandbox: false,
    },
  });

  console.log('Seeding vocabulary…');
  await prisma.vocabularyEntry.createMany({
    data: [
      ...ASSET_TYPES.map((a, i) => ({
        organizationId: null,
        kind: 'ASSET_TYPE' as const,
        code: a.code,
        label: a.label,
        metadata: { category: a.category, fuel: a.fuel, unitDim: a.unitDim },
        sortOrder: i,
      })),
      ...SITE_TYPES.map((s, i) => ({
        organizationId: null,
        kind: 'SITE_TYPE' as const,
        code: s.code,
        label: s.label,
        sortOrder: i,
      })),
      ...Object.entries(FUEL_OR_MATERIAL_LABELS).map(([code, label], i) => ({
        organizationId: null,
        kind: 'FUEL_OR_MATERIAL' as const,
        code,
        label,
        sortOrder: i,
      })),
      ...DEMO_DENOMINATORS.map((d, i) => ({
        organizationId: org.id,
        kind: 'DENOMINATOR' as const,
        code: d.code,
        label: d.label,
        sortOrder: i,
      })),
    ],
  });

  console.log('Seeding GWP set (AR6)…');
  await prisma.gwpSet.createMany({
    data: GWP_AR6.map((g) => ({ name: 'AR6', gas: g.gas, gwp100: g.gwp100, isDefault: true })),
  });

  console.log('Seeding emission factor sets + factors…');
  const defraSet = await prisma.emissionFactorSet.create({
    data: {
      organizationId: null,
      publisher: DEFRA_2026.publisher,
      name: DEFRA_2026.name,
      version: DEFRA_2026.version,
      publishedOn: new Date(DEFRA_2026.publishedOn),
      regionScope: DEFRA_2026.regionScope,
      licence: DEFRA_2026.licence,
      sourceUrl: DEFRA_2026.sourceUrl,
    },
  });
  const gridSet = await prisma.emissionFactorSet.create({
    data: {
      organizationId: null,
      publisher: GRID_2026.publisher,
      name: GRID_2026.name,
      version: GRID_2026.version,
      publishedOn: new Date(GRID_2026.publishedOn),
      regionScope: GRID_2026.regionScope,
      licence: GRID_2026.licence,
      sourceUrl: GRID_2026.sourceUrl,
    },
  });

  const factorRows = [
    ...DEFRA_2026.factors.map((f) => ({ ...f, set: defraSet, publishedOn: DEFRA_2026.publishedOn })),
    ...GRID_2026.factors.map((f) => ({ ...f, set: gridSet, publishedOn: GRID_2026.publishedOn })),
  ];

  const createdFactors = [];
  for (const f of factorRows) {
    const created = await prisma.emissionFactor.create({
      data: {
        factorSetId: f.set.id,
        scope: f.scope,
        scope3Category: 'cat' in f ? f.cat : null,
        activityType: f.activityType,
        method: f.method,
        fuelOrMaterialCode: f.fuel,
        region: f.region,
        basis: 'basis' in f ? f.basis : 'SINGLE',
        value: f.value,
        unitNumerator: f.num,
        unitDenominator: f.den,
        validFrom: new Date(f.publishedOn),
        sourceCitation: f.cite,
      },
    });
    createdFactors.push({ ...created, factorSetName: f.set.name, factorSetVersion: f.set.version });
  }

  const candidates: CandidateFactor[] = createdFactors.map((f) => ({
    id: f.id,
    scope: f.scope,
    scope3Category: f.scope3Category,
    activityType: f.activityType,
    method: f.method,
    fuelOrMaterialCode: f.fuelOrMaterialCode,
    region: f.region,
    gas: f.gas,
    basis: f.basis,
    value: f.value.toString(),
    unitNumerator: f.unitNumerator,
    unitDenominator: f.unitDenominator,
    validFrom: f.validFrom,
    validTo: f.validTo,
    sourceCitation: f.sourceCitation,
    factorSetName: f.factorSetName,
    factorSetVersion: f.factorSetVersion,
  }));

  console.log('Seeding label overrides…');
  await prisma.labelOverride.createMany({
    data: DEMO_LABELS.map((l) => ({
      organizationId: org.id,
      entityKind: l.entityKind,
      code: l.code,
      scopeKey: l.scopeKey,
      label: l.label,
      isHidden: 'isHidden' in l ? l.isHidden : false,
    })),
  });

  console.log('Seeding sites + assets…');
  const siteByCode = new Map<string, { id: string; country: string; gridRegion: string | null; siteType: string }>();
  for (const s of DEMO_SITES) {
    const site = await prisma.site.create({
      data: {
        organizationId: org.id,
        name: s.name,
        code: s.code,
        city: s.city,
        country: s.country,
        gridRegion: s.gridRegion,
        siteType: s.siteType,
        floorAreaM2: s.floorAreaM2,
        headcountFte: s.headcountFte,
        denominators: s.denominators,
      },
    });
    siteByCode.set(s.code, { id: site.id, country: site.country, gridRegion: site.gridRegion, siteType: site.siteType });

    const assets = DEMO_ASSETS[s.code] ?? [];
    for (const a of assets) {
      await prisma.siteAsset.create({
        data: {
          organizationId: org.id,
          siteId: site.id,
          name: a.name as string,
          assetTypeCode: a.assetTypeCode as string,
          category: a.category as never,
          fuelOrMaterialCode: (a.fuel as string) ?? null,
          capacity: (a.capacity as string) ?? null,
          capacityUnit: (a.capacityUnit as never) ?? null,
          capacityNote: (a.capacityNote as string) ?? null,
          quantity: (a.quantity as number) ?? 1,
          refrigerantChargeKg: (a.refrigerantChargeKg as string) ?? null,
          subLocation: (a.subLocation as string) ?? null,
          tagOrSerial: (a.tagOrSerial as string) ?? null,
          commissionedOn: a.commissionedOn ? new Date(a.commissionedOn as string) : null,
          decommissionedOn: a.decommissionedOn ? new Date(a.decommissionedOn as string) : null,
          status: (a.status as never) ?? 'ACTIVE',
        },
      });
    }
  }

  console.log('Seeding reporting period…');
  const period = await prisma.reportingPeriod.create({
    data: {
      organizationId: org.id,
      label: 'FY2026',
      startsOn: new Date('2026-01-01'),
      endsOn: new Date('2026-12-31'),
      status: 'DRAFT',
      defaultFactorSetId: defraSet.id,
    },
  });

  console.log('Seeding questionnaire template…');
  const template = await prisma.questionnaireTemplate.create({
    data: {
      organizationId: org.id,
      name: DEMO_TEMPLATE.name,
      version: 1,
      status: 'PUBLISHED',
      appliesToSiteTypes: [...new Set(DEMO_SITES.map((s) => s.siteType))],
      publishedAt: new Date(),
    },
  });

  const questionRows: { id: string; code: string; isRequired: boolean; visibleIf: VisibilityRule | null }[] = [];
  let bindingHealthCounts: Record<BindingHealth, number> = { OK: 0, FALLBACK_REGION: 0, AMBIGUOUS: 0, BROKEN: 0 };

  for (let si = 0; si < DEMO_TEMPLATE.sections.length; si++) {
    const section = DEMO_TEMPLATE.sections[si];
    const sectionRow = await prisma.questionnaireSection.create({
      data: {
        templateId: template.id,
        title: section.title,
        scope: section.scope as never,
        scope3Category: section.cat ?? null,
        sortOrder: si,
      },
    });

    for (let qi = 0; qi < section.questions.length; qi++) {
      const q = section.questions[qi];
      const questionRow = await prisma.question.create({
        data: {
          sectionId: sectionRow.id,
          code: q.code,
          label: q.label,
          helpText: q.helpText ?? null,
          inputType: (q.inputType as never) ?? 'NUMBER_WITH_UNIT',
          unitDimension: (q.unitDim as never) ?? null,
          allowedUnits: (q.allowedUnits as never[]) ?? [],
          isRequired: q.required ?? true,
          visibleIf: (q.visibleIf as never) ?? undefined,
          sortOrder: qi,
        },
      });
      questionRows.push({
        id: questionRow.id,
        code: q.code,
        isRequired: q.required ?? true,
        visibleIf: (q.visibleIf as VisibilityRule) ?? null,
      });

      if (q.binding) {
        const b = q.binding;
        const regionStrategy = (b.regionStrategy ?? 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL') as never;
        const outputBasis = (b.outputBasis ?? 'SINGLE') as 'SINGLE' | 'DUAL';

        // Health is checked against a representative demo site (all are GB) —
        // real per-question health belongs in the app once sites can vary per org.
        const repSite = siteByCode.get('MI-NG-01')!;
        const basesToCheck: Array<'LOCATION_BASED' | 'MARKET_BASED' | undefined> =
          outputBasis === 'DUAL' ? ['LOCATION_BASED', 'MARKET_BASED'] : [undefined];

        let worst: { health: BindingHealth; message: string | null } = { health: 'OK', message: null };
        for (const basis of basesToCheck) {
          const result = checkBindingHealth(candidates, {
            activityType: b.activityType as never,
            method: b.method as never,
            fuelOrMaterialCode: b.fuel,
            basis,
            regionStrategy,
            siteCountry: repSite.country,
            siteGridRegion: repSite.gridRegion,
            on: new Date('2026-08-01'),
          });
          if (HEALTH_RANK[result.health] > HEALTH_RANK[worst.health]) worst = result;
        }
        bindingHealthCounts[worst.health]++;

        await prisma.factorBinding.create({
          data: {
            questionId: questionRow.id,
            scope: b.scope as never,
            scope3Category: b.cat ?? null,
            activityType: b.activityType as never,
            method: b.method as never,
            fuelOrMaterialCode: b.fuel,
            regionStrategy,
            outputBasis: outputBasis as never,
            health: worst.health,
            healthCheckedAt: new Date(),
            healthMessage: worst.message,
          },
        });
      }
    }
  }

  console.log(
    `Binding health: ${bindingHealthCounts.OK} OK, ${bindingHealthCounts.FALLBACK_REGION} fallback-region, ` +
      `${bindingHealthCounts.AMBIGUOUS} ambiguous, ${bindingHealthCounts.BROKEN} broken.`,
  );

  console.log('Seeding assignments + answers…');
  for (const s of DEMO_SITES) {
    const site = siteByCode.get(s.code)!;
    const answers = DEMO_ANSWERS[s.code] ?? {};
    const assets = DEMO_ASSETS[s.code] ?? [];

    const completeness = computeCompleteness(
      {
        questions: questionRows.map((q) => ({ code: q.code, isRequired: q.isRequired, visibleIf: q.visibleIf })),
        satisfied: new Set(Object.keys(answers)),
      },
      {
        siteType: site.siteType,
        siteCountry: site.country,
        assets: assets.map((a) => ({
          category: a.category as string,
          assetTypeCode: a.assetTypeCode as string,
          fuelOrMaterialCode: (a.fuel as string) ?? null,
          status: (a.status as 'ACTIVE' | 'STANDBY' | 'DECOMMISSIONED') ?? 'ACTIVE',
          commissionedOn: a.commissionedOn ? new Date(a.commissionedOn as string) : null,
          decommissionedOn: a.decommissionedOn ? new Date(a.decommissionedOn as string) : null,
        })),
        answers: {},
        periodStart: period.startsOn,
        periodEnd: period.endsOn,
      },
    );

    const status = completeness.pct === 0 ? 'NOT_STARTED' : completeness.pct === 100 ? 'APPROVED' : 'IN_PROGRESS';

    const assignment = await prisma.questionnaireAssignment.create({
      data: {
        templateId: template.id,
        siteId: site.id,
        reportingPeriodId: period.id,
        status,
        completenessPct: completeness.pct,
        submittedAt: status !== 'NOT_STARTED' ? new Date() : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });

    for (const [code, ans] of Object.entries(answers)) {
      const questionRow = questionRows.find((q) => q.code === code);
      if (!questionRow) continue;
      await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: questionRow.id,
          valueNumeric: ans.value,
          unit: ans.unit as never,
          dataQuality: ans.quality as never,
          status: 'ANSWERED',
          answeredAt: new Date(),
        },
      });
    }

    console.log(`  ${s.code}: ${status} (${completeness.satisfied}/${completeness.applicable} required, ${completeness.pct}%)`);
  }

  await ensureTasks(org.id);

  console.log(`\nDone. Organization ${org.id} ("${org.legalName}") seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
