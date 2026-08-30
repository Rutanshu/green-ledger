"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { assertPeriodWritable, PeriodLockedError } from "@/lib/periods";
import { transitionAssignment, IllegalAssignmentTransitionError, type AssignmentStatus } from "@/lib/assignments";

type WorkflowState = { ok: boolean; error?: string } | null;

/**
 * Review Data's "send it back" outcome (Phase 2 of the redesign spec).
 * Flags the PositionValue FLAGGED — which drops it out of
 * computeCompleteness()'s satisfied set the same way an unanswered
 * question would — and opens a CorrectionRequest carrying the reviewer's
 * note. submitAnswer() resolves it automatically once the person who
 * owns the entry edits and resubmits; nothing here touches the value itself.
 */
export async function requestCorrection(_prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't send this back for correction.` };
  }
  const org = membership.org;
  const positionValueId = String(formData.get("positionValueId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Explain what needs fixing before sending it back." };

  const db = orgScopedClient(org.id);
  const positionValue = await db.positionValue.findFirst({
    where: { id: positionValueId, site: { organizationId: org.id } },
  });
  if (!positionValue) return { ok: false, error: "Entry not found." };
  if (positionValue.status === "FLAGGED") return { ok: false, error: "Already sent back — waiting on a correction." };

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const correction = await tx.correctionRequest.create({
      data: { organizationId: org.id, positionValueId, requestedById: membership.user.id, note, status: "OPEN" },
    });
    const updated = await tx.positionValue.update({ where: { id: positionValueId }, data: { status: "FLAGGED" } });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "REJECT",
      entityType: "PositionValue",
      entityId: positionValueId,
      before: positionValue,
      after: { ...updated, correctionRequestId: correction.id, note },
    });
  });

  revalidatePath("/review");
  revalidatePath("/data-collection");
  revalidatePath("/enter-data");
  revalidatePath("/my-submissions");
  return { ok: true };
}

/**
 * A manager's self-service way to reopen ONE already-approved answer for
 * re-entry — distinct from CorrectionRequest/Restatement, which exist
 * for a LOCKED reporting period specifically (opposite PeriodStatus gate,
 * so the two never compete for the same value). Bounces the parent
 * assignment APPROVED -> IN_REVIEW so it lands straight back in this
 * page's existing "status: IN_REVIEW" query with no new query logic —
 * the rest of the assignment's approved answers are untouched.
 */
export async function unlockPositionValue(_prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't unlock this.` };
  }
  const org = membership.org;
  const positionValueId = String(formData.get("positionValueId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, error: "Explain why this needs to be reopened." };

  const db = orgScopedClient(org.id);
  const positionValue = await db.positionValue.findFirst({
    where: { id: positionValueId, site: { organizationId: org.id } },
    include: { period: true, position: true },
  });
  if (!positionValue) return { ok: false, error: "Entry not found." };
  if (positionValue.status !== "APPROVED") return { ok: false, error: "This entry isn't approved — nothing to unlock." };

  try {
    assertPeriodWritable(positionValue.period);
  } catch (e) {
    if (e instanceof PeriodLockedError) {
      return { ok: false, error: `${e.message} Use a restatement instead — see Periods.` };
    }
    throw e;
  }

  // A site can hold up to 17 assignments (one per scope) sharing the same
  // (siteId, reportingPeriodId) — an unscoped findFirst would resolve
  // whichever one Postgres happens to return first and could bounce the
  // WRONG scope's assignment back to IN_REVIEW. Trace this value's own
  // question back to its section's template instead.
  const question = await db.question.findFirst({
    where: { code: positionValue.position.positionCode },
    include: { section: true },
  });
  const assignment = question
    ? await db.questionnaireAssignment.findFirst({
        where: { siteId: positionValue.siteId, reportingPeriodId: positionValue.reportingPeriodId, templateId: question.section.templateId },
      })
    : null;

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const updated = await tx.positionValue.update({
      where: { id: positionValueId },
      data: {
        status: "DRAFT",
        unlockReason: reason,
        unlockedAt: new Date(),
        unlockedById: membership.user.id,
        approvedById: null,
        approvedAt: null,
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UNLOCK",
      entityType: "PositionValue",
      entityId: positionValueId,
      before: positionValue,
      after: updated,
    });

    if (assignment) {
      try {
        transitionAssignment(assignment.status as AssignmentStatus, "IN_REVIEW");
      } catch (e) {
        if (e instanceof IllegalAssignmentTransitionError) return; // assignment wasn't APPROVED (already bounced by an earlier unlock) — nothing more to do
        throw e;
      }
      const updatedAssignment = await tx.questionnaireAssignment.update({
        where: { id: assignment.id },
        data: { status: "IN_REVIEW" },
      });
      await recordAudit(tx, {
        organizationId: org.id,
        actorUserId: membership.user.id,
        action: "UNLOCK",
        entityType: "QuestionnaireAssignment",
        entityId: assignment.id,
        before: assignment,
        after: updatedAssignment,
      });
    }
  });

  revalidatePath("/review");
  revalidatePath("/data-collection");
  revalidatePath("/enter-data");
  revalidatePath("/progress");
  return { ok: true };
}
