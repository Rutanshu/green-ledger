/**
 * One-off, idempotent migration: splits each org's single omnibus
 * questionnaire template ("Standard Operations") into 17 real per-scope
 * templates — Scope 1, Scope 2, Scope 3.1 through 3.15 — instead of one
 * template with a client-side scope filter. See the plan at
 * /Users/rutanshu/.claude/plans/imperative-coalescing-hollerith.md.
 *
 * Reassigns each existing QuestionnaireSection to its matching new
 * template by the section's own (scope, scope3Category) fields — already
 * populated correctly on every row, nothing to infer. Question rows
 * cascade via sectionId, untouched. The old template is archived (never
 * deleted) once it has zero sections left, so old QuestionnaireAssignment
 * history stays valid.
 *
 * Then backfills one QuestionnaireAssignment per (site, period, new
 * template) for every site that already had an assignment against the
 * old template — skipping any scope with zero applicable (required +
 * visible) questions for that site, using the exact same
 * computeCompleteness/evaluateVisibility pair submitAnswer() uses live.
 * Approval state is carried forward: if the old assignment was
 * APPROVED/LOCKED and every PositionValue for this scope's questions is
 * itself APPROVED, the new assignment starts at that same status with the
 * same approver/timestamps — the sign-off already happened once at the
 * whole-questionnaire level; splitting the record shouldn't erase it.
 *
 * Safe to re-run: every create is guarded by an existence check, matching
 * the idiom in prisma/backfill-full-scope-questionnaire.ts.
 *
 * Run with: npx tsx prisma/split-questionnaire-by-scope.ts
 */
import { adminPrisma as db } from "../src/lib/db/admin-client";
import { computeCompleteness, type VisibilityContext, type VisibilityRule } from "../src/lib/visibility";
import type { AssignmentStatus } from "../src/lib/assignments";

interface ScopeTemplateDef {
  key: string;
  scope: "SCOPE_1" | "SCOPE_2" | "SCOPE_3";
  cat: number | null;
  name: string;
}

const SCOPE_TEMPLATES: ScopeTemplateDef[] = [
  { key: "SCOPE_1", scope: "SCOPE_1", cat: null, name: "Scope 1" },
  { key: "SCOPE_2", scope: "SCOPE_2", cat: null, name: "Scope 2" },
  { key: "SCOPE_3.1", scope: "SCOPE_3", cat: 1, name: "Scope 3.1 — Purchased Goods & Services" },
  { key: "SCOPE_3.2", scope: "SCOPE_3", cat: 2, name: "Scope 3.2 — Capital Goods" },
  { key: "SCOPE_3.3", scope: "SCOPE_3", cat: 3, name: "Scope 3.3 — Fuel- and Energy-Related Activities" },
  { key: "SCOPE_3.4", scope: "SCOPE_3", cat: 4, name: "Scope 3.4 — Upstream Transportation & Distribution" },
  { key: "SCOPE_3.5", scope: "SCOPE_3", cat: 5, name: "Scope 3.5 — Waste Generated in Operations" },
  { key: "SCOPE_3.6", scope: "SCOPE_3", cat: 6, name: "Scope 3.6 — Business Travel" },
  { key: "SCOPE_3.7", scope: "SCOPE_3", cat: 7, name: "Scope 3.7 — Employee Commuting" },
  { key: "SCOPE_3.8", scope: "SCOPE_3", cat: 8, name: "Scope 3.8 — Upstream Leased Assets" },
  { key: "SCOPE_3.9", scope: "SCOPE_3", cat: 9, name: "Scope 3.9 — Downstream Transportation & Distribution" },
  { key: "SCOPE_3.10", scope: "SCOPE_3", cat: 10, name: "Scope 3.10 — Processing of Sold Products" },
  { key: "SCOPE_3.11", scope: "SCOPE_3", cat: 11, name: "Scope 3.11 — Use of Sold Products" },
  { key: "SCOPE_3.12", scope: "SCOPE_3", cat: 12, name: "Scope 3.12 — End-of-Life Treatment of Sold Products" },
  { key: "SCOPE_3.13", scope: "SCOPE_3", cat: 13, name: "Scope 3.13 — Downstream Leased Assets" },
  { key: "SCOPE_3.14", scope: "SCOPE_3", cat: 14, name: "Scope 3.14 — Franchises" },
  { key: "SCOPE_3.15", scope: "SCOPE_3", cat: 15, name: "Scope 3.15 — Investments" },
];

