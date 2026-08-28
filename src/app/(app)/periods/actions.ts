"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { calculateEmissions, calculateDualBasis, type CalcInput, type CalcResult } from "@/lib/calc";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import { projectAnswer } from "@/lib/project";
import { recordAudit } from "@/lib/audit";
import { assertDistinctApprover, decideRestatement, IllegalRestatementTransitionError, SelfApprovalError } from "@/lib/audit/restatement";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import type { UnitCode } from "@/lib/units";
import type { FuelPropertyRecord } from "@/lib/units/fuelProperty";

type ActionState = { ok: boolean; error?: string } | null;

interface RestatementDiff {
  assignmentId: string;
  questionId: string;
  before: { value: string | null; unit: string | null; dataQuality: string | null };
  after: { value: string; unit: string; dataQuality: string };
}

const RequestInput = z.object({
  assignmentId: z.string().min(1),
  questionId: z.string().min(1),
  value: z.coerce.number({ error: "Enter a number." }).finite().nonnegative("Quantity cannot be negative."),
  unit: z.string().min(1, "Choose a unit."),
  dataQuality: z.enum(["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"], { error: "Choose a data quality." }),
  reason: z.string().min(1, "A restatement needs a reason."),
});

/**
 * CLAUDE.md rule 8: "Locked periods are immutable. Corrections go through
 * restatement." This is the only path into a LOCKED/ASSURED period's data
 * — it doesn't write anything itself, only records the request. Applying
 * it (decideRestatementAction below) is a separate, four-eyes-gated step.
 */
