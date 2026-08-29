"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";

const CreateSiteInput = z.object({
  name: z.string().trim().min(1, "Give the facility a name."),
  code: z
    .string()
    .trim()
    .min(1, "Give the facility a short code.")
    .regex(/^[A-Za-z0-9-]+$/, "Code can only use letters, numbers, and hyphens."),
  siteType: z.string().trim().min(1, "Choose a facility type."),
  country: z
    .string()
    .trim()
    .length(2, "Use a 2-letter country code, e.g. GB.")
    .transform((s) => s.toUpperCase()),
  city: z.string().trim().optional().default(""),
});

export type CreateSiteState = { ok: boolean; error?: string; siteId?: string } | null;

/**
 * There was no path in the product to add a facility at all — every
 * existing site came from seed data. This is the master-data entry
 * point: creates the Site and, if a published template and an open
 * reporting period both exist, an initial QuestionnaireAssignment for
 * it — otherwise the new site would appear everywhere (Dashboard,
 * Data Collection) with no assignment to fill, which the rest of the
 * product doesn't handle gracefully.
 */
export async function createSite(_prev: CreateSiteState, formData: FormData): Promise<CreateSiteState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_sites")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't add facilities.` };
  }
  const org = membership.org;

  const parsed = CreateSiteInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, code, siteType, country, city } = parsed.data;

  const db = orgScopedClient(org.id);
  const existing = await db.site.findFirst({ where: { code } });
  if (existing) return { ok: false, error: `A facility with code "${code}" already exists.` };

  const [template, period] = await Promise.all([
    db.questionnaireTemplate.findFirst({ where: { status: "PUBLISHED" } }),
    db.reportingPeriod.findFirst({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: { startsOn: "desc" } }),
  ]);

  const escapedOrgId = org.id.replace(/'/g, "''");
  const site = await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const created = await tx.site.create({
      data: { organizationId: org.id, name, code, siteType, country, city: city || null },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "CREATE",
      entityType: "Site",
      entityId: created.id,
      after: created,
    });

    if (template && period) {
      const assignment = await tx.questionnaireAssignment.create({
        data: { templateId: template.id, siteId: created.id, reportingPeriodId: period.id, status: "NOT_STARTED" },
      });
      await recordAudit(tx, {
        organizationId: org.id,
        actorUserId: membership.user.id,
        action: "CREATE",
        entityType: "QuestionnaireAssignment",
        entityId: assignment.id,
        after: assignment,
      });
    }

    return created;
  });

  revalidatePath("/sites");
  revalidatePath("/");
  revalidatePath("/progress");
  return { ok: true, siteId: site.id };
}
