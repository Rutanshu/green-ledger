"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { computeCompleteness, type VisibilityRule } from "@/lib/visibility";
import { calculateEmissions, calculateDualBasis, sumKg, toTonnes, type CalcInput, type CalcResult } from "@/lib/calc";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import { projectAnswer } from "@/lib/project";
import { recordAudit } from "@/lib/audit";
import type { UnitCode } from "@/lib/units";

const AnswerInput = z.object({
  assignmentId: z.string().min(1),
  questionId: z.string().min(1),
  value: z.coerce.number({ error: "Enter a number." }).finite().nonnegative("Quantity cannot be negative."),
  unit: z.string().min(1, "Choose a unit."),
  dataQuality: z.enum(["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"], { error: "Choose a data quality." }),
});

export type SubmitAnswerState = {
  ok: boolean;
  error?: string;
  calcWarning?: string;
  emissionsKgCo2e?: string;
  emissionsTonnes?: string;
} | null;

export async function submitAnswer(_prev: SubmitAnswerState, formData: FormData): Promise<SubmitAnswerState> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in." };

  const parsed = AnswerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { assignmentId, questionId, value, unit, dataQuality } = parsed.data;

  const db = orgScopedClient(org.id);

  const question = await db.question.findFirst({
    where: { id: questionId, section: { template: { organizationId: org.id } } },
    include: { binding: true },
  });
  if (!question) return { ok: false, error: "Question not found." };
  if (question.allowedUnits.length > 0 && !question.allowedUnits.includes(unit as UnitCode)) {
    return { ok: false, error: `Unit must be one of: ${question.allowedUnits.join(", ")}.` };
  }

  // QuestionnaireAssignment has no organizationId column of its own — it's
  // scoped transitively through its site, so orgScopedClient can't enforce
  // this one automatically (see the note in lib/db/tenant.ts). Express the
  // boundary explicitly here instead of trusting an unscoped id lookup,
  // otherwise a caller could write an answer into another org's assignment
  // just by knowing its id.
  const assignment = await db.questionnaireAssignment.findFirst({
    where: { id: assignmentId, site: { organizationId: org.id } },
    include: {
      site: { include: { assets: true } },
      period: true,
      template: { include: { sections: { include: { questions: true } } } },
    },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  const period = assignment.period;
  if (period.status === "LOCKED" || period.status === "ASSURED") {
    return { ok: false, error: `Period ${period.label} is ${period.status.toLowerCase()} — edits are refused.` };
  }

  // Reference data for calculation — read-only, fetched before the
  // transaction so the transaction body is just writes.
  const binding = question.binding;
  let candidates: ReturnType<typeof buildFactorCandidates> = [];
  let gwpValues: Record<string, string> = {};
  let consolidationShare = "1";
  if (binding) {
    const [factorSets, gwpRows, ownership] = await Promise.all([
      db.emissionFactorSet.findMany({ include: { factors: true } }),
      rawPrisma.gwpSet.findMany({ where: { name: org.defaultGwpSetId ?? "AR6" } }),
      rawPrisma.siteOwnershipPeriod.findFirst({
        where: { siteId: assignment.siteId, validFrom: { lte: period.endsOn } },
        orderBy: { validFrom: "desc" },
      }),
    ]);
    candidates = buildFactorCandidates(factorSets);
    gwpValues = Object.fromEntries(gwpRows.map((g) => [g.gas, g.gwp100.toString()]));
    consolidationShare = ownership?.consolidationShare.toString() ?? "1";
  }

  const escapedOrgId = org.id.replace(/'/g, "''");

  const result = await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);

    const beforeAnswer = await tx.answer.findUnique({ where: { assignmentId_questionId: { assignmentId, questionId } } });
    const answer = await tx.answer.upsert({
      where: { assignmentId_questionId: { assignmentId, questionId } },
      create: { assignmentId, questionId, valueNumeric: value, unit: unit as never, dataQuality: dataQuality as never, status: "ANSWERED", answeredAt: new Date() },
      update: { valueNumeric: value, unit: unit as never, dataQuality: dataQuality as never, status: "ANSWERED", answeredAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      action: beforeAnswer ? "UPDATE" : "CREATE",
      entityType: "Answer",
      entityId: answer.id,
      before: beforeAnswer,
      after: answer,
    });

    let calcWarning: string | undefined;
    let emissionResults: CalcResult[] = [];

    if (binding) {
      const projected = projectAnswer({
        answer: { valueNumeric: value, unit: unit as UnitCode, dataQuality },
        binding,
        periodStart: period.startsOn,
        periodEnd: period.endsOn,
      });

      const beforeActivity = await tx.activityRecord.findFirst({ where: { answerId: answer.id } });
      const activityData = {
        organizationId: org.id,
        siteId: assignment.siteId,
        reportingPeriodId: assignment.reportingPeriodId,
        answerId: answer.id,
        ...projected,
        status: "SUBMITTED" as const,
      };
      const activityRecord = beforeActivity
        ? await tx.activityRecord.update({ where: { id: beforeActivity.id }, data: activityData })
        : await tx.activityRecord.create({ data: activityData });
      await recordAudit(tx, {
        organizationId: org.id,
        action: beforeActivity ? "UPDATE" : "CREATE",
        entityType: "ActivityRecord",
        entityId: activityRecord.id,
        before: beforeActivity,
        after: activityRecord,
      });

      const calcInput: Omit<CalcInput, "query"> & { query: Omit<CalcInput["query"], "on"> } = {
        activity: { quantity: projected.quantity, unit: projected.unit, activityStart: projected.activityStart, activityEnd: projected.activityEnd },
        candidates,
        query: {
          activityType: binding.activityType,
          method: binding.method,
          fuelOrMaterialCode: binding.fuelOrMaterialCode,
          regionStrategy: binding.regionStrategy,
          fixedRegion: binding.fixedRegion,
          siteCountry: assignment.site.country,
          siteGridRegion: assignment.site.gridRegion,
        },
        gwpValues,
        gwpSetName: org.defaultGwpSetId ?? "AR6",
        consolidationShare,
        multiplier: binding.multiplier.toString(),
      };

      try {
        if (binding.outputBasis === "DUAL") {
          const dual = calculateDualBasis(calcInput);
          emissionResults = [...dual.locationBased, ...dual.marketBased];
          if (dual.marketFellBackToLocation) {
            calcWarning = "Market-based figure used location-based data — no contractual instrument on file.";
          }
        } else {
          emissionResults = calculateEmissions(calcInput);
        }
      } catch (e) {
        calcWarning = e instanceof Error ? e.message : "Calculation failed.";
      }

      await tx.emissionRecord.deleteMany({ where: { activityRecordId: activityRecord.id } });
      if (emissionResults.length > 0) {
        await tx.emissionRecord.createMany({
          data: emissionResults.map((r) => ({
            activityRecordId: activityRecord.id,
            basis: r.basis,
            gas: r.gas as never,
            quantityNormalised: r.quantityNormalised.toString(),
            unitNormalised: r.unitNormalised as never,
            unitConversionFactor: r.unitConversionFactor.toString(),
            factorId: r.factorId,
            factorValue: r.factorValue.toString(),
            factorUnitNumerator: r.factorUnitNumerator as never,
            factorUnitDenominator: r.factorUnitDenominator as never,
            factorSource: r.factorSource,
            factorVersion: r.factorVersion,
            factorValidFrom: r.factorValidFrom,
            factorValidTo: r.factorValidTo,
            gwpValue: r.gwpValue.toString(),
            gwpSet: r.gwpSet,
            consolidationShare: r.consolidationShare.toString(),
            daysCovered: r.daysCovered,
            daysTotal: r.daysTotal,
            emissionsKgCo2e: r.emissionsKgCo2e.toString(),
            calcEngineVersion: r.calcEngineVersion,
          })),
        });
        await recordAudit(tx, {
          organizationId: org.id,
          action: "RECALCULATE",
          entityType: "EmissionRecord",
          entityId: activityRecord.id,
          after: { count: emissionResults.length, totalKg: sumKg(emissionResults).toString() },
        });
      } else if (calcWarning) {
        await recordAudit(tx, {
          organizationId: org.id,
          action: "RECALCULATE",
          entityType: "EmissionRecord",
          entityId: activityRecord.id,
          after: { count: 0, error: calcWarning },
        });
      }
    }

    // Completeness, recomputed in the same transaction so the assignment
    // status never reflects a half-saved answer.
    const freshAssignment = await tx.questionnaireAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { answers: true },
    });
    const questions = assignment.template.sections.flatMap((s) => s.questions);
    const satisfied = new Set(freshAssignment.answers.map((a) => a.questionId));
    const completeness = computeCompleteness(
      { questions: questions.map((q) => ({ code: q.id, isRequired: q.isRequired, visibleIf: q.visibleIf as VisibilityRule | null })), satisfied },
      {
        siteType: assignment.site.siteType,
        siteCountry: assignment.site.country,
        assets: assignment.site.assets.map((a) => ({
          category: a.category,
          assetTypeCode: a.assetTypeCode,
          fuelOrMaterialCode: a.fuelOrMaterialCode,
          status: a.status,
          commissionedOn: a.commissionedOn,
          decommissionedOn: a.decommissionedOn,
        })),
        answers: {},
        periodStart: period.startsOn,
        periodEnd: period.endsOn,
      },
    );
    const newStatus = completeness.pct === 0 ? "NOT_STARTED" : completeness.pct === 100 ? "IN_REVIEW" : "IN_PROGRESS";
    await tx.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: { completenessPct: completeness.pct, status: freshAssignment.status === "APPROVED" ? "APPROVED" : newStatus },
    });

    return { calcWarning, emissionResults };
  });

  revalidatePath("/data-collection");
  revalidatePath("/");
  revalidatePath("/reports");

  const totalKg = sumKg(result.emissionResults);
  return {
    ok: true,
    calcWarning: result.calcWarning,
    emissionsKgCo2e: result.emissionResults.length > 0 ? totalKg.toFixed(3) : undefined,
    emissionsTonnes: result.emissionResults.length > 0 ? toTonnes(totalKg) : undefined,
  };
}
