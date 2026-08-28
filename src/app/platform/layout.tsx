import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { getImpersonator } from "@/lib/session";
import { SuperAdminShell } from "../(app)/_shells/SuperAdminShell";
import { ImpersonationBanner } from "../(app)/_shells/ImpersonationBanner";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (!can(membership.role, "manage_platform")) redirect("/");

  const impersonator = await getImpersonator();

  return (
    <>
      {impersonator && <ImpersonationBanner />}
      <SuperAdminShell orgName={membership.org.legalName} userName={membership.user.name ?? membership.user.email}>
        {children}
      </SuperAdminShell>
    </>
  );
}
