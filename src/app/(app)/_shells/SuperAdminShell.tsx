"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "../../login/actions";

// Consolidates the spec's "Frameworks" and "Templates" into one nav item
// — without platform-global QuestionnaireTemplate rows (a real schema
// change, not attempted this phase), the two would show identical
// content. See §15 scoping notes in the plan.
const NAV = [
  { href: "/platform", label: "Platform Overview", icon: "◉" },
  { href: "/platform/companies", label: "Companies", icon: "▣" },
  { href: "/platform/users", label: "Global Users", icon: "☖" },
  { href: "/platform/templates", label: "Templates", icon: "▤" },
  { href: "/platform/factors", label: "Emission Factors", icon: "⚗" },
  { href: "/platform/rules", label: "Calculations", icon: "ƒ" },
  { href: "/platform/integrations", label: "Integrations", icon: "⇄" },
  { href: "/platform/logs", label: "System Logs", icon: "≡" },
  { href: "/platform/support", label: "Support", icon: "◎" },
  { href: "/platform/security", label: "Security", icon: "◈" },
  { href: "/platform/settings", label: "Platform Settings", icon: "⚙" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/platform" ? pathname === "/platform" : pathname.startsWith(href);
}

export function SuperAdminShell({
  orgName,
  userName,
  children,
}: {
  orgName: string;
  userName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-[224px_1fr] bg-[#0a0c0b] text-[#e4e6e2]">
      <aside className="sticky top-0 z-20 flex h-screen flex-col overflow-auto border-r border-white/10 bg-[#0e100f] p-3">
        <div className="flex items-center gap-2 px-2 pb-1 pt-1 text-[14px] font-semibold">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-[#4fae8c] text-xs font-bold text-[#0a0c0b]">
            G
          </span>
          Green Ledger
        </div>
        <div className="px-2 pb-4 font-mono text-[10px] uppercase tracking-wider text-[#4fae8c]">Platform</div>
        <nav className="flex flex-col gap-px">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 font-mono text-[12.5px] ${
                  active ? "bg-white/10 font-semibold text-white" : "text-[#9aa39d] hover:bg-white/5 hover:text-[#e4e6e2]"
                }`}
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0e100f] px-6 py-2.5">
          <span className="font-mono text-[12px] text-[#9aa39d]">viewing: {orgName}</span>
          <span className="rounded border border-[#4fae8c]/40 bg-[#4fae8c]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#6ecda8]">
            production
          </span>
          <div className="flex-1" />
          <span className="font-mono text-[12px] text-[#9aa39d]">{userName}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#e4e6e2]">
            Super Admin
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2 py-1 font-mono text-[11px] text-[#9aa39d] hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
        <main className="max-w-[1240px] flex-1 p-6 text-[#e4e6e2]">{children}</main>
      </div>
    </div>
  );
}
