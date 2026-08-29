import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { PcafForm } from "./PcafForm";
import { SbtiForm } from "./SbtiForm";

export const dynamic = "force-dynamic";

export default async function CalculatorsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_questionnaire")) return <Denied role={membership.role} />;

  return (
    <>
      <h1 className="text-xl font-semibold">Calculators</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        Specialised methodologies alongside the main Scope 1/2/3 questionnaire. These are calculators, not
        questionnaire questions — nothing here is saved against a facility or reporting period yet.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PcafForm />
        <SbtiForm />
      </div>
    </>
  );
}
