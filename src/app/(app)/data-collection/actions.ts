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
import { assertFreshWrite, StaleWriteError } from "@/lib/concurrency";
import { assertCompleteForSubmission, assertHasReleasableAnswers, IncompleteAssignmentError, NothingToReleaseError, transitionAssignment, IllegalAssignmentTransitionError, type AssignmentStatus } from "@/lib/assignments";
import { assertPositionValueWritable, PositionValueLockedError } from "@/lib/positions/valueWritable";
import { assertDistinctApprover, SelfApprovalError } from "@/lib/workflow/fourEyes";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { resolveOrCreatePosition } from "@/lib/positions/resolveOrCreate";
import type { UnitCode } from "@/lib/units";
import type { FuelPropertyRecord } from "@/lib/units/fuelProperty";

const AnswerInput = z.object({
  assignmentId: z.string().min(1),
  questionId: z.string().min(1),
  value: z.coerce.number({ error: "Enter a number." }).finite().nonnegative("Quantity cannot be negative."),
  unit: z.string().min(1, "Choose a unit."),
  dataQuality: z.enum(["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"], { error: "Choose a data quality." }),
  // Optimistic concurrency (lib/concurrency) — what the form had when it
  // loaded. Empty string means "I believe there's no existing answer yet."
  expectedUpdatedAt: z.string().optional().default(""),
  comment: z.string().optional().default(""),
  // "Save as draft" (the guided wizard, Phase 1): saved and calculated like
  // any other answer, but excluded from computeCompleteness()'s satisfied
  // set below, so it can't push an assignment to 100% and get submitted
  // for review before the person who entered it says it's ready.
  draft: z.enum(["true", "false"]).optional().default("false"),
});

