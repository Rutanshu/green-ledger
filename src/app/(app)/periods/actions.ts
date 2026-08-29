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
import { resolveOrCreatePosition } from "@/lib/positions/resolveOrCreate";
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
    const position = await resolveOrCreatePosition(tx, org.id, question);
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
      // Scoped to this one binding's fuel — see data-collection/actions.ts.
      tx.emissionFactorSet.findMany({ include: { factors: { where: { fuelOrMaterialCode: binding.fuelOrMaterialCode } } } }),
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

export interface PeriodReadiness {
  totalFacilities: number;
  approvedFacilities: number;
  openBlockingViolations: number;
  brokenBindings: number;
  ready: boolean;
}

/**
 * The period-close gate — one function, used both to render the
 * checklist and (server-side, re-checked rather than trusted from the
 * client) to refuse lockPeriod if anything is still open. A standard
 * ERP release checklist: every facility approved, no BLOCK-severity
 * rule violations open, no broken/ambiguous emission-source bindings.
 */
async function getPeriodReadiness(db: ReturnType<typeof orgScopedClient>, periodId: string): Promise<PeriodReadiness> {
  const assignments = await db.questionnaireAssignment.findMany({ where: { reportingPeriodId: periodId } });
  const totalFacilities = assignments.length;
  const approvedFacilities = assignments.filter((a) => a.status === "APPROVED" || a.status === "LOCKED").length;

  const openBlockingViolations = await db.ruleViolation.count({
    where: {
      status: "OPEN",
      assignmentId: { in: assignments.map((a) => a.id) },
      rule: { severity: "BLOCK" },
    },
  });

  const template = await db.questionnaireTemplate.findFirst({
    where: { status: "PUBLISHED" },
    include: { sections: { include: { questions: { include: { binding: true } } } } },
  });
  const brokenBindings = (template?.sections ?? [])
    .flatMap((s) => s.questions)
    .map((q) => q.binding)
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .filter((b) => b.health === "BROKEN" || b.health === "AMBIGUOUS").length;

  return {
    totalFacilities,
    approvedFacilities,
    openBlockingViolations,
    brokenBindings,
    ready: totalFacilities > 0 && approvedFacilities === totalFacilities && openBlockingViolations === 0 && brokenBindings === 0,
  };
}

export async function getPeriodReadinessAction(periodId: string): Promise<PeriodReadiness | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  return getPeriodReadiness(orgScopedClient(membership.org.id), periodId);
}

type LockPeriodState = { ok: boolean; error?: string } | null;

/**
 * The only path that sets a period to LOCKED — there was none before
 * this. CLAUDE.md rule 8 ("locked periods are immutable") and the
 * restatement flow both assume a period can actually reach LOCKED;
 * nothing in the product could get it there. No unlock action exists
 * deliberately — corrections go through restatement once locked.
 */
export async function lockPeriod(_prev: LockPeriodState, formData: FormData): Promise<LockPeriodState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_org")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't lock a period.` };
  }
  const org = membership.org;
  const periodId = String(formData.get("periodId") ?? "");

  const db = orgScopedClient(org.id);
  const period = await db.reportingPeriod.findFirst({ where: { id: periodId } });
  if (!period) return { ok: false, error: "Period not found." };
  if (period.status === "LOCKED" || period.status === "ASSURED") {
    return { ok: false, error: `${period.label} is already locked.` };
  }

  const readiness = await getPeriodReadiness(db, periodId);
  if (!readiness.ready) {
    const reasons: string[] = [];
    if (readiness.totalFacilities === 0) reasons.push("no facilities are assigned to this period");
    else if (readiness.approvedFacilities < readiness.totalFacilities) {
      reasons.push(`${readiness.totalFacilities - readiness.approvedFacilities} facilit${readiness.totalFacilities - readiness.approvedFacilities === 1 ? "y isn't" : "ies aren't"} approved yet`);
    }
    if (readiness.openBlockingViolations > 0) reasons.push(`${readiness.openBlockingViolations} blocking data-quality flag${readiness.openBlockingViolations === 1 ? "" : "s"} still open`);
    if (readiness.brokenBindings > 0) reasons.push(`${readiness.brokenBindings} emission source${readiness.brokenBindings === 1 ? " has" : "s have"} no factor linked`);
    return { ok: false, error: `Can't lock ${period.label} yet — ${reasons.join("; ")}.` };
  }

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const updated = await tx.reportingPeriod.update({
      where: { id: periodId },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: membership.user.id },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "LOCK",
      entityType: "ReportingPeriod",
      entityId: periodId,
      before: period,
      after: updated,
    });
  });

  revalidatePath("/periods");
  revalidatePath("/");
  return { ok: true };
}
