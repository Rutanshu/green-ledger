import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../../_components/Denied";
import { ReportCharts, type FiguresSnapshot } from "../ReportCharts";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "view")) return <Denied role={membership.role} />;

  const db = orgScopedClient(membership.org.id);
  const report = await db.report.findFirst({ where: { id }, include: { period: true } });
  if (!report) notFound();

  const figures = report.figuresSnapshot as unknown as FiguresSnapshot;

  return (
    <>
      <Link href="/reports" className="text-[13px] font-medium text-accent hover:underline">
        ← Reports
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{report.period.label}</h1>
          <p className="mt-0.5 text-[13px] text-ink2">
            Generated {report.generatedAt.toISOString().slice(0, 16).replace("T", " ")} · engine {report.calcEngineVersion}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/reports/${report.id}/export?format=csv`} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-track">
            Download CSV
          </a>
          <a href={`/reports/${report.id}/export?format=json`} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-track">
            Download JSON
          </a>
        </div>
      </div>

      <ReportCharts figures={figures} />

      {figures.bySite.length > 0 && (
        <div className="mt-3 rounded-[11px] glass p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">By facility, table view</div>
          <div className="flex flex-col gap-1 text-[13px]">
            {figures.bySite.map((s) => (
              <div key={s.siteId} className="flex justify-between">
                <span className="text-ink2">{s.siteName}</span>
                <span className="font-medium">{(Number(s.kgCo2e) / 1000).toFixed(2)} t</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
