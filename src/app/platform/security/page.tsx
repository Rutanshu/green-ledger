import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Card, Table } from "../_ui";

export const dynamic = "force-dynamic";

const LAYERS = [
  {
    title: "Layer 1 — application scoping",
    body: "Every tenant-owned query runs through orgScopedClient(), a Prisma extension that injects organization_id into every where/create automatically. Catches developer mistakes before they reach the database.",
  },
  {
    title: "Layer 2 — Postgres row-level security",
    body: "Independent of the application layer — FORCE ROW LEVEL SECURITY policies on tenant tables enforce the same boundary at the database itself, keyed off app.org_id set per request, and apply even to the owning role. Fails closed: unset app.org_id returns zero rows, not every row.",
  },
  {
    title: "Layer 3 — this portal",
    body: "Cross-company screens (Companies, Global Users, System Logs, this page) are the one deliberate exception — gated behind manage_platform, not per-org scoping. Reading an RLS-protected table across every company means looping app.org_id per org (withEachOrg), since no BYPASSRLS role is deployed yet.",
  },
] as const;

export default async function SecurityPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));

  // entitlements has FORCE RLS — see withEachOrg's comment.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.entitlement.findMany(),
  );
  const entitlements = perOrg.flat();

  return (
    <>
      <PlatformHeader title="Security" body="How tenant isolation actually works, and what's entitled per company." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {LAYERS.map((l) => (
          <Card key={l.title}>
            <div className="text-[13px] font-semibold text-white">{l.title}</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9aa39d]">{l.body}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-2.5 mt-8 font-mono text-[11px] uppercase tracking-wide text-[#9aa39d]">Entitlements</h2>
      {entitlements.length === 0 ? (
        <p className="text-[13px] text-[#9aa39d]">
          No entitlement rows exist — every company is unrestricted by default (absence of a row means unlimited, per the model&rsquo;s own design).
        </p>
      ) : (
        <Table head={["Company", "Feature", "Enabled", "Limit"]}>
          {entitlements.map((e) => (
            <tr key={e.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
              <td className="px-4 py-2.5">{orgNameById.get(e.organizationId) ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono text-[12px]">{e.featureCode}</td>
              <td className="px-4 py-2.5">{e.enabled ? "Yes" : "No"}</td>
              <td className="px-4 py-2.5">{e.limitValue ?? "Unlimited"}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
