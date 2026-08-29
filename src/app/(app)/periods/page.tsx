import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { can } from "@/lib/auth/permissions";
import { RestatementDecision } from "./RestatementDecision";
import { LockPeriodButton } from "./LockPeriodButton";
import { getPeriodReadinessAction, type PeriodReadiness } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-track text-ink2",
  IN_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  LOCKED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ASSURED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const RESTATEMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default async function PeriodsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const org = membership.org;
  const canDecide = can(membership.role, "manage_questionnaire");
  const canLock = can(membership.role, "manage_org");
  const db = orgScopedClient(org.id);

  const [periods, restatements] = await Promise.all([
    db.reportingPeriod.findMany({
      include: { defaultFactorSet: true },
      orderBy: { startsOn: "desc" },
    }),
    db.restatement.findMany({
      include: { period: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const openPeriods = periods.filter((p) => p.status === "DRAFT" || p.status === "IN_REVIEW");
  const readinessByPeriod = new Map<string, PeriodReadiness>();
  if (canLock) {
    for (const p of openPeriods) {
      const readiness = await getPeriodReadinessAction(p.id);
      if (readiness) readinessByPeriod.set(p.id, readiness);
    }
  }

  const restatementUserIds = restatements.flatMap((r) => [r.requestedById, r.approverId].filter((x): x is string => !!x));
  const lockedByIds = periods.map((p) => p.lockedById).filter((x): x is string => !!x);
  const userIds = [...new Set([...restatementUserIds, ...lockedByIds])];
  const users = userIds.length > 0 ? await rawPrisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userName = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtDateTime = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

  return (
    <>
      <h1 className="text-xl font-semibold">Periods</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        A <span className="font-medium">LOCKED</span> period refuses edits — corrections go through restatement instead.
        There's no unlock: locking is a one-way, checked, audited step.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {periods.map((p) => {
          const readiness = readinessByPeriod.get(p.id);
          return (
            <div key={p.id} className="rounded-[11px] glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink2">
                    {fmt(p.startsOn)} – {fmt(p.endsOn)} ·{" "}
                    {p.defaultFactorSet ? `${p.defaultFactorSet.publisher} ${p.defaultFactorSet.version}` : "no default factor set"}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              </div>

              {(p.status === "LOCKED" || p.status === "ASSURED") && p.lockedAt && (
                <div className="mt-2 border-t border-grid pt-2 text-[12px] text-muted">
                  Locked by {p.lockedById ? (userName.get(p.lockedById) ?? "unknown") : "unknown"} · {fmtDateTime(p.lockedAt)}
                </div>
              )}

              {canLock && readiness && <LockPeriodButton periodId={p.id} readiness={readiness} />}
            </div>
          );
        })}
      </div>

      {restatements.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold">Restatements</h2>
          <p className="mt-0.5 text-[13px] text-ink2">
            Corrections requested against a locked period. Approving one requires a different person from whoever requested it.
          </p>
          <div className="mt-3 overflow-x-auto rounded-[11px] glass">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Requested by</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {restatements.map((r) => (
                  <tr key={r.id} className="border-b border-grid last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.period.label}</td>
                    <td className="px-4 py-2.5 text-ink2">{r.reason}</td>
                    <td className="px-4 py-2.5 text-ink2">{userName.get(r.requestedById) ?? r.requestedById}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESTATEMENT_STATUS_STYLE[r.status] ?? "bg-track text-ink2"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {canDecide && r.status === "PENDING" && (
                        <RestatementDecision restatementId={r.id} disabled={r.requestedById === membership.user.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
