import Link from "next/link";
import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/organisation", title: "Company Structure", body: "Legal name, consolidation approach, base year, fiscal year." },
  { href: "/periods", title: "Reporting Periods", body: "Open, lock, and manage each period a report can be built from." },
  { href: "/labels", title: "Terminology", body: "Rename what the platform calls things, without changing a number." },
  { href: "/positions", title: "People & Roles", body: "Who's accountable for what — data owners, reviewers, approvers." },
] as const;

export default async function SettingsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "manage_org")) return <Denied role={membership.role} />;

  return (
    <>
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Company-level configuration that changes rarely.</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="glass rounded-[11px] p-4 hover:bg-track">
            <div className="text-[14.5px] font-medium">{l.title}</div>
            <p className="mt-1 text-[13px] text-ink2">{l.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