export type SubmitAnswerState = {
  ok: boolean;
  error?: string;
  calcWarning?: string;
  emissionsKgCo2e?: string;
  emissionsTonnes?: string;
  /** The primary (first, for a dual-basis binding: location-based) EmissionRecord's traceability fields — spec §6, "how was this calculated." */
  breakdown?: {
    quantityNormalised: string;
    unitNormalised: string;
    factorValue: string;
    factorUnitNumerator: string;
    factorUnitDenominator: string;
    factorSource: string;
    factorVersion: string;
    gwpValue: string;
    gwpSet: string;
    emissionsKgCo2e: string;
    calcEngineVersion: string;
    calculatedAt: string;
  };
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
  const { assignmentId, questionId, value, unit, dataQuality, expectedUpdatedAt, comment, draft } = parsed.data;
  const answerStatus = draft === "true" ? "DRAFT" : "ANSWERED";

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

  // Step 2.2 Phase C: Question stays the authoring/shape source (label,
  // section, ordering, visibility) — nothing about that changes. The VALUE
  // now lives in Position/PositionValue, keyed by (site, period) rather
  // than (assignment, question), matching BUILD_PLAN's "a position appears
  // in any number of questionnaires and is one storage slot." A question
  // authored before this cutover has no Position yet; create one lazily
  // (resolveOrCreatePosition), so a brand-new question works without a
  // separate backfill.
  const position = await resolveOrCreatePosition(db, org.id, question);

  // Reference data for calculation — read-only, fetched before the
  // transaction so the transaction body is just writes.
  const binding = question.binding;
  let candidates: ReturnType<typeof buildFactorCandidates> = [];
  let gwpValues: Record<string, string> = {};
  let consolidationShare = "1";
  let fuelProperties: FuelPropertyRecord[] = [];
  if (binding) {
    const [factorSets, gwpRows, ownership, fuelPropertyRows] = await Promise.all([
      // Scoped to this one binding's fuel — a reference library can hold
      // any number of factors for fuels nothing here is bound to; loading
      // all of them on every single answer save doesn't scale with that.
      db.emissionFactorSet.findMany({ include: { factors: { where: { fuelOrMaterialCode: binding.fuelOrMaterialCode } } } }),
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

    const positionValueKey = { positionId_siteId_reportingPeriodId_line: { positionId: position.id, siteId: assignment.siteId, reportingPeriodId: assignment.reportingPeriodId, line: 1 } } as const;
    const beforePositionValue = await tx.positionValue.findUnique({ where: positionValueKey });
    assertPositionValueWritable(beforePositionValue?.status);
    assertFreshWrite(expectedUpdatedAt || null, beforePositionValue?.updatedAt.toISOString() ?? null);
    const positionValue = await tx.positionValue.upsert({
      where: positionValueKey,
      create: { positionId: position.id, siteId: assignment.siteId, reportingPeriodId: assignment.reportingPeriodId, line: 1, valueNumeric: value, unit: unit as never, dataQuality: dataQuality as never, comment: comment || null, status: answerStatus, answeredAt: new Date(), answeredById: membership.user.id },
      update: { valueNumeric: value, unit: unit as never, dataQuality: dataQuality as never, comment: comment || null, status: answerStatus, answeredAt: new Date(), answeredById: membership.user.id },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: beforePositionValue ? "UPDATE" : "CREATE",
      entityType: "PositionValue",
      entityId: positionValue.id,
      before: beforePositionValue,
      after: positionValue,
    });

    // A resubmit is what actually clears a correction request (Phase 2's
    // Review Data screen) — resolving it here rather than requiring a
    // separate step means the reviewer never has to remember to close it.
    await tx.correctionRequest.updateMany({
      where: { positionValueId: positionValue.id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedById: membership.user.id, resolvedAt: new Date() },
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

      const beforeActivity = await tx.activityRecord.findFirst({ where: { positionValueId: positionValue.id } });
      const activityData = {
        organizationId: org.id,
        siteId: assignment.siteId,
        reportingPeriodId: assignment.reportingPeriodId,
        positionValueId: positionValue.id,
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
    // status never reflects a half-saved value. Sourced from PositionValue
    // now, scoped to this template's questions by matching position code
    // — one fetch, reused below for the rule context too.
    const freshAssignment = await tx.questionnaireAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    const questions = assignment.template.sections.flatMap((s) => s.questions);
    const questionIdByPositionCode = new Map(questions.map((q) => [q.code, q.id]));
    const siblingValues = await tx.positionValue.findMany({
      where: {
        siteId: assignment.siteId,
        reportingPeriodId: assignment.reportingPeriodId,
        position: { organizationId: org.id, positionCode: { in: questions.map((q) => q.code) } },
      },
      include: { position: true },
    });
    // APPROVED counts toward completeness too, not just ANSWERED — an
    // approved answer stays satisfied, it just isn't the reason a fresh
    // submission is being made. Without this, approving an assignment
    // would make its own completeness figure collapse the moment
    // approveAssignment starts actually setting PositionValue.status.
    const satisfied = new Set(
      siblingValues
        .filter((v) => v.status === "ANSWERED" || v.status === "APPROVED")
        .map((v) => questionIdByPositionCode.get(v.position.positionCode))
        .filter((id): id is string => !!id),
    );
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
    // Completeness alone never promotes an assignment to IN_REVIEW or past
    // it — that's an explicit human decision (submitAssignment/
    // approveAssignment below, lib/assignments' state machine). Answering
    // questions only moves it between NOT_STARTED and IN_PROGRESS; a
    // status already at IN_REVIEW/APPROVED/LOCKED is left alone here.
    const inEarlyStage = freshAssignment.status === "NOT_STARTED" || freshAssignment.status === "IN_PROGRESS";
    const newStatus = inEarlyStage ? (completeness.pct === 0 ? "NOT_STARTED" : "IN_PROGRESS") : freshAssignment.status;
    await tx.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: { completenessPct: completeness.pct, status: newStatus },
    });

    // Rules — "on entry": every write re-evaluates every active org rule.
    // A BLOCK violation throws, rolling back everything above in this same
    // transaction (the answer, the recalculation, the completeness update)
    // — a rule never lets half of a rejected write land. A WARN violation
    // is recorded as an open RuleViolation instead, same transaction.
    const positionValuesByCode: Record<string, string | null> = {};
    const priorPeriodValues: Record<string, string | null> = {};
    const dataQualities: Record<string, string | null> = {};
    const attachmentCounts: Record<string, number> = {};
    const comments: Record<string, string | null> = {};
    for (const v of siblingValues) {
      const code = v.position.positionCode;
      positionValuesByCode[code] = v.valueNumeric?.toString() ?? null;
      priorPeriodValues[code] = v.priorPeriodValue?.toString() ?? null;
      dataQualities[code] = v.dataQuality ?? null;
      attachmentCounts[code] = v.documentIds.length;
      comments[code] = v.comment;
    }
    const ruleCtx: RuleEvalContext = {
      positionValues: positionValuesByCode,
      priorPeriodValues,
      dataQualities: dataQualities as RuleEvalContext["dataQualities"],
      attachmentCounts,
      comments,
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
    if (e instanceof StaleWriteError) return { blocked: e.message } as const;
    if (e instanceof PositionValueLockedError) return { blocked: e.message } as const;
    throw e;
  });
  if ("blocked" in result) return { ok: false, error: result.blocked };

  revalidatePath("/data-collection");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/enter-data");
  revalidatePath("/my-submissions");
  revalidatePath("/review");

  const totalKg = sumKg(result.emissionResults);
  const primary = result.emissionResults[0];
  return {
    ok: true,
    calcWarning: result.calcWarning,
    emissionsKgCo2e: result.emissionResults.length > 0 ? totalKg.toFixed(3) : undefined,
    emissionsTonnes: result.emissionResults.length > 0 ? toTonnes(totalKg) : undefined,
    breakdown: primary
      ? {
          quantityNormalised: primary.quantityNormalised.toString(),
          unitNormalised: primary.unitNormalised,
          factorValue: primary.factorValue.toString(),
          factorUnitNumerator: primary.factorUnitNumerator,
          factorUnitDenominator: primary.factorUnitDenominator,
          factorSource: primary.factorSource,
          factorVersion: primary.factorVersion,
          gwpValue: primary.gwpValue.toString(),
          gwpSet: primary.gwpSet,
          emissionsKgCo2e: primary.emissionsKgCo2e.toFixed(3),
          calcEngineVersion: primary.calcEngineVersion,
          // The transaction that just created this record committed
          // moments ago — accurate enough for display, and this is the
          // action layer formatting a response, not lib/calc/ itself.
          calculatedAt: new Date().toISOString(),
        }
      : undefined,
  };
}

type WorkflowState = { ok: boolean; error?: string } | null;

/**
 * NOT_STARTED/IN_PROGRESS -> IN_REVIEW. GHG_TOOL_ARCHITECTURE.md §8.3,
 * BUILD_PLAN Step 3.2: a FULL submission is refused below 100%
 * completeness — never a silent partial submit passed off as complete.
 *
 * `partial: true` is the other release path: "release what's ready" —
 * skips the 100% gate, only requires that something has actually been
 * answered (assertHasReleasableAnswers). The assignment still moves to
 * IN_REVIEW either way; what's honestly different is completenessPct,
 * which review/page.tsx's per-answer status already makes visible to
 * the reviewer rather than this action needing to say "partial" itself.
 */
export async function submitAssignment(assignmentId: string, opts?: { partial?: boolean }): Promise<WorkflowState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't submit this for review.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const assignment = await db.questionnaireAssignment.findFirst({ where: { id: assignmentId, site: { organizationId: org.id } } });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  try {
    if (opts?.partial) {
      // Scoped to this assignment's OWN template's questions — a site can
      // now hold up to 17 assignments (one per scope) sharing the same
      // (siteId, reportingPeriodId), so an unscoped count would let a
      // Scope 1 assignment with zero answers pass purely because some
      // other scope has answers.
      const questionCodes = await db.question.findMany({ where: { section: { templateId: assignment.templateId } }, select: { code: true } });
      const answeredCount = await db.positionValue.count({
        where: {
          siteId: assignment.siteId,
          reportingPeriodId: assignment.reportingPeriodId,
          status: { in: ["ANSWERED", "APPROVED"] },
          position: { positionCode: { in: questionCodes.map((q) => q.code) } },
        },
      });
      assertHasReleasableAnswers(answeredCount);
    } else {
      assertCompleteForSubmission(Number(assignment.completenessPct));
    }
    transitionAssignment(assignment.status as AssignmentStatus, "IN_REVIEW");
  } catch (e) {
    if (e instanceof IncompleteAssignmentError || e instanceof NothingToReleaseError || e instanceof IllegalAssignmentTransitionError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const updated = await tx.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: { status: "IN_REVIEW", submittedById: membership.user.id, submittedAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "QuestionnaireAssignment",
      entityId: assignmentId,
      before: assignment,
      after: updated,
    });
  });

  revalidatePath("/data-collection");
  return { ok: true };
}

