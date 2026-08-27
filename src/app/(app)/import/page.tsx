import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { ImportForm } from "./ImportForm";
import { BatchActions } from "./BatchActions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-track text-ink2",
  DRY_RUN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  COMMITTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  REVERTED: "bg-track text-muted",
};

export default async function ImportPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canImport = can(membership.role, "submit_answers");
  if (!canImport) return <p className="text-[13px] text-muted">You don&apos;t have access to Import.</p>;

  const org = membership.org;
  const db = orgScopedClient(org.id);

  const [periods, mappingProfiles, batches] = await Promise.all([
    db.reportingPeriod.findMany({ orderBy: { startsOn: "desc" } }),
    db.mappingProfile.findMany({ orderBy: { name: "asc" } }),
    db.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { rows: { where: { status: "REJECTED" }, orderBy: { rowNumber: "asc" }, take: 20 } },
    }),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold">Import</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        A staged import touches nothing live until you commit it. CSV columns: <code className="font-mono">site_code, question_code, value, unit, data_quality</code>{" "}
        (or map your own header names to a saved profile).
      </p>

      <div className="mt-5">
        <ImportForm periods={periods.map((p) => ({ id: p.id, label: p.label }))} mappingProfiles={mappingProfiles.map((p) => ({ id: p.id, name: p.name }))} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {batches.map((b) => (
          <div key={b.id} className="rounded-[11px] glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.filename}</div>
                <div className="mt-0.5 text-xs text-ink2">
                  {b.rowCount} rows · {b.rowsAccepted} accepted · {b.rowsRejected} rejected · {b.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                <BatchActions batchId={b.id} status={b.status} />
              </div>
            </div>
            {b.rows.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <th className="py-1 pr-3">Row</th>
                    <th className="py-1 pr-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r) => (
                    <tr key={r.id} className="border-t border-grid/60">
                      <td className="py-1 pr-3 font-mono">{r.rowNumber}</td>
                      <td className="py-1 pr-3 text-crit">{r.errorMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {batches.length === 0 && <p className="text-[13px] text-muted">No imports yet.</p>}
      </div>
    </>
  );
}
