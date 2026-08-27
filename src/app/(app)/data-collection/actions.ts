"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { computeCompleteness, type VisibilityRule } from "@/lib/visibility";
import { calculateEmissions, calculateDualBasis, sumKg, toTonnes, type CalcInput, type CalcResult } from "@/lib/calc";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import { projectAnswer } from "@/lib/project";
import { recordAudit } from "@/lib/audit";
import { assertPeriodWritable, PeriodLockedError } from "@/lib/periods";
import { evaluateRule, InvalidRuleConditionError, type RuleConfig, type RuleEvalContext } from "@/lib/rules";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import type { UnitCode } from "@/lib/units";
import type { FuelPropertyRecord } from "@/lib/units/fuelProperty";

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

class RuleBlockedError extends Error {}

export async function submitAnswer(_prev: SubmitAnswerState, formData: FormData): Promise<SubmitAnswerState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't submit answers.` };
  }
  const org = membership.org;

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
  try {
    assertPeriodWritable(period);
  } catch (e) {
    if (e instanceof PeriodLockedError) return { ok: false, error: e.message };
    throw e;
  }

  // Reference data for calculation — read-only, fetched before the
  // transaction so the transaction body is just writes.
  const binding = question.binding;
  let candidates: ReturnType<typeof buildFactorCandidates> = [];
  let gwpValues: Record<string, string> = {};
  let consolidationShare = "1";
  let fuelProperties: FuelPropertyRecord[] = [];
  if (binding) {
    const [factorSets, gwpRows, ownership, fuelPropertyRows] = await Promise.all([
      db.emissionFactorSet.findMany({ include: { factors: true } }),
      rawPrisma.gwpSet.findMany({ where: { name: org.defaultGwpSetId ?? "AR6" } }),
      rawPrisma.siteOwnershipPeriod.findFirst({
        where: { siteId: assignment.siteId, validFrom: { lte: period.endsOn } },
        orderBy: { validFrom: "desc" },
      }),
      // null organizationId = platform-global (shadowed by an org's own row
      // for the same fuel+property, same pattern as EmissionFactorSet).
      db.fuelProperty.findMany({ where: { fuelCode: binding.fuelOrMaterialCode } }),
    ]);
    candidates = buildFactorCandidates(factorSets);
    gwpValues = Object.fromEntries(gwpRows.map((g) => [g.gas, g.gwp100.toString()]));
    consolidationShare = ownership?.consolidationShare.toString() ?? "1";
    fuelProperties = fuelPropertyRows.map((p) => ({
      fuelCode: p.fuelCode,
      property: p.property,
      value: p.value.toString(),
      fromUnit: p.fromUnit as UnitCode,
      toUnit: p.toUnit as UnitCode,
      source: p.source,
      validFrom: p.validFrom,
      validTo: p.validTo,
    }));
  }

  // Rules — GHG_TOOL_ARCHITECTURE.md §13, BUILD_PLAN Step 3.6. Read-only
  // reference data, fetched before the transaction for the same reason as
  // the factor/GWP/fuel-property reads above.
  const activeRules = await db.rule.findMany({ where: { isActive: true } });

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
      actorUserId: membership.user.id,
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
        actorUserId: membership.user.id,
        action: beforeActivity ? "UPDATE" : "CREATE",
        entityType: "ActivityRecord",
        entityId: activityRecord.id,
        before: beforeActivity,
        after: activityRecord,
      });

      const calcInput: Omit<CalcInput, "query"> & { query: Omit<CalcInput["query"], "on"> } = {
        activity: { quantity: projected.quantity, unit: projected.unit, activityStart: projected.activityStart, activityEnd: projected.activityEnd },
        candidates,
        fuelProperties,
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
            unitBridgedVia: r.unitBridgedVia,
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
          actorUserId: membership.user.id,
          action: "RECALCULATE",
          entityType: "EmissionRecord",
          entityId: activityRecord.id,
          after: { count: emissionResults.length, totalKg: sumKg(emissionResults).toString() },
        });
      } else if (calcWarning) {
        await recordAudit(tx, {
          organizationId: org.id,
          actorUserId: membership.user.id,
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

    // Rules — "on entry": every write re-evaluates every active org rule.
    // A BLOCK violation throws, rolling back everything above in this same
    // transaction (the answer, the recalculation, the completeness update)
    // — a rule never lets half of a rejected write land. A WARN violation
    // is recorded as an open RuleViolation instead, same transaction.
    const codeById = new Map(questions.map((q) => [q.id, q.code]));
    const positionValues: Record<string, string | null> = {};
    const priorPeriodValues: Record<string, string | null> = {};
    const dataQualities: Record<string, string | null> = {};
    const attachmentCounts: Record<string, number> = {};
    for (const a of freshAssignment.answers) {
      const code = codeById.get(a.questionId);
      if (!code) continue;
      positionValues[code] = a.valueNumeric?.toString() ?? null;
      priorPeriodValues[code] = a.priorPeriodValue?.toString() ?? null;
      dataQualities[code] = a.dataQuality ?? null;
      attachmentCounts[code] = a.documentIds.length;
    }
    const ruleCtx: RuleEvalContext = {
      positionValues,
      priorPeriodValues,
      dataQualities: dataQualities as RuleEvalContext["dataQualities"],
      attachmentCounts,
      completenessPct: completeness.pct,
    };

    for (const rule of activeRules) {
      let verdict: { violated: boolean; message: string };
      try {
        verdict = evaluateRule(rule.config as unknown as RuleConfig, ruleCtx);
      } catch (e) {
        if (e instanceof InvalidRuleConditionError) continue; // a malformed rule shouldn't block every future submission
        throw e;
      }
      if (!verdict.violated) continue;

      if (rule.severity === "BLOCK") {
        throw new RuleBlockedError(`Rule "${rule.name}" blocked this submission: ${verdict.message}`);
      }

      const existing = await tx.ruleViolation.findFirst({
        where: { ruleId: rule.id, assignmentId, questionCode: question.code, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      });
      if (!existing) {
        const violation = await tx.ruleViolation.create({
          data: {
            organizationId: org.id,
            ruleId: rule.id,
            ruleVersion: rule.version,
            assignmentId,
            questionCode: question.code,
            message: verdict.message,
          },
        });
        await recordAudit(tx, {
          organizationId: org.id,
          actorUserId: membership.user.id,
          action: "CREATE",
          entityType: "RuleViolation",
          entityId: violation.id,
          after: violation,
        });
      }
    }

    return { calcWarning, emissionResults };
  }, { timeout: 15000, maxWait: 10000 }).catch((e) => { // Neon's scale-to-zero cold start alone can take 2-3s; the
    // default 5s transaction budget leaves no room for the several
    // queries this transaction actually runs on top of that. Measured
    // directly: 2.4s cold vs 0.2s warm for a single query.
    if (e instanceof RuleBlockedError) return { blocked: e.message } as const;
    throw e;
  });
  if ("blocked" in result) return { ok: false, error: result.blocked };

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
