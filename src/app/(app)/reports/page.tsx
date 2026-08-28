import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { ReportWizardForm } from "./ReportWizardForm";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_questionnaire")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);

  const [periods, sites, pastReports] = await Promise.all([
    db.reportingPeriod.findMany({ orderBy: { startsOn: "desc" } }),
    db.site.findMany({ orderBy: { code: "asc" } }),
    db.report.findMany({ orderBy: { generatedAt: "desc" }, take: 10, include: { period: true } }),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Build a report from approved data — every figure traces back to its source.</p>

      <ReportWizardForm
        periods={periods.map((p) => ({ id: p.id, label: p.label, status: p.status }))}
        sites={sites.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />

      {pastReports.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">Previously generated</h2>
          <div className="divide-y divide-grid rounded-[11px] glass">
            {pastReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3.5 text-[13.5px]">
                <div>
                  <div className="font-medium">{r.period.label}</div>
                  <div className="text-xs text-muted">{r.generatedAt.toISOString().slice(0, 16).replace("T", " ")}</div>
                </div>
                <div className="flex gap-2">
                  <a href={`/reports/${r.id}/export?format=csv`} className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-track">
                    CSV
                  </a>
                  <a href={`/reports/${r.id}/export?format=json`} className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-track">
                    JSON
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
