import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Table, Pill } from "../_ui";

export const dynamic = "force-dynamic";

export default async function PlatformRulesPage() {
  const orgs = await rawPrisma.organization.findMany({ select: { id: true, legalName: true } });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.legalName]));

  // rules and rule_violations both have FORCE RLS — see withEachOrg's comment.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    (tx) => tx.rule.findMany({ include: { _count: { select: { violations: true } } }, orderBy: { name: "asc" } }),
  );
  const rules = perOrg.flat();

  return (
    <>
      <PlatformHeader
        title="Calculations"
        body="Data-quality rules across every company. No screen anywhere authors a Rule yet — evaluation is live, authoring isn't."
      />
      <Table head={["Rule", "Company", "Type", "Severity", "Open flags", "Status"]}>
        {rules.map((r) => (
          <tr key={r.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
            <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
            <td className="px-4 py-2.5">{orgNameById.get(r.organizationId) ?? "—"}</td>
            <td className="px-4 py-2.5 font-mono text-[11.5px]">{r.type}</td>
            <td className="px-4 py-2.5">
              <Pill tone={r.severity === "BLOCK" ? "warn" : "neutral"}>{r.severity}</Pill>
            </td>
            <td className="px-4 py-2.5">{r._count.violations}</td>
            <td className="px-4 py-2.5">{r.isActive ? <Pill tone="good">Active</Pill> : <Pill>Inactive</Pill>}</td>
          </tr>
        ))}
      </Table>
      {rules.length === 0 && <p className="mt-4 text-[13px] text-[#9aa39d]">No rules configured anywhere yet.</p>}
    </>
  );
}
