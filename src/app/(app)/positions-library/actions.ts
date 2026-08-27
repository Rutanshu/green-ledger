"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { assertPositionMutable, PositionImmutableFieldError } from "@/lib/positions";

type ActionState = { ok: boolean; error?: string } | null;

async function requirePositionManager() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Not signed in." as const };
  if (!can(membership.role, "manage_questionnaire")) {
    return { error: "Your role can't manage positions." as const };
  }
  return { membership };
}

const PositionInput = z.object({
  positionCode: z.string().min(1, "Give the position a code.").regex(/^[a-z][a-z0-9_]*$/, "code_like_this — lowercase, digits, underscores."),
  labelKey: z.string().min(1, "Give it a label."),
  type: z.enum(["ASSET", "FLOW", "INDICATOR", "OVERVIEW", "QUESTION", "TEXT"]),
  dimension: z.string().optional(),
  allowedUnits: z.array(z.string()).optional(),
  tags: z.string().optional(),
});

export async function createPosition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requirePositionManager();
  if ("error" in auth) return { ok: false, error: auth.error };
  const raw = Object.fromEntries(formData);
  const parsed = PositionInput.safeParse({
    ...raw,
    dimension: raw.dimension || undefined,
    allowedUnits: formData.getAll("allowedUnits"),
    tags: raw.tags || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const existing = await db.position.findFirst({ where: { positionCode: d.positionCode } });
  if (existing) return { ok: false, error: `Position code "${d.positionCode}" already exists.` };

  await withOrgTransaction(orgId, async (tx) => {
    const position = await tx.position.create({
      data: {
        organizationId: orgId,
        positionCode: d.positionCode,
        labelKey: d.labelKey,
        type: d.type,
        dimension: (d.dimension as never) ?? null,
        allowedUnits: (d.allowedUnits as never) ?? [],
        tags: d.tags ? d.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
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

  revalidatePath("/positions-library");
  return { ok: true };
}

export async function deletePosition(positionId: string) {
  const auth = await requirePositionManager();
  if ("error" in auth) return;
  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const position = await db.position.findFirst({
    where: { id: positionId },
    include: { values: { take: 1 }, assetValues: { take: 1 }, sectionItems: { take: 1 } },
  });
  if (!position) return;
  if (position.values.length > 0 || position.assetValues.length > 0) return; // has data — refuse silently, UI hides the button in this case
  if (position.sectionItems.length > 0) return; // still referenced by a questionnaire

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

  revalidatePath("/positions-library");
}

const UpdateInput = z.object({
  positionId: z.string().min(1),
  labelKey: z.string().min(1, "Give it a label."),
  type: z.enum(["ASSET", "FLOW", "INDICATOR", "OVERVIEW", "QUESTION", "TEXT"]),
  dimension: z.string().optional(),
});

/** The one place assertPositionMutable actually gets called against real data. */
export async function updatePosition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await requirePositionManager();
  if ("error" in auth) return { ok: false, error: auth.error };
  const raw = Object.fromEntries(formData);
  const parsed = UpdateInput.safeParse({ ...raw, dimension: raw.dimension || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const orgId = auth.membership.org.id;
  const db = orgScopedClient(orgId);

  const position = await db.position.findFirst({ where: { id: d.positionId } });
  if (!position) return { ok: false, error: "Position not found." };

  try {
    await withOrgTransaction(orgId, async (tx) => {
      const [valueCount, assetValueCount] = await Promise.all([
        tx.positionValue.count({ where: { positionId: d.positionId } }),
        tx.positionAssetValue.count({ where: { positionId: d.positionId } }),
      ]);
      assertPositionMutable(
        { type: position.type, dimension: position.dimension },
        { type: d.type, dimension: (d.dimension as never) ?? null },
        valueCount + assetValueCount > 0,
      );
      const updated = await tx.position.update({
        where: { id: d.positionId },
        data: { labelKey: d.labelKey, type: d.type, dimension: (d.dimension as never) ?? null },
      });
      await recordAudit(tx, {
        organizationId: orgId,
        actorUserId: auth.membership.user.id,
        action: "UPDATE",
        entityType: "Position",
        entityId: d.positionId,
        before: position,
        after: updated,
      });
    });
  } catch (e) {
    if (e instanceof PositionImmutableFieldError) return { ok: false, error: e.message };
    throw e;
  }

  revalidatePath("/positions-library");
  return { ok: true };
}