export async function requestRestatement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't request restatements.` };
  }
  const org = membership.org;

  const parsed = RequestInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { assignmentId, questionId, value, unit, dataQuality, reason } = parsed.data;

  const db = orgScopedClient(org.id);

  const assignment = await db.questionnaireAssignment.findFirst({
    where: { id: assignmentId, site: { organizationId: org.id } },
    include: { period: true },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  if (assignment.period.status !== "LOCKED" && assignment.period.status !== "ASSURED") {
    return { ok: false, error: `Period ${assignment.period.label} isn't locked — edit the answer directly.` };
  }

  const question = await db.question.findFirst({ where: { id: questionId, section: { template: { organizationId: org.id } } } });
  if (!question) return { ok: false, error: "Question not found." };

  // Step 2.2 Phase C: the current value, if any, now lives in PositionValue.
  const position = await db.position.findFirst({ where: { organizationId: org.id, positionCode: question.code } });
  const existing = position
    ? await db.positionValue.findUnique({
        where: {
          positionId_siteId_reportingPeriodId_line: {
            positionId: position.id,
            siteId: assignment.siteId,
            reportingPeriodId: assignment.reportingPeriodId,
            line: 1,
          },
        },
      })
    : null;

  const diff: RestatementDiff = {
    assignmentId,
    questionId,
    before: {
      value: existing?.valueNumeric?.toString() ?? null,
      unit: existing?.unit ?? null,
      dataQuality: existing?.dataQuality ?? null,
    },
    after: { value: value.toString(), unit, dataQuality },
  };

  await rawPrisma.$transaction(async (tx) => {
    const escapedOrgId = org.id.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const restatement = await tx.restatement.create({
      data: {
        organizationId: org.id,
        reportingPeriodId: assignment.reportingPeriodId,
        entityType: "PositionValue",
        entityId: `${assignmentId}:${questionId}`,
        reason,
        diff: diff as never,
        requestedById: membership.user.id,
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "CREATE",
      entityType: "Restatement",
      entityId: restatement.id,
      after: restatement,
    });
  });

  revalidatePath("/periods");
  revalidatePath("/data-collection");
  return { ok: true };
}

/**
 * Applying an approved restatement is the ONLY thing in this codebase
 * allowed to write into a locked period — deliberately not routed through
 * submitAnswer's own lock check, since being the sanctioned exception to
 * it is the entire point. Recalculation reuses the same pure lib/calc
 * functions submitAnswer uses; it does not reuse submitAnswer's
 * orchestration code, to avoid touching that already-verified hot path
 * for a change this narrow.
 */
export async function decideRestatementAction(restatementId: string, decision: "APPROVED" | "REJECTED"): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't decide restatements.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const restatement = await db.restatement.findFirst({ where: { id: restatementId } });
  if (!restatement) return { ok: false, error: "Restatement not found." };

  try {
    assertDistinctApprover(restatement.requestedById, membership.user.id);
    decideRestatement(restatement.status, decision);
  } catch (e) {
    if (e instanceof SelfApprovalError || e instanceof IllegalRestatementTransitionError) return { ok: false, error: e.message };
    throw e;
  }

  const diff = restatement.diff as unknown as RestatementDiff;
  const escapedOrgId = org.id.replace(/'/g, "''");

  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);

    const updated = await tx.restatement.update({
      where: { id: restatementId },
      data: { status: decision, approverId: membership.user.id, decidedAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: decision === "APPROVED" ? "RESTATE" : "REJECT",
      entityType: "Restatement",
      entityId: restatement.id,
      before: restatement,
      after: updated,
    });

    if (decision !== "APPROVED") return;

    const question = await tx.question.findFirst({ where: { id: diff.questionId }, include: { binding: true } });
    const assignment = await tx.questionnaireAssignment.findFirst({
      where: { id: diff.assignmentId },
      include: { period: true, site: true },
    });
    if (!question || !assignment) throw new Error("Restatement target no longer exists.");

    const value = Number(diff.after.value);
    const unit = diff.after.unit as UnitCode;
    const dataQuality = diff.after.dataQuality as "MEASURED" | "CALCULATED" | "ESTIMATED" | "PROXY";

    // Step 2.2 Phase C: same lazy resolve-or-create as submitAnswer — a
    // question authored before the cutover may not have a Position yet.
    const position = await tx.position.upsert({
      where: { organizationId_positionCode: { organizationId: org.id, positionCode: question.code } },
      create: {
        organizationId: org.id,
        positionCode: question.code,
        labelKey: question.label,
        type: question.inputType === "INDICATOR" ? "INDICATOR" : "FLOW",
        dimension: question.unitDimension,
        allowedUnits: question.allowedUnits,
      },
      update: {},
    });
    const positionValueKey = {
      positionId_siteId_reportingPeriodId_line: { positionId: position.id, siteId: assignment.siteId, reportingPeriodId: assignment.reportingPeriodId, line: 1 },
    } as const;
    const beforePositionValue = await tx.positionValue.findUnique({ where: positionValueKey });
    const positionValue = await tx.positionValue.upsert({
      where: positionValueKey,
      create: { positionId: position.id, siteId: assignment.siteId, reportingPeriodId: assignment.reportingPeriodId, line: 1, valueNumeric: value, unit, dataQuality, status: "ANSWERED", answeredAt: new Date() },
      update: { valueNumeric: value, unit, dataQuality, status: "ANSWERED", answeredAt: new Date() },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "RESTATE",
      entityType: "PositionValue",
      entityId: positionValue.id,
      before: beforePositionValue,
      after: positionValue,
    });

    const binding = question.binding;
    if (!binding) return;

    const [factorSets, gwpRows, ownership, fuelPropertyRows] = await Promise.all([
      tx.emissionFactorSet.findMany({ include: { factors: true } }),
      tx.gwpSet.findMany({ where: { name: org.defaultGwpSetId ?? "AR6" } }),
      tx.siteOwnershipPeriod.findFirst({
        where: { siteId: assignment.siteId, validFrom: { lte: assignment.period.endsOn } },
        orderBy: { validFrom: "desc" },
      }),
      tx.fuelProperty.findMany({ where: { fuelCode: binding.fuelOrMaterialCode } }),
    ]);
    const candidates = buildFactorCandidates(factorSets);
    const gwpValues = Object.fromEntries(gwpRows.map((g) => [g.gas, g.gwp100.toString()]));
    const fuelProperties: FuelPropertyRecord[] = fuelPropertyRows.map((p) => ({
      fuelCode: p.fuelCode,
      property: p.property,
      value: p.value.toString(),
      fromUnit: p.fromUnit as UnitCode,
      toUnit: p.toUnit as UnitCode,
      source: p.source,
      validFrom: p.validFrom,
      validTo: p.validTo,
    }));

    const projected = projectAnswer({
      answer: { valueNumeric: value, unit, dataQuality },
      binding,
      periodStart: assignment.period.startsOn,
      periodEnd: assignment.period.endsOn,
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
      consolidationShare: ownership?.consolidationShare.toString() ?? "1",
      multiplier: binding.multiplier.toString(),
    };

    let emissionResults: CalcResult[] = [];
    try {
      emissionResults = binding.outputBasis === "DUAL"
        ? [...calculateDualBasis(calcInput).locationBased, ...calculateDualBasis(calcInput).marketBased]
        : calculateEmissions(calcInput);
    } catch {
      emissionResults = [];
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
    }
  }, { timeout: 15000, maxWait: 10000 });

  revalidatePath("/periods");
  revalidatePath("/data-collection");
  revalidatePath("/reports");
  return { ok: true };
}
