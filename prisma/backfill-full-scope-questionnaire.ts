/**
 * One-off backfill: extends the already-seeded "Meridian Industries (Demo)"
 * org with full Scope 1/2/3 coverage (all 15 Scope 3 categories), a second
 * EPA-published factor set alongside the existing DEFRA one, and a US site
 * (MI-PH-05) to prove the EPA factors actually resolve.
 *
 * Deliberately NOT re-running prisma/seed.ts's main path — that no-ops once
 * the org exists, and re-seeding from scratch would wipe locked-period,
 * restatement, task, and audit history accumulated this session. This
 * script is additive-only and idempotent: every insert is guarded by an
 * existence check, so re-running it is safe.
 *
 * Never touches an APPROVED/LOCKED assignment's stored status — only adds
 * the missing Answer rows so a previously-100%-complete site's stored
 * completeness stays true rather than going stale now that the template
 * has more universally-required questions (capital_goods_spend,
 * employee_commuting_km — see seed-data.ts's DEMO_ANSWERS comment on
 * MI-AD-04).
 *
 * Run with: npx tsx prisma/backfill-full-scope-questionnaire.ts
 * Then:     npx tsx prisma/migrate-questions-to-positions.ts
 * (the second command projects the new Questions/Answers this script
 * creates into the Position/PositionValue tables the live UI actually
 * reads — it's upsert-based and already additive-only, see that file.)
 */
import { adminPrisma } from '../src/lib/db/admin-client';
import { checkBindingHealth, type CandidateFactor, type BindingHealth } from '../src/lib/factors';
import { computeCompleteness, type VisibilityRule } from '../src/lib/visibility';
import { DEFRA_2026, EPA_2026, DEMO_TEMPLATE, DEMO_SITES, DEMO_ASSETS, DEMO_ANSWERS } from './seed-data';

const prisma = adminPrisma;

const HEALTH_RANK: Record<BindingHealth, number> = { OK: 0, FALLBACK_REGION: 1, AMBIGUOUS: 2, BROKEN: 3 };

const NEW_FUEL_OR_MATERIAL_LABELS: Record<string, string> = {
  capital_goods: 'Capital goods',
  diesel_wtt: 'Diesel (well-to-tank)',
  electricity_td_losses: 'Grid electricity (transmission & distribution losses)',
  average_car_commute: 'Average car (employee commuting)',
  leased_assets: 'Leased assets',
  processing_sold_products: 'Processing of sold products',
  use_of_sold_products: 'Use of sold products',
  franchise_operations: 'Franchise operations',
  investments: 'Investments',
};
const NEW_DEFRA_FUELS = new Set(Object.keys(NEW_FUEL_OR_MATERIAL_LABELS));

