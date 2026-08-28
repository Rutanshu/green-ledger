import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { ACTION_LABEL, ENTITY_LABEL } from "@/lib/audit/labels";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_org")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);

  const [events, memberships] = await Promise.all([
    db.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 100 }),
    db.membership.findMany({ include: { user: true } }),
  ]);
  const nameByUserId = new Map(memberships.map((m) => [m.userId, m.user.name ?? m.user.email]));

  return (
    <>
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Every change that matters, in order — most recent first. The last 100 events.</p>

      {events.length === 0 ? (
        <p className="mt-5 rounded-[11px] border border-dashed border-border bg-surface p-4 text-[13px] text-muted">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-[11px] glass">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">What happened</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-grid last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink2">
                    {e.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-2.5">{e.actorUserId ? (nameByUserId.get(e.actorUserId) ?? "Unknown") : "System"}</td>
                  <td className="px-4 py-2.5">
                    {ACTION_LABEL[e.action] ?? e.action} {ENTITY_LABEL[e.entityType] ?? e.entityType.toLowerCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
