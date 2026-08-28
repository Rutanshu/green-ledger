"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { withOrgTransaction } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";

const UpdateGwpInput = z.object({
  id: z.string().min(1),
  gwp100: z.coerce.number().positive("GWP100 must be a positive number."),
});

export type PlatformActionState = { ok: boolean; error?: string } | null;

export async function updateGwpValue(_prev: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_platform")) return { ok: false, error: "Only Super Admin can edit this." };

  const parsed = UpdateGwpInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, gwp100 } = parsed.data;

  const before = await rawPrisma.gwpSet.findUniqueOrThrow({ where: { id } });
  const after = await rawPrisma.gwpSet.update({ where: { id }, data: { gwp100 } });

  // GwpSet is platform-global reference data, not owned by one org — log
  // the change under the acting Super Admin's own org rather than
  // skipping the audit trail entirely.
  await withOrgTransaction(membership.org.id, (tx) =>
    recordAudit(tx, {
      organizationId: membership.org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "GwpSet",
      entityId: id,
      before,
      after,
    }),
  );

  revalidatePath("/platform/settings");
  return { ok: true };
}
