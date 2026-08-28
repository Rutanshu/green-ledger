"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";

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
