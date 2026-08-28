import Link from "next/link";
import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { ACTION_LABEL, ENTITY_LABEL } from "@/lib/audit/labels";
import { PlatformHeader, Tile, Card } from "./_ui";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const [orgs, userCount] = await Promise.all([
    rawPrisma.organization.findMany({ select: { id: true } }),
    rawPrisma.user.count(),
  ]);
  const orgCount = orgs.length;
  // audit_events has FORCE RLS — see withEachOrg's comment in lib/db/tenant.ts.
  const perOrgEvents = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 8 }),
  );
  const recentEvents = perOrgEvents.flat().sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 8);

  return (
    <>
      <PlatformHeader title="Platform Overview" body="Across every company — no single company's emissions figures shown here." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Companies" value={String(orgCount)} />
        <Tile label="Platform users" value={String(userCount)} />
        <Tile label="Open support items" value="0" note="no queue built yet" />
        <Tile label="Recent activity" value={String(recentEvents.length)} note="last 8 events" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-[#9aa39d]">Recent system activity</div>
          <div className="flex flex-col gap-2">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex justify-between text-[12.5px] text-[#c7cbc4]">
                <span>
                  {ACTION_LABEL[e.action] ?? e.action} {ENTITY_LABEL[e.entityType] ?? e.entityType.toLowerCase()}
                </span>
                <span className="font-mono text-[#7a837e]">{e.occurredAt.toISOString().slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
          <Link href="/platform/logs" className="mt-3 inline-block text-[12.5px] font-medium text-[#6ecda8] hover:underline">
            View full System Logs →
          </Link>
        </Card>
        <Card>
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-[#9aa39d]">Get started</div>
          <div className="flex flex-col gap-2 text-[13px] text-[#c7cbc4]">
            <Link href="/platform/companies" className="hover:text-white hover:underline">
              Onboard a new company →
            </Link>
            <Link href="/platform/users" className="hover:text-white hover:underline">
              See everyone with access →
            </Link>
            <Link href="/platform/support" className="hover:text-white hover:underline">
              Step into a company&rsquo;s view to help →
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