async function main() {
  const org = await prisma.organization.findFirst({ where: { legalName: 'Meridian Industries (Demo)' } });
  if (!org) throw new Error('Demo org not found — run prisma/seed.ts first.');

  console.log('Vocabulary: new fuel/material entries…');
  for (const [code, label] of Object.entries(NEW_FUEL_OR_MATERIAL_LABELS)) {
    const exists = await prisma.vocabularyEntry.findFirst({ where: { kind: 'FUEL_OR_MATERIAL', code, organizationId: null } });
    if (!exists) {
      await prisma.vocabularyEntry.create({ data: { organizationId: null, kind: 'FUEL_OR_MATERIAL', code, label, sortOrder: 100 } });
    }
  }

  console.log('Factor sets: EPA…');
  let epaSet = await prisma.emissionFactorSet.findFirst({
    where: { organizationId: null, publisher: EPA_2026.publisher, name: EPA_2026.name, version: EPA_2026.version },
  });
  if (!epaSet) {
    epaSet = await prisma.emissionFactorSet.create({
      data: {
        organizationId: null,
        publisher: EPA_2026.publisher,
        name: EPA_2026.name,
        version: EPA_2026.version,
        publishedOn: new Date(EPA_2026.publishedOn),
        regionScope: EPA_2026.regionScope,
        licence: EPA_2026.licence,
        sourceUrl: EPA_2026.sourceUrl,
      },
    });
  }
  const epaFactorCount = await prisma.emissionFactor.count({ where: { factorSetId: epaSet.id } });
  if (epaFactorCount === 0) {
    for (const f of EPA_2026.factors) {
      await prisma.emissionFactor.create({
        data: {
          factorSetId: epaSet.id,
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
          validFrom: new Date(EPA_2026.publishedOn),
          sourceCitation: f.cite,
        },
      });
    }
    console.log(`  seeded ${EPA_2026.factors.length} EPA factors.`);
  } else {
    console.log(`  EPA factors already present (${epaFactorCount}). Skipping.`);
  }

  console.log('Factor sets: new DEFRA rows (Scope 3 categories 2/3/7/8/10/11/14/15)…');
  const defraSet = await prisma.emissionFactorSet.findFirstOrThrow({
    where: { organizationId: null, publisher: DEFRA_2026.publisher, name: DEFRA_2026.name, version: DEFRA_2026.version },
  });
  let newDefraCount = 0;
  for (const f of DEFRA_2026.factors) {
    if (!NEW_DEFRA_FUELS.has(f.fuel)) continue;
    const exists = await prisma.emissionFactor.findFirst({
      where: { factorSetId: defraSet.id, activityType: f.activityType, method: f.method, fuelOrMaterialCode: f.fuel, region: f.region },
    });
    if (exists) continue;
    await prisma.emissionFactor.create({
      data: {
        factorSetId: defraSet.id,
        scope: f.scope,
        scope3Category: 'cat' in f ? f.cat : null,
        activityType: f.activityType,
        method: f.method,
        fuelOrMaterialCode: f.fuel,
        region: f.region,
        basis: (('basis' in f ? f.basis : 'SINGLE') as never),
        value: f.value,
        unitNumerator: f.num,
        unitDenominator: f.den,
        validFrom: new Date(DEFRA_2026.publishedOn),
        sourceCitation: f.cite,
      },
    });
    newDefraCount++;
  }
  console.log(`  seeded ${newDefraCount} new DEFRA factors.`);

  console.log('Sites: Phoenix Distribution Center (MI-PH-05)…');
  let phoenix = await prisma.site.findFirst({ where: { organizationId: org.id, code: 'MI-PH-05' } });
  if (!phoenix) {
    const s = DEMO_SITES.find((x) => x.code === 'MI-PH-05')!;
    phoenix = await prisma.site.create({
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
    for (const a of DEMO_ASSETS['MI-PH-05']) {
      await prisma.siteAsset.create({
        data: {
          organizationId: org.id,
          siteId: phoenix.id,
          name: a.name as string,
          assetTypeCode: a.assetTypeCode as string,
          category: a.category as never,
          fuelOrMaterialCode: (a.fuel as string) ?? null,
          capacityNote: (a.capacityNote as string) ?? null,
          quantity: (a.quantity as number) ?? 1,
          refrigerantChargeKg: (a.refrigerantChargeKg as string) ?? null,
          commissionedOn: a.commissionedOn ? new Date(a.commissionedOn as string) : null,
          status: 'ACTIVE',
        },
      });
    }
    console.log('  created Phoenix + assets.');
  } else {
    console.log('  Phoenix already exists. Skipping site creation.');
  }

  console.log('Sites: LPG heater at Riverside Office (MI-RO-02)…');
  const riverside = await prisma.site.findFirstOrThrow({ where: { organizationId: org.id, code: 'MI-RO-02' } });
  const hasLpgHeater = await prisma.siteAsset.findFirst({ where: { siteId: riverside.id, assetTypeCode: 'lpg_appliance' } });
  if (!hasLpgHeater) {
    const a = DEMO_ASSETS['MI-RO-02'].find((x) => x.assetTypeCode === 'lpg_appliance')!;
    await prisma.siteAsset.create({
      data: {
        organizationId: org.id,
        siteId: riverside.id,
        name: a.name as string,
        assetTypeCode: a.assetTypeCode as string,
        category: a.category as never,
        fuelOrMaterialCode: (a.fuel as string) ?? null,
        capacityNote: (a.capacityNote as string) ?? null,
        quantity: 1,
        commissionedOn: a.commissionedOn ? new Date(a.commissionedOn as string) : null,
        status: 'ACTIVE',
      },
    });
    console.log('  added LPG space heater.');
  } else {
    console.log('  LPG heater already present. Skipping.');
  }

  console.log('Questionnaire: new sections/questions/bindings…');
  const template = await prisma.questionnaireTemplate.findFirstOrThrow({
    where: { organizationId: org.id, status: 'PUBLISHED' },
    include: { sections: { include: { questions: true } } },
  });
  const existingCodes = new Set(template.sections.flatMap((s) => s.questions.map((q) => q.code)));
  let nextSectionSort = Math.max(0, ...template.sections.map((s) => s.sortOrder)) + 1;

  const allSites = await prisma.site.findMany({ where: { organizationId: org.id } });
  const siteByCode = new Map(allSites.map((s) => [s.code, s]));
  const repSite = siteByCode.get('MI-NG-01')!; // representative site for the stored health snapshot — see seed.ts

  const allFactorSets = await prisma.emissionFactorSet.findMany({ include: { factors: true } });
  const candidates: CandidateFactor[] = allFactorSets.flatMap((set) =>
    set.factors.map((f) => ({
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
      factorSetName: set.name,
      factorSetVersion: set.version,
    })),
  );

  let newQuestionCount = 0;
  for (const section of DEMO_TEMPLATE.sections) {
    const newQuestions = section.questions.filter((q) => !existingCodes.has(q.code));
    if (newQuestions.length === 0) continue;

    let sectionRow = template.sections.find((s) => s.title === section.title);
    let qSortBase = sectionRow ? sectionRow.questions.length : 0;
    if (!sectionRow) {
      const created = await prisma.questionnaireSection.create({
        data: { templateId: template.id, title: section.title, scope: section.scope as never, scope3Category: section.cat ?? null, sortOrder: nextSectionSort++ },
      });
      sectionRow = { ...created, questions: [] };
    }

    for (const q of newQuestions) {
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
          sortOrder: qSortBase++,
        },
      });
      newQuestionCount++;

      if (q.binding) {
        const b = q.binding;
        const regionStrategy = (b.regionStrategy ?? 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL') as never;
        const outputBasis = (b.outputBasis ?? 'SINGLE') as 'SINGLE' | 'DUAL';
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
            on: new Date(),
          });
          if (HEALTH_RANK[result.health] > HEALTH_RANK[worst.health]) worst = result;
        }

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
  console.log(`  created ${newQuestionCount} new questions.`);

  console.log('Assignments + answers…');
  const period = await prisma.reportingPeriod.findFirstOrThrow({ where: { organizationId: org.id, status: { in: ['DRAFT', 'IN_REVIEW'] } } });
  const allQuestions = await prisma.question.findMany({ where: { section: { templateId: template.id } } });

  for (const s of DEMO_SITES) {
    const site = siteByCode.get(s.code);
    if (!site) continue;
    const siteAnswers = DEMO_ANSWERS[s.code] ?? {};

    let assignment = await prisma.questionnaireAssignment.findFirst({ where: { siteId: site.id, reportingPeriodId: period.id, templateId: template.id } });
    const isNewAssignment = !assignment;
    if (!assignment) {
      assignment = await prisma.questionnaireAssignment.create({
        data: { templateId: template.id, siteId: site.id, reportingPeriodId: period.id, status: 'NOT_STARTED', completenessPct: 0 },
      });
    }

    const existingAnswers = await prisma.answer.findMany({ where: { assignmentId: assignment.id }, include: { question: true } });
    const answeredCodes = new Set(existingAnswers.map((a) => a.question.code));

    let createdHere = 0;
    for (const [code, ans] of Object.entries(siteAnswers)) {
      if (answeredCodes.has(code)) continue;
      const questionRow = allQuestions.find((q) => q.code === code);
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
      createdHere++;
    }

    // Recompute completeness. Never downgrade an assignment that a human
    // already progressed past NOT_STARTED/IN_PROGRESS — an APPROVED site
    // stays APPROVED (its new-question answers are supplied above so the
    // number stays true); only a brand-new or still-open assignment gets
    // its status/pct updated here.
    const assets = DEMO_ASSETS[s.code] ?? [];
    const allAnswers = await prisma.answer.findMany({ where: { assignmentId: assignment.id }, include: { question: true } });
    const completeness = computeCompleteness(
      {
        questions: allQuestions.map((q) => ({ code: q.code, isRequired: q.isRequired, visibleIf: q.visibleIf as VisibilityRule | null })),
        satisfied: new Set(allAnswers.map((a) => a.question.code)),
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

    if (isNewAssignment || assignment.status === 'NOT_STARTED' || assignment.status === 'IN_PROGRESS') {
      const status = completeness.pct === 0 ? 'NOT_STARTED' : completeness.pct === 100 ? 'APPROVED' : 'IN_PROGRESS';
      await prisma.questionnaireAssignment.update({
        where: { id: assignment.id },
        data: { status, completenessPct: completeness.pct, submittedAt: status !== 'NOT_STARTED' ? new Date() : null, approvedAt: status === 'APPROVED' ? new Date() : null },
      });
      console.log(`  ${s.code}: ${status} (${completeness.satisfied}/${completeness.applicable} required, ${completeness.pct}%) — ${createdHere} new answers`);
    } else {
      await prisma.questionnaireAssignment.update({ where: { id: assignment.id }, data: { completenessPct: completeness.pct } });
      console.log(`  ${s.code}: left as ${assignment.status} (pct refreshed to ${completeness.pct}%) — ${createdHere} new answers`);
    }
  }

  console.log(`\nDone. Backfilled org ${org.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
