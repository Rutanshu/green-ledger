"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { LABEL_ENTITY_KINDS } from "@/lib/labels";

type ActionState = { ok: boolean; error?: string } | null;

const OverrideInput = z.object({
  entityKind: z.enum(LABEL_ENTITY_KINDS),
  code: z.string().min(1),
  label: z.string().min(1, "Give it a label."),
  shortLabel: z.string().optional(),
});

/**
 * Renaming is org-wide branding, closest existing capability to that is
 * manage_org (Super Admin only) — matches Organisation settings' gating
 * rather than adding a one-off capability just for this.
 */
export async function setLabelOverride(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_org")) return { ok: false, error: "Your role can't rename labels." };

  const parsed = OverrideInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const orgId = membership.org.id;

  await withOrgTransaction(orgId, async (tx) => {
    const before = await tx.labelOverride.findUnique({
      where: {
        organizationId_entityKind_code_scopeKey_locale: {
          organizationId: orgId,
          entityKind: d.entityKind,
          code: d.code,
          scopeKey: "org",
          locale: "*",
        },
      },
    });
    const after = await tx.labelOverride.upsert({
      where: {
        organizationId_entityKind_code_scopeKey_locale: {
          organizationId: orgId,
          entityKind: d.entityKind,
          code: d.code,
          scopeKey: "org",
          locale: "*",
        },
      },
      create: {
        organizationId: orgId,
        entityKind: d.entityKind,
        code: d.code,
        scopeKey: "org",
        locale: "*",
        label: d.label,
        shortLabel: d.shortLabel || null,
      },
      update: { label: d.label, shortLabel: d.shortLabel || null, updatedById: membership.user.id },
    });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: membership.user.id,
      action: before ? "UPDATE" : "CREATE",
      entityType: "LabelOverride",
      entityId: after.id,
      before,
      after,
    });
  });

  revalidatePath("/labels");
  return { ok: true };
}

export async function clearLabelOverride(entityKind: string, code: string) {
  const membership = await getCurrentMembership();
  if (!membership) return;
  if (!can(membership.role, "manage_org")) return;
  const orgId = membership.org.id;

  await withOrgTransaction(orgId, async (tx) => {
    const before = await tx.labelOverride.findUnique({
      where: {
        organizationId_entityKind_code_scopeKey_locale: {
          organizationId: orgId,
          entityKind: entityKind as (typeof LABEL_ENTITY_KINDS)[number],
          code,
          scopeKey: "org",
          locale: "*",
        },
      },
    });
    if (!before) return;
    await tx.labelOverride.delete({ where: { id: before.id } });
    await recordAudit(tx, {
      organizationId: orgId,
      actorUserId: membership.user.id,
      action: "DELETE",
      entityType: "LabelOverride",
      entityId: before.id,
      before,
    });
  });

  revalidatePath("/labels");
}
