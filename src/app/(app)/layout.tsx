import { redirect } from "next/navigation";
import { AppShell } from "./AppShell";
import { getCurrentMembership } from "@/lib/demo-org";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");

  return (
    <AppShell orgName={membership.org.legalName} userName={membership.user.name ?? membership.user.email} role={membership.role}>
      {children}
    </AppShell>
  );
}
