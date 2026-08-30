"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  LayoutGrid,
  Gauge,
  ClipboardCheck,
  FileEdit,
  FileBarChart,
  Calculator,
  Building2,
  Database,
  Users as UsersIcon,
  Network,
  History,
  Settings as SettingsIcon,
} from "lucide-react";
import { signOut } from "../login/actions";
import { can, ROLE_LABEL, type Role } from "@/lib/auth/permissions";

// Redesign spec §01/§02 — the Admin portal's nav, restructured around
// what a reviewer/manager's day looks like rather than the app's own
// internal model names. Icons are lucide's monochrome-stroke SVGs
// (currentColor) rather than emoji glyphs — an emoji renders in its own
// full-color glyph on most platforms regardless of surrounding text
// color, which is what made a couple of nav rows look inconsistent with
// the rest.
const NAV_PRIMARY = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/progress", label: "Reporting Progress", icon: Gauge },
  { href: "/review", label: "Review Data", icon: ClipboardCheck, requires: "manage_questionnaire" as const },
  { href: "/data-collection", label: "Data Collection", icon: FileEdit },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/calculators", label: "Calculators", icon: Calculator, requires: "manage_questionnaire" as const },
];

const NAV_COMPANY = [
  { href: "/sites", label: "Facilities", icon: Building2, requires: "manage_sites" as const },
  { href: "/sources", label: "Data Collection Setup", icon: Database, requires: "manage_factors" as const },
  { href: "/users", label: "Users", icon: UsersIcon, requires: "manage_users" as const },
];

const NAV_ADMIN = [
  { href: "/organisation", label: "Company Structure", icon: Network, requires: "manage_org" as const },
  { href: "/audit-log", label: "Audit Log", icon: History, requires: "manage_org" as const },
  { href: "/settings", label: "Settings", icon: SettingsIcon, requires: "manage_org" as const },
];

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requires?: Parameters<typeof can>[1];
}

function NavGroup({ items, pathname, role }: { items: readonly NavItem[]; pathname: string; role: Role }) {
  return (
    <div className="flex flex-col gap-px">
      {items
        .filter((item) => !item.requires || can(role, item.requires))
        .map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] ${
                active ? "bg-track font-semibold text-ink" : "text-ink2 hover:bg-track"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-85" />
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
          Company
        </div>
        <NavGroup items={NAV_COMPANY} pathname={pathname} role={role} />
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
