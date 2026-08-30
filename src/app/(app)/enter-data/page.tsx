import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { isPeriodWritable } from "@/lib/periods";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Denied } from "../_components/Denied";
import { EnterDataWizard, type WizardSite } from "./EnterDataWizard";

export const dynamic = "force-dynamic";

export default async function EnterDataPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "submit_answers")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);
  const labelOverrides = await getOrgLabelOverrides(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      // Excludes the pre-split "Standard Operations" template (ARCHIVED,
      // kept only for history) — nothing left in it to enter.
      assignments: {
        where: { template: { status: { not: "ARCHIVED" } } },
        include: {
          period: true,
          template: { include: { sections: { include: { questions: true } } } },
        },
      },
    },
  });

  // A facility can hold up to 17 assignments now — one wizard "site" step
  // per (site, assignment), not per site, since each scope is submitted
  // and reviewed independently.
  const writableEntries = sites.flatMap((s) => s.assignments.filter((a) => isPeriodWritable(a.period.status)).map((assignment) => ({ site: s, assignment })));

  const positionValues = await db.positionValue.findMany({
    where: { siteId: { in: writableEntries.map((e) => e.site.id) } },
    include: { position: true },
  });
  const valueByKey = new Map(
    positionValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]),
  );

  // Prior period's value, for the "last time you entered this" comparison
  // on the value step — looked up directly rather than trusting
  // PositionValue.priorPeriodValue, which nothing in this codebase writes yet.
  const periodIds = [...new Set(writableEntries.map((e) => e.assignment.reportingPeriodId))];
  const periods = await db.reportingPeriod.findMany({ where: { id: { in: periodIds } } });
  const priorPeriods = await db.reportingPeriod.findMany({
    where: { endsOn: { lt: periods.length ? new Date(Math.min(...periods.map((p) => p.startsOn.getTime()))) : new Date(0) } },
    orderBy: { endsOn: "desc" },
  });
  const priorPeriodByCurrentId = new Map<string, (typeof priorPeriods)[number]>();
  for (const p of periods) {
    const prior = priorPeriods.find((pp) => pp.endsOn < p.startsOn);
    if (prior) priorPeriodByCurrentId.set(p.id, prior);
  }
  const priorIds = [...new Set([...priorPeriodByCurrentId.values()].map((p) => p.id))];
  const priorValues = priorIds.length
    ? await db.positionValue.findMany({
        where: { siteId: { in: writableEntries.map((e) => e.site.id) }, reportingPeriodId: { in: priorIds } },
        include: { position: true },
      })
    : [];
  const priorByKey = new Map(
    priorValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]),
  );

  const wizardSites: WizardSite[] = writableEntries.map(({ site, assignment }) => {
    const questions = assignment.template.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.allowedUnits.length > 0);
    const priorPeriod = priorPeriodByCurrentId.get(assignment.reportingPeriodId);

    return {
      siteId: site.id,
      siteName: site.name,
      siteCode: site.code,
      scopeLabel: assignment.template.name,
      assignmentId: assignment.id,
      periodLabel: assignment.period.label,
      questions: questions.map((q) => {
        const v = valueByKey.get(`${site.id}:${assignment.reportingPeriodId}:${q.code}`);
        const prior = priorPeriod ? priorByKey.get(`${site.id}:${priorPeriod.id}:${q.code}`) : undefined;
        return {
          questionId: q.id,
          code: q.code,
          label: q.label,
          helpText: q.helpText,
          allowedUnits: q.allowedUnits,
          evidenceRequired: q.evidenceRequired,
          existing: v
            ? {
                value: v.valueNumeric?.toString() ?? "",
                unit: v.unit ?? "",
                quality: v.dataQuality ?? "ESTIMATED",
                comment: v.comment ?? "",
                updatedAt: v.updatedAt.toISOString(),
                status: v.status,
              }
            : null,
          prior:
            prior && prior.valueNumeric != null
              ? { value: prior.valueNumeric.toString(), unit: prior.unit ?? "", periodLabel: priorPeriod!.label }
              : null,
        };
      }),
    };
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Enter Data</h1>
      <p className="mt-1 text-[14px] text-ink2">One item at a time — pick a facility, then work through it step by step.</p>
      <EnterDataWizard sites={wizardSites} labelOverrides={labelOverrides} />
    </>
  );
}
