"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

type ActionState = { ok: boolean; error?: string } | null;

async function requirePositionManager() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Not signed in." as const };
  if (!can(membership.role, "manage_sites")) {
    return { error: "Your role can't manage positions." as const };
  }
  return { membership };
}

const PositionInput = z.object({
  title: z.string().min(1, "Give the position a title."),
  type: z.enum(["DATA_OWNER", "REVIEWER", "APPROVER", "SITE_MANAGER", "CATEGORY_OWNER", "OTHER"]),
  siteId: z.string().optional(),
  description: z.string().optional(),
});

export async function createPosition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requirePositionManager();
  if ("error" in auth) return { ok: false, error: auth.error };
  const raw = Object.fromEntries(formData);
  const parsed = PositionInput.safeParse({ ...raw, siteId: raw.siteId || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  if (parsed.data.siteId) {
    const site = await db.site.findFirst({ where: { id: parsed.data.siteId } });
    if (!site) return { ok: false, error: "Site not found." };
  }

  await withOrgTransaction(orgId, async (tx) => {
    const position = await tx.position.create({
      data: {
        organizationId: orgId,
        title: parsed.data.title,
        type: parsed.data.type,
        siteId: parsed.data.siteId ?? null,
        description: parsed.data.description || null,
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "CREATE",
      entityType: "Position",
      entityId: position.id,
      after: position,
    });
  });

  revalidatePath("/positions");
  return { ok: true };
}

export async function deletePosition(positionId: string) {
  const auth = await requirePositionManager();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const position = await db.position.findFirst({ where: { id: positionId } });
  if (!position) return;

  await withOrgTransaction(orgId, async (tx) => {
    await tx.position.delete({ where: { id: positionId } });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "DELETE",
      entityType: "Position",
      entityId: positionId,
      before: position,
    });
  });

  revalidatePath("/positions");
}

const AssignInput = z.object({
  positionId: z.string().min(1),
  userId: z.string().min(1, "Choose a person."),
  isBackup: z.coerce.boolean().optional(),
  reason: z.string().optional(),
});

/**
 * Ends whichever assignment currently occupies this slot (primary or
 * backup — never both at once) and starts a new one. Never deletes a row:
 * a position's history has to answer "who held this when the work
 * happened," per the spec's build-acceptance bar for positions.
 */
export async function assignPosition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requirePositionManager();
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = AssignInput.safeParse({ ...Object.fromEntries(formData), isBackup: formData.get("isBackup") === "on" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const position = await db.position.findFirst({ where: { id: d.positionId } });
  if (!position) return { ok: false, error: "Position not found." };

  const member = await db.membership.findFirst({ where: { userId: d.userId, organizationId: orgId } });
  if (!member) return { ok: false, error: "That person isn't a member of this organisation." };

  await withOrgTransaction(orgId, async (tx) => {
    const current = await tx.positionAssignment.findFirst({
      where: { positionId: d.positionId, isBackup: !!d.isBackup, endedOn: null },
    });
    if (current) {
      await tx.positionAssignment.update({ where: { id: current.id }, data: { endedOn: new Date() } });
    }
    const assignment = await tx.positionAssignment.create({
      data: {
        positionId: d.positionId,
        userId: d.userId,
        isBackup: !!d.isBackup,
        reason: d.reason || null,
        createdById: auth.membership.user.id,
      },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "UPDATE",
      entityType: "PositionAssignment",
      entityId: assignment.id,
      before: current,
      after: assignment,
    });
  });

  revalidatePath("/positions");
  return { ok: true };
}

export async function endAssignment(assignmentId: string) {
  const auth = await requirePositionManager();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  // PositionAssignment has no direct organization_id — verify ownership
  // through its Position, the same way FactorBinding is verified through
  // Question in factor-lab/actions.ts.
  const assignment = await db.positionAssignment.findFirst({
    where: { id: assignmentId, position: { organizationId: orgId } },
  });
  if (!assignment || assignment.endedOn) return;

  await withOrgTransaction(orgId, async (tx) => {
    const updated = await tx.positionAssignment.update({
      where: { id: assignmentId },
      data: { endedOn: new Date() },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: auth.membership.user.id,
      action: "UPDATE",
      entityType: "PositionAssignment",
      entityId: assignmentId,
      before: assignment,
      after: updated,
    });
  });

  revalidatePath("/positions");
}
