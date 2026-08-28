"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";

const DEFAULT_PASSWORD = "Demo2026!";

const CreateCompanyInput = z.object({
  legalName: z.string().trim().min(1, "Legal name can't be empty."),
  adminName: z.string().trim().min(1, "Give the first admin a name."),
  adminEmail: z.string().trim().email("Enter a valid email."),
});

export type CreateCompanyState = { ok: boolean; error?: string; orgId?: string; password?: string } | null;

/**
 * The one deliberate exception to CLAUDE.md rule 6 ("every tenant query
 * is org-scoped") — creating a company is inherently cross-tenant, so
 * this uses rawPrisma directly instead of orgScopedClient, tightly gated
 * behind manage_platform (Super Admin only) rather than any per-org check.
 */
export async function createCompany(_prev: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_platform")) return { ok: false, error: "Only Super Admin can create a company." };

  const parsed = CreateCompanyInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { legalName, adminName, adminEmail } = parsed.data;

  const existingUser = await rawPrisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    const existingMembership = await rawPrisma.membership.findFirst({ where: { userId: existingUser.id } });
    if (existingMembership) {
      return { ok: false, error: `${adminEmail} already belongs to a company — use Global Users to add them to another one instead.` };
    }
  }

  const result = await rawPrisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { legalName } });
    // Postgres RLS on tenant tables (membership, audit_events, ...) checks
    // app.org_id — can only be set once the new org's id exists, which is
    // why this can't happen before the create above the way every other
    // action in this codebase sets it first.
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${org.id.replace(/'/g, "''")}'`);
    const user =
      existingUser ??
      (await tx.user.create({ data: { email: adminEmail, name: adminName, passwordHash: hashPassword(DEFAULT_PASSWORD) } }));
    const newMembership = await tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "DATA_MANAGER" },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "CREATE",
      entityType: "Organization",
      entityId: org.id,
      after: { legalName, firstAdmin: adminEmail },
    });
    return { org, membershipId: newMembership.id };
  });

  revalidatePath("/platform/companies");
  return { ok: true, orgId: result.org.id, password: existingUser ? undefined : DEFAULT_PASSWORD };
}