/**
 * IN_REVIEW -> APPROVED. Four-eyes: the approver must be a different
 * person from whoever submitted it (lib/workflow/fourEyes.ts) — enforced
 * here, server-side, not just hidden in the UI.
 *
 * Also sweeps every ANSWERED PositionValue in the assignment to APPROVED
 * — previously this action only flipped QuestionnaireAssignment.status,
 * never touched PositionValue at all, so "approved" data could still be
 * silently overwritten by submitAnswer as long as the reporting period
 * itself wasn't locked. Refuses outright if anything is still FLAGGED
 * (an open correction request) — approving shouldn't be able to sweep a
 * value mid-correction into looking settled.
 */
export async function approveAssignment(assignmentId: string): Promise<WorkflowState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't approve this.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const assignment = await db.questionnaireAssignment.findFirst({ where: { id: assignmentId, site: { organizationId: org.id } } });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  try {
    if (assignment.submittedById) assertDistinctApprover(assignment.submittedById, membership.user.id);
    transitionAssignment(assignment.status as AssignmentStatus, "APPROVED");
  } catch (e) {
    if (e instanceof SelfApprovalError || e instanceof IllegalAssignmentTransitionError) return { ok: false, error: e.message };
    throw e;
  }

  // Scoped to this assignment's OWN template's questions — see the
  // matching comment in submitAssignment. Without this, approving one
  // scope's assignment would sweep every OTHER scope's ANSWERED values
  // to APPROVED too, and could get blocked by a FLAGGED value that
  // belongs to a completely unrelated scope.
  const questionCodes = await db.question.findMany({ where: { section: { templateId: assignment.templateId } }, select: { code: true } });
  const positionValues = await db.positionValue.findMany({
    where: {
      siteId: assignment.siteId,
      reportingPeriodId: assignment.reportingPeriodId,
      position: { positionCode: { in: questionCodes.map((q) => q.code) } },
    },
  });
  if (positionValues.some((v) => v.status === "FLAGGED")) {
    return { ok: false, error: "One or more answers are flagged for correction — resolve those first." };
  }
  const toApprove = positionValues.filter((v) => v.status === "ANSWERED");

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const updated = await tx.questionnaireAssignment.update({
      where: { id: assignmentId },
      data: { status: "APPROVED", approverId: membership.user.id, approvedAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "APPROVE",
      entityType: "QuestionnaireAssignment",
      entityId: assignmentId,
      before: assignment,
      after: updated,
    });

    for (const before of toApprove) {
      const after = await tx.positionValue.update({
        where: { id: before.id },
        data: { status: "APPROVED", approvedById: membership.user.id, approvedAt: new Date() },
      });
      await recordAudit(tx, {
        organizationId: org.id,
        actorUserId: membership.user.id,
        action: "APPROVE",
        entityType: "PositionValue",
        entityId: before.id,
        before,
        after,
      });
    }
  });

  revalidatePath("/data-collection");
  revalidatePath("/review");
  revalidatePath("/progress");
  return { ok: true };
}

/**
 * BUILD_PLAN Step 3.6: "a warning requires an audited acknowledgement."
 * The only thing this does to a WARN-severity RuleViolation — never
 * re-evaluates the rule, never touches the answer that triggered it.
 */
export async function acknowledgeRuleViolation(_prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't acknowledge rule violations.` };
  }
  const org = membership.org;
  const violationId = String(formData.get("violationId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { ok: false, error: "Acknowledging a violation needs a comment." };

  const db = orgScopedClient(org.id);
  const violation = await db.ruleViolation.findFirst({ where: { id: violationId } });
  if (!violation) return { ok: false, error: "Violation not found." };
  if (violation.status !== "OPEN") return { ok: false, error: "Already acknowledged." };

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const updated = await tx.ruleViolation.update({
      where: { id: violationId },
      data: { status: "ACKNOWLEDGED", acknowledgedById: membership.user.id, acknowledgedAt: new Date(), acknowledgementComment: comment },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "RuleViolation",
      entityId: violationId,
      before: violation,
      after: updated,
    });
  });

  revalidatePath("/data-collection");
  return { ok: true };
}