function scopeKeyOf(scope: string, cat: number | null): string {
  return scope === "SCOPE_3" ? `SCOPE_3.${cat}` : scope;
}

async function migrateOrg(orgId: string, orgName: string) {
  const oldTemplate = await db.questionnaireTemplate.findFirst({
    where: { organizationId: orgId, status: "PUBLISHED" },
    include: { sections: { include: { questions: true } } },
  });
  if (!oldTemplate) {
    console.log(`[${orgName}] no published template — skipping.`);
    return;
  }
  if (oldTemplate.name !== "Standard Operations") {
    console.log(`[${orgName}] published template is "${oldTemplate.name}", not "Standard Operations" — already split, or genuinely different. Skipping.`);
    return;
  }

  console.log(`[${orgName}] splitting "${oldTemplate.name}" (${oldTemplate.sections.length} sections)…`);

  const newTemplateByKey = new Map<string, { id: string }>();
  for (const t of SCOPE_TEMPLATES) {
    let row = await db.questionnaireTemplate.findFirst({ where: { organizationId: orgId, name: t.name, version: 1 } });
    if (!row) {
      const matchingSections = oldTemplate.sections.filter((s) => s.scope === t.scope && (s.scope3Category ?? null) === t.cat);
      const hasContent = matchingSections.some((s) => s.questions.length > 0);
      row = await db.questionnaireTemplate.create({
        data: {
          organizationId: orgId,
          name: t.name,
          version: 1,
          status: hasContent ? "PUBLISHED" : "DRAFT",
          appliesToSiteTypes: oldTemplate.appliesToSiteTypes,
          publishedAt: hasContent ? oldTemplate.publishedAt : null,
          publishedById: hasContent ? oldTemplate.publishedById : null,
        },
      });
      console.log(`  created template "${t.name}" (${row.status})`);
    }
    newTemplateByKey.set(t.key, row);
  }

  let movedSections = 0;
  for (const section of oldTemplate.sections) {
    const key = scopeKeyOf(section.scope, section.scope3Category);
    const target = newTemplateByKey.get(key);
    if (!target) {
      console.warn(`  WARNING: section "${section.title}" has no matching new template (scope=${section.scope}, cat=${section.scope3Category}) — left in place.`);
      continue;
    }
    if (section.templateId === target.id) continue; // already moved — idempotent re-run
    await db.questionnaireSection.update({ where: { id: section.id }, data: { templateId: target.id } });
    movedSections++;
  }
  console.log(`  moved ${movedSections} sections.`);

  const remaining = await db.questionnaireSection.count({ where: { templateId: oldTemplate.id } });
  if (remaining === 0 && oldTemplate.status !== "ARCHIVED") {
    await db.questionnaireTemplate.update({ where: { id: oldTemplate.id }, data: { status: "ARCHIVED" } });
    console.log(`  archived old template (0 sections remaining).`);
  } else if (remaining > 0) {
    console.warn(`  WARNING: old template still has ${remaining} section(s) — not archiving.`);
  }

  // Backfill per-scope assignments for every (site, period) that already
  // had an assignment against the old template.
  const sites = await db.site.findMany({ where: { organizationId: orgId }, include: { assets: true } });
  const oldAssignments = await db.questionnaireAssignment.findMany({ where: { templateId: oldTemplate.id, site: { organizationId: orgId } } });
  const periodIds = [...new Set(oldAssignments.map((a) => a.reportingPeriodId))];

  for (const periodId of periodIds) {
    const period = await db.reportingPeriod.findFirstOrThrow({ where: { id: periodId } });

    for (const site of sites) {
      const oldAssignment = oldAssignments.find((a) => a.siteId === site.id && a.reportingPeriodId === periodId);
      if (!oldAssignment) continue;

      for (const t of SCOPE_TEMPLATES) {
        const newTemplate = newTemplateByKey.get(t.key)!;
        const alreadyExists = await db.questionnaireAssignment.findFirst({
          where: { siteId: site.id, reportingPeriodId: periodId, templateId: newTemplate.id },
        });
        if (alreadyExists) continue;

        const questions = await db.question.findMany({ where: { section: { templateId: newTemplate.id } } });
        if (questions.length === 0) continue;

        const positionValues = await db.positionValue.findMany({
          where: { siteId: site.id, reportingPeriodId: periodId, position: { positionCode: { in: questions.map((q) => q.code) } } },
          include: { position: true },
        });
        const valueByCode = new Map(positionValues.map((v) => [v.position.positionCode, v]));

        const ctx: VisibilityContext = {
          siteType: site.siteType,
          siteCountry: site.country,
          assets: site.assets.map((a) => ({
            category: a.category,
            assetTypeCode: a.assetTypeCode,
            fuelOrMaterialCode: a.fuelOrMaterialCode,
            status: a.status as never,
            commissionedOn: a.commissionedOn,
            decommissionedOn: a.decommissionedOn,
          })),
          answers: {},
          periodStart: period.startsOn,
          periodEnd: period.endsOn,
        };
        const completeness = computeCompleteness(
          {
            questions: questions.map((q) => ({ code: q.code, isRequired: q.isRequired, visibleIf: q.visibleIf as VisibilityRule | null })),
            satisfied: new Set(
              [...valueByCode.entries()].filter(([, v]) => v.status === "ANSWERED" || v.status === "APPROVED").map(([code]) => code),
            ),
          },
          ctx,
        );
        // Nothing in this scope actually applies to this site (e.g. no
        // required-and-visible questions) — don't create a trivially
        // "100% complete" assignment for a scope the site doesn't use.
        if (completeness.applicable === 0) continue;

        const relevantValues = questions.map((q) => valueByCode.get(q.code)).filter((v): v is NonNullable<typeof v> => !!v);
        const allApproved = relevantValues.length > 0 && relevantValues.every((v) => v.status === "APPROVED");

        let status: AssignmentStatus;
        if ((oldAssignment.status === "APPROVED" || oldAssignment.status === "LOCKED") && allApproved) {
          status = oldAssignment.status as AssignmentStatus;
        } else if (oldAssignment.status === "IN_REVIEW") {
          status = "IN_REVIEW";
        } else if (completeness.pct === 0) {
          status = "NOT_STARTED";
        } else {
          status = "IN_PROGRESS";
        }
        const carriesSubmission = status === "IN_REVIEW" || status === "APPROVED" || status === "LOCKED";
        const carriesApproval = status === "APPROVED" || status === "LOCKED";

        await db.questionnaireAssignment.create({
          data: {
            templateId: newTemplate.id,
            siteId: site.id,
            reportingPeriodId: periodId,
            assignedToId: oldAssignment.assignedToId,
            dueOn: oldAssignment.dueOn,
            status,
            completenessPct: completeness.pct,
            submittedById: carriesSubmission ? oldAssignment.submittedById : null,
            submittedAt: carriesSubmission ? oldAssignment.submittedAt : null,
            approverId: carriesApproval ? oldAssignment.approverId : null,
            approvedAt: carriesApproval ? oldAssignment.approvedAt : null,
          },
        });
        console.log(`  ${site.code} / ${t.name}: ${status} (${completeness.satisfied}/${completeness.applicable})`);
      }
    }
  }

  console.log(`[${orgName}] done.\n`);
}

async function main() {
  const orgs = await db.organization.findMany();
  for (const org of orgs) {
    await migrateOrg(org.id, org.legalName);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
