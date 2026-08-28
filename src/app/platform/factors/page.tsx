import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function PlatformFactorsPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));

  // emission_factor_sets' RLS policy is "organizationId IS NULL OR
  // organizationId = app.org_id" — an unscoped query would silently show
  // only the platform-global sets and hide every company's own. Looping
  // per org (withEachOrg) picks up both; global rows repeat across every
  // org's result since they always match the OR clause, so dedupe by id.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.emissionFactorSet.findMany({ include: { _count: { select: { factors: true } } } }),
  );
  const byId = new Map(perOrg.flat().map((s) => [s.id, s]));
  const sets = [...byId.values()].sort((a, b) => (a.organizationId ?? "").localeCompare(b.organizationId ?? "") || a.publisher.localeCompare(b.publisher));

  return (
    <>
      <PlatformHeader title="Emission Factors" body="Every factor set — platform-global (shared across every company) and company-specific." />
      <Table head={["Set", "Scope", "Region", "Factors", "Status"]}>
        {sets.map((s) => (
          <tr key={s.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5">
              <div className="font-medium text-white">
                {s.publisher} — {s.name} <span className="font-mono text-[11px] text-[#7a837e]">v{s.version}</span>
              </div>
            </td>
            <td className="px-4 py-2.5">
              {s.organizationId ? <Pill>{orgNameById.get(s.organizationId) ?? "—"}</Pill> : <Pill tone="good">Platform-global</Pill>}
            </td>
            <td className="px-4 py-2.5">{s.regionScope ?? "—"}</td>
            <td className="px-4 py-2.5">{s._count.factors}</td>
            <td className="px-4 py-2.5">{s.isActive ? <Pill tone="good">Active</Pill> : <Pill>Inactive</Pill>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
