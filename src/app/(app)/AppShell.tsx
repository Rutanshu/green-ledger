"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "../login/actions";
import { can, ROLE_LABEL, type Role } from "@/lib/auth/permissions";

const NAV_PRIMARY = [
  { href: "/how-it-works", label: "How it works", icon: "◎" },
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/sites", label: "Sites", icon: "▤" },
  { href: "/data-collection", label: "Data Collection", icon: "✎" },
  { href: "/factor-lab", label: "Factor Lab", icon: "⚗" },
  { href: "/builder", label: "Builder", icon: "⚙" },
];

const NAV_WORKFLOW = [
  { href: "/tasks", label: "Tasks", icon: "☑" },
  { href: "/documents", label: "Documents", icon: "🗎" },
  { href: "/reports", label: "Reports", icon: "▧" },
];

const NAV_ADMIN = [
  { href: "/organisation", label: "Organisation", icon: "◱", requires: "manage_org" as const },
  { href: "/positions", label: "Positions", icon: "🧑‍💼", requires: "manage_sites" as const },
  { href: "/periods", label: "Periods", icon: "◔" },
  { href: "/labels", label: "Labels", icon: "🏷" },
  { href: "/users", label: "Users & roles", icon: "☖", requires: "manage_users" as const },
];

function NavGroup({ items, pathname, role }: { items: typeof NAV_ADMIN; pathname: string; role: Role }) {
  return (
    <div className="flex flex-col gap-px">
      {items
        .filter((item) => !item.requires || can(role, item.requires))
        .map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] ${
                active ? "bg-track font-semibold text-ink" : "text-ink2 hover:bg-track"
              }`}
            >
              <span className="w-4 text-center opacity-85">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
    </div>
  );
}

export function AppShell({
  orgName,
  userName,
  role,
  children,
}: {
  orgName: string;
  userName: string;
  role: Role;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-[232px_1fr]">
      <aside className="glass sticky top-0 z-20 h-screen overflow-auto rounded-none border-y-0 border-l-0 p-3">
        <div className="flex items-center gap-2 px-2 pb-4 pt-1 text-[15px] font-semibold">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">
            G
          </span>
          Green Ledger
        </div>
        <NavGroup items={NAV_PRIMARY} pathname={pathname} role={role} />
        <div className="px-2.5 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
          Workflow
        </div>
        <NavGroup items={NAV_WORKFLOW} pathname={pathname} role={role} />
        <div className="px-2.5 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
          Admin
        </div>
        <NavGroup items={NAV_ADMIN} pathname={pathname} role={role} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="glass sticky top-0 z-10 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-6 py-2.5">
          <span className="text-[13px] font-medium">{orgName}</span>
          <span className="text-[13px] text-ink2">FY2026</span>
          <div className="flex-1" />
          <span className="text-[13px] text-ink2">{userName}</span>
          <span className="rounded-full bg-track px-2 py-0.5 text-[11px] font-semibold text-ink2">{ROLE_LABEL[role]}</span>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2 py-1 text-xs text-ink2 hover:bg-track">
              Sign out
            </button>
          </form>
          <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
            GL
          </span>
        </div>
        <main className="max-w-[1240px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
