import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { can } from "@/lib/auth/permissions";
import { RestatementDecision } from "./RestatementDecision";

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
  const userIds = [...new Set(restatements.flatMap((r) => [r.requestedById, r.approverId].filter((x): x is string => !!x)))];
  const users = userIds.length > 0 ? await rawPrisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userName = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <h1 className="text-xl font-semibold">Periods</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        A <span className="font-medium">LOCKED</span> period refuses edits — corrections go through restatement instead.
      </p>

      <div className="mt-5 overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Period</th>
              <th className="px-4 py-2.5">Dates</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Default factor set</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-2.5 font-medium">{p.label}</td>
                <td className="px-4 py-2.5 text-ink2">
                  {fmt(p.startsOn)} – {fmt(p.endsOn)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2.5 text-ink2">
                  {p.defaultFactorSet ? `${p.defaultFactorSet.publisher} ${p.defaultFactorSet.version}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
