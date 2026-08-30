"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { computeSitePath, SiteCycleError, SiteDepthExceededError } from "@/lib/sites";
import { computeCompleteness, type VisibilityContext, type VisibilityRule } from "@/lib/visibility";

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
  parentSiteId: z.string().trim().optional().transform((s) => (s ? s : undefined)),
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
  const { name, code, siteType, country, city, parentSiteId } = parsed.data;

  const db = orgScopedClient(org.id);
  const existing = await db.site.findFirst({ where: { code } });
  if (existing) return { ok: false, error: `A facility with code "${code}" already exists.` };

  // Phase C of the site-hierarchy plan: path/depth are maintained here at
  // create time (lib/sites' computeSitePath), not derived at query time,
  // so a descendant roll-up is one indexed `$1 = ANY(path)` query rather
  // than a recursive CTE per report. Depth limit and self-ancestry are
  // enforced the same way whether or not a parent is picked.
  let parent: { id: string; path: string[] } | null = null;
  if (parentSiteId) {
    const parentSite = await db.site.findFirst({ where: { id: parentSiteId }, select: { id: true, path: true } });
    if (!parentSite) return { ok: false, error: "Parent facility not found." };
    parent = parentSite;
  }
  const newSiteId = crypto.randomUUID();
  let hierarchy: { path: readonly string[]; depth: number };
  try {
    hierarchy = computeSitePath(newSiteId, parent);
  } catch (e) {
    if (e instanceof SiteDepthExceededError || e instanceof SiteCycleError) return { ok: false, error: e.message };
    throw e;
  }

  // Up to 17 published templates now (one per scope) — a new facility
  // gets one assignment per template that actually has a question
  // applicable to it. A brand-new site has no assets yet, so an
  // asset-gated scope (a refrigerant top-up template, say) correctly
  // gets no assignment until that asset exists; a spend-based scope
  // that isn't asset-gated gets one right away.
  const [templates, period] = await Promise.all([
    db.questionnaireTemplate.findMany({
      where: { status: "PUBLISHED" },
      include: { sections: { include: { questions: true } } },
    }),
    db.reportingPeriod.findFirst({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, orderBy: { startsOn: "desc" } }),
  ]);

  const escapedOrgId = org.id.replace(/'/g, "''");
  const site = await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const created = await tx.site.create({
      data: {
        id: newSiteId,
        organizationId: org.id,
        name,
        code,
        siteType,
        country,
        city: city || null,
        parentSiteId: parentSiteId ?? null,
        path: [...hierarchy.path],
        depth: hierarchy.depth,
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "CREATE",
      entityType: "Site",
      entityId: created.id,
      after: created,
    });

    if (period) {
      const ctx: VisibilityContext = {
        siteType,
        siteCountry: country,
        assets: [], // brand new — nothing commissioned yet
        answers: {},
        periodStart: period.startsOn,
        periodEnd: period.endsOn,
      };
      for (const t of templates) {
        const questions = t.sections.flatMap((s) => s.questions);
        const completeness = computeCompleteness(
          { questions: questions.map((q) => ({ code: q.code, isRequired: q.isRequired, visibleIf: q.visibleIf as VisibilityRule | null })), satisfied: new Set() },
          ctx,
        );
        if (completeness.applicable === 0) continue;

        const assignment = await tx.questionnaireAssignment.create({
          data: { templateId: t.id, siteId: created.id, reportingPeriodId: period.id, status: "NOT_STARTED" },
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
    }

    return created;
  });

  revalidatePath("/sites");
  revalidatePath("/");
  revalidatePath("/progress");
  return { ok: true, siteId: site.id };
}
