import Link from "next/link";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "view")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      assignments: {
        include: { template: { include: { sections: { include: { questions: true } } } }, period: true },
      },
    },
  });

  const positionValues = await db.positionValue.findMany({
    where: { siteId: { in: sites.map((s) => s.id) } },
    include: { position: true },
  });
  const valueByKey = new Map(
    positionValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]),
  );

  const rows = sites.map((site) => {
    const assignment = site.assignments[0];
    const questions = assignment
      ? assignment.template.sections.flatMap((s) => s.questions).filter((q) => q.isRequired && q.allowedUnits.length > 0)
      : [];
    const answered = questions.filter((q) => {
      const v = valueByKey.get(`${site.id}:${assignment!.reportingPeriodId}:${q.code}`);
      return v?.status === "ANSWERED";
    });
    const outstanding = questions.filter((q) => !answered.includes(q));
    return { site, assignment, total: questions.length, answered: answered.length, outstanding };
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Reporting Progress</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Where each facility stands, and exactly what's still missing.</p>

      <div className="mt-5 flex flex-col gap-3">
        {rows.map(({ site, assignment, total, answered, outstanding }) => (
          <div key={site.id} className="glass rounded-[11px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  {site.name} <span className="font-normal text-muted">({site.code})</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink2">
                  {assignment ? `${assignment.period.label} · ${answered} of ${total} required items answered` : "No assignment yet"}
                </div>
              </div>
              {assignment && (
                <div className="flex items-center gap-2">
                  <div className="h-[7px] w-32 overflow-hidden rounded-full bg-track">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${total === 0 ? 100 : Math.round((answered / total) * 100)}%` }} />
                  </div>
                  <Link href="/review" className="text-[12.5px] font-medium text-accent hover:underline">
                    Review
                  </Link>
                </div>
              )}
            </div>
            {outstanding.length > 0 && (
              <div className="mt-2 text-[12.5px] text-muted">
                Still needed: {outstanding.map((q) => formatQuestionLabel(q.label, assignment!.period.label)).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
