import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export default async function MySubmissionsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const db = orgScopedClient(membership.org.id);
  const entries = await db.positionValue.findMany({
    where: { answeredById: membership.user.id, site: { organizationId: membership.org.id } },
    include: { position: true, site: true, period: true },
    orderBy: { answeredAt: "desc" },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">My Submissions</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Everything you&apos;ve entered, most recent first.</p>

      {entries.length === 0 ? (
        <p className="mt-5 rounded-[11px] border border-dashed border-border bg-surface p-4 text-[13px] text-muted">
          Nothing submitted yet.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-grid rounded-[11px] glass">
          {entries.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="text-[13.5px] font-medium">{v.position.labelKey}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {v.site.name} · {v.period.label} · {v.answeredAt ? v.answeredAt.toISOString().slice(0, 10) : "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] text-ink2">
                  {v.valueNumeric?.toString() ?? "—"} {v.unit}
                </span>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                    v.status === "DRAFT" ? "bg-track text-ink2" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  {v.status === "DRAFT" ? "Draft" : "Saved"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
