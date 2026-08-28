"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";

const OrgInput = z.object({
  legalName: z.string().trim().min(1, "Legal name can't be empty."),
  consolidationApproach: z.enum(["OPERATIONAL_CONTROL", "FINANCIAL_CONTROL", "EQUITY_SHARE"]),
  baseYear: z.coerce.number().int().min(1990).max(2100).optional().or(z.literal("").transform(() => undefined)),
  baseYearRationale: z.string().trim().optional().default(""),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  locale: z.string().trim().min(1),
});

export type UpdateOrgState = { ok: boolean; error?: string } | null;

export async function updateOrganisation(_prev: UpdateOrgState, formData: FormData): Promise<UpdateOrgState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_org")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't edit company structure.` };
  }
  const org = membership.org;

  const parsed = OrgInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { legalName, consolidationApproach, baseYear, baseYearRationale, fiscalYearStartMonth, locale } = parsed.data;

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const before = await tx.organization.findUniqueOrThrow({ where: { id: org.id } });
    const after = await tx.organization.update({
      where: { id: org.id },
      data: {
        legalName,
        consolidationApproach,
        baseYear: baseYear ?? null,
        baseYearRationale: baseYearRationale || null,
        fiscalYearStartMonth,
        locale,
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "Organization",
      entityId: org.id,
      before,
      after,
    });
  });

  revalidatePath("/organisation");
  revalidatePath("/how-it-works");
  return { ok: true };
}
