import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { ACTION_LABEL, ENTITY_LABEL } from "@/lib/audit/labels";
import { PlatformHeader, Table } from "../_ui";

export const dynamic = "force-dynamic";

export default async function SystemLogsPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));

  // audit_events has FORCE RLS — see withEachOrg's comment.
  const perOrgEvents = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 150 }),
  );
  const events = perOrgEvents.flat().sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 150);

  const userIds = [...new Set(events.map((e) => e.actorUserId).filter((id): id is string => !!id))];
  const users = userIds.length ? await rawPrisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  return (
    <>
      <PlatformHeader title="System Logs" body="Every audit event across every company — the last 150." />
      <Table head={["When", "Company", "Who", "What happened"]}>
        {events.map((e) => (
          <tr key={e.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11.5px] text-[#9aa39d]">
              {e.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
            </td>
            <td className="px-4 py-2.5">{orgNameById.get(e.organizationId) ?? "—"}</td>
            <td className="px-4 py-2.5">{e.actorUserId ? (nameById.get(e.actorUserId) ?? "Unknown") : "System"}</td>
            <td className="px-4 py-2.5">
              {ACTION_LABEL[e.action] ?? e.action} {ENTITY_LABEL[e.entityType] ?? e.entityType.toLowerCase()}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
