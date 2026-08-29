"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { aggregateEmissionsForReport, type ReportEmissionRow } from "@/lib/calc/reportAggregation";

const GenerateReportInput = z.object({
  reportingPeriodId: z.string().min(1, "Choose a reporting period."),
  siteIds: z.array(z.string()).min(1, "Choose at least one facility."),
  format: z.enum(["JSON", "CSV"]),
  acknowledgeWarnings: z.enum(["true", "false"]).optional().default("false"),
  // Opt-in: roll up every descendant of a picked facility into the same
  // report. Never automatic — a facility with children shouldn't silently
  // report a bigger number than what was picked (CLAUDE.md rule 2, every
  // number traceable). Which sites the roll-up actually pulled in gets
  // recorded on the snapshot below, not just a bigger total.
  includeDescendants: z.enum(["true", "false"]).optional().default("false"),
});

export type GenerateReportState =
  | { ok: true; reportId: string; figuresSnapshot: ReturnType<typeof buildSnapshot> }
  | { ok: false; error: string; needsAcknowledgement?: boolean }
  | null;

function buildSnapshot(agg: ReturnType<typeof aggregateEmissionsForReport>, pickedSiteIds: string[], expandedSiteIds: string[]) {
  return {
    totalKgCo2e: agg.totalKgCo2e.toString(),
    totalTonnes: agg.totalTonnes,
    byScope: Object.fromEntries(Object.entries(agg.byScope).map(([k, v]) => [k, v.toString()])),
    byScope3Category: Object.fromEntries(Object.entries(agg.byScope3Category).map(([k, v]) => [k, v.toString()])),
    bySite: agg.bySite.map((s) => ({ siteId: s.siteId, siteName: s.siteName, kgCo2e: s.kgCo2e.toString() })),
    recordCount: agg.recordCount,
    // What was actually picked vs. what a descendant roll-up pulled in
    // beyond that — disclosed explicitly rather than folded into a
    // bigger, unexplained total.
    pickedSiteIds,
    expandedSiteIds,
  };
}

/**
 * The report wizard's final step (spec §10). Refuses to generate — rather
 * than silently proceeding — when required approvals are missing; warns
 * (with an explicit acknowledgement required to continue) on open
 * data-quality flags, since those are sometimes accepted deliberately.
 */
export async function generateReport(_prev: GenerateReportState, formData: FormData): Promise<GenerateReportState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't generate reports.` };
  }
  const org = membership.org;

  const parsed = GenerateReportInput.safeParse({
    reportingPeriodId: formData.get("reportingPeriodId"),
    siteIds: formData.getAll("siteIds"),
    format: formData.get("format"),
    acknowledgeWarnings: formData.get("acknowledgeWarnings") ?? "false",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { reportingPeriodId, siteIds, format, acknowledgeWarnings, includeDescendants } = parsed.data;

  const db = orgScopedClient(org.id);
  const period = await db.reportingPeriod.findFirst({ where: { id: reportingPeriodId } });
  if (!period) return { ok: false, error: "Reporting period not found." };

  // A picked site's `path` array contains the id of every one of its
  // ancestors plus itself, so "does this site's path include a picked
  // id" is exactly "is this site the picked one or a descendant of it" —
  // one indexed query (see the GIN index added on Site.path), no
  // recursive CTE.
  let effectiveSiteIds = siteIds;
  let expandedSiteIds: string[] = [];
  if (includeDescendants === "true") {
    const descendants = await db.site.findMany({
      where: { organizationId: org.id, path: { hasSome: siteIds } },
      select: { id: true },
    });
    effectiveSiteIds = [...new Set([...siteIds, ...descendants.map((d) => d.id)])];
    expandedSiteIds = effectiveSiteIds.filter((id) => !siteIds.includes(id));
  }

  const assignments = await db.questionnaireAssignment.findMany({
    where: { reportingPeriodId, siteId: { in: effectiveSiteIds }, site: { organizationId: org.id } },
  });
  const notApproved = assignments.filter((a) => a.status !== "APPROVED" && a.status !== "LOCKED");
  if (notApproved.length > 0) {
    return { ok: false, error: `${notApproved.length} of the facilities you picked haven't been approved yet — approve them in Review Data first.` };
  }

  const openViolations = await db.ruleViolation.findMany({
    where: { status: "OPEN", assignmentId: { in: assignments.map((a) => a.id) } },
  });
  if (openViolations.length > 0 && acknowledgeWarnings !== "true") {
    return {
      ok: false,
      error: `${openViolations.length} open data-quality flag${openViolations.length === 1 ? "" : "s"} on this data. Review them, or continue anyway.`,
      needsAcknowledgement: true,
    };
  }

  const emissionRecords = await db.emissionRecord.findMany({
    where: { activityRecord: { organizationId: org.id, reportingPeriodId, siteId: { in: effectiveSiteIds } } },
    include: { activityRecord: { include: { site: true } } },
  });
  const rows: ReportEmissionRow[] = emissionRecords.map((r) => ({
    scope: r.activityRecord.scope,
    scope3Category: r.activityRecord.scope3Category,
    siteId: r.activityRecord.siteId,
    siteName: r.activityRecord.site.name,
    emissionsKgCo2e: r.emissionsKgCo2e.toString(),
  }));
  const aggregate = aggregateEmissionsForReport(rows);
  const snapshot = buildSnapshot(aggregate, siteIds, expandedSiteIds);

  const factorSetsUsed = [...new Set(emissionRecords.map((r) => r.factorSource))];
  const calcEngineVersion = emissionRecords[0]?.calcEngineVersion ?? "n/a";

  const escapedOrgId = org.id.replace(/'/g, "''");
  const report = await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const created = await tx.report.create({
      data: {
        organizationId: org.id,
        reportingPeriodId,
        reportType: "EMISSIONS_SUMMARY",
        format,
        figuresSnapshot: snapshot,
        factorSetsUsed,
        calcEngineVersion,
        generatedById: membership.user.id,
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "EXPORT",
      entityType: "Report",
      entityId: created.id,
      after: { reportingPeriodId, siteIds, expandedSiteIds, format, totalKgCo2e: snapshot.totalKgCo2e },
    });
    return created;
  });

  revalidatePath("/reports");
  return { ok: true, reportId: report.id, figuresSnapshot: snapshot };
}
