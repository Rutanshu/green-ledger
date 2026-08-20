import { redirect } from "next/navigation";
import { AppShell } from "./AppShell";
import { getCurrentOrg } from "@/lib/demo-org";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  return <AppShell orgName={org.legalName}>{children}</AppShell>;
}
