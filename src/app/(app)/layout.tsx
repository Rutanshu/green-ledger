import { redirect } from "next/navigation";
import { AppShell } from "./AppShell";
import { DataUserShell } from "./_shells/DataUserShell";
import { ImpersonationBanner } from "./_shells/ImpersonationBanner";
import { getCurrentMembership } from "@/lib/demo-org";
import { getImpersonator } from "@/lib/session";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  const userName = membership.user.name ?? membership.user.email;
  const impersonator = await getImpersonator();

  // Data User portal: Data Inputter and Read Only get the small, guided
  // shell (spec §02) instead of the full admin nav — Read Only renders it
  // with every write control disabled rather than getting a separate
  // fourth portal (per the redesign's own scoping decision).
  if (membership.role === "DATA_INPUTTER" || membership.role === "READ_ONLY") {
    return (
      <>
        {impersonator && <ImpersonationBanner />}
        <DataUserShell orgName={membership.org.legalName} userName={userName} role={membership.role}>
          {children}
        </DataUserShell>
      </>
    );
  }

  return (
    <>
      {impersonator && <ImpersonationBanner />}
      <AppShell orgName={membership.org.legalName} userName={userName} role={membership.role}>
        {children}
      </AppShell>
    </>
  );
}
