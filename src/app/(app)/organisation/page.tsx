import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { CONSOLIDATION_LABEL } from "@/lib/org/consolidationLabel";

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
      <h1 className="text-xl font-semibold">Organisation</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        Consolidation approach and base year decide how every later number is scoped. Changing them after
        publication means restating figures.
      </p>

      <div className="mt-5 max-w-lg rounded-[11px] glass">
        <Row label="Legal name" value={org.legalName} />
        <Row label="How you count shared sites" value={CONSOLIDATION_LABEL[org.consolidationApproach] ?? org.consolidationApproach} />
        <Row label="Base year" value={String(org.baseYear ?? "—")} />
        <Row label="Base year rationale" value={org.baseYearRationale ?? "—"} />
        <Row label="Fiscal year starts" value={`month ${org.fiscalYearStartMonth}`} />
        <Row label="Locale" value={org.locale} />
        <Row label="Default GWP set" value={org.defaultGwpSetId ?? "—"} />
      </div>
    </>
  );
}
