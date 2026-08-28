import { rawPrisma } from "@/lib/db/client";
import { withEachOrg } from "@/lib/db/tenant";
import { PlatformHeader, Table, Pill } from "../_ui";
import { CreateCompanyForm } from "./CreateCompanyForm";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const orgs = await rawPrisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  // sites and reporting_periods carry FORCE RLS keyed on app.org_id — a
  // plain cross-org rawPrisma query silently returns zero rows for both,
  // not an error, so this has to go through withEachOrg. See its comment
  // in lib/db/tenant.ts.
  const perOrg = await withEachOrg(
    orgs.map((o) => o.id),
    async (tx, orgId) => {
      const [siteCount, submittedCount, lockedCount] = await Promise.all([
        tx.site.count(),
        tx.positionValue.count({ where: { status: "ANSWERED", site: { organizationId: orgId } } }),
        tx.reportingPeriod.count({ where: { status: { in: ["LOCKED", "ASSURED"] } } }),
      ]);
      return { orgId, siteCount, submittedCount, lockedCount };
    },
  );
  const statsByOrg = new Map(perOrg.map((p) => [p.orgId, p]));

  return (
    <>
      <PlatformHeader title="Companies" body="Every client company on the platform, and how far into onboarding each one is." />

      <div className="mb-6">
        <CreateCompanyForm />
      </div>

      <Table head={["Company", "Facilities", "First submission", "First period locked", "Members"]}>
        {orgs.map((org) => {
          const stats = statsByOrg.get(org.id);
          return (
            <tr key={org.id} className="border-b border-white/10 text-[#c7cbc4] last:border-0">
              <td className="px-4 py-2.5 font-medium text-white">{org.legalName}</td>
              <td className="px-4 py-2.5">{stats?.siteCount ?? 0}</td>
              <td className="px-4 py-2.5">
                {stats && stats.submittedCount > 0 ? <Pill tone="good">Started</Pill> : <Pill>Not yet</Pill>}
              </td>
              <td className="px-4 py-2.5">
                {stats && stats.lockedCount > 0 ? <Pill tone="good">Locked</Pill> : <Pill>Not yet</Pill>}
              </td>
              <td className="px-4 py-2.5">{org._count.memberships}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
