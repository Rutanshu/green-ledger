import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { OrganisationForm } from "./OrganisationForm";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-grid px-4 py-3 text-[13px] last:border-0">
      <span className="text-ink2">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function OrganisationPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_org")) return <Denied role={membership.role} />;
  const org = membership.org;

  return (
    <>
      <h1 className="text-xl font-semibold">Company Structure</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        Consolidation approach and base year decide how every later number is scoped. Changing them after
        publication means restating figures.
      </p>

      <OrganisationForm
        legalName={org.legalName}
        consolidationApproach={org.consolidationApproach}
        baseYear={org.baseYear}
        baseYearRationale={org.baseYearRationale ?? ""}
        fiscalYearStartMonth={org.fiscalYearStartMonth}
        locale={org.locale}
      />

      <div className="mt-3 max-w-lg rounded-[11px] glass">
        <Row label="Default GWP set" value={org.defaultGwpSetId ?? "—"} />
      </div>
    </>
  );
}
