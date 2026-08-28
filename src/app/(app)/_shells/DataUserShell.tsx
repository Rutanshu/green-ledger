"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "../../login/actions";

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/tasks", label: "My Tasks", icon: "☑" },
  { href: "/enter-data", label: "Enter Data", icon: "✎" },
  { href: "/import", label: "Upload Data", icon: "📥" },
  { href: "/my-submissions", label: "My Submissions", icon: "▤" },
  { href: "/help", label: "Help", icon: "?" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function DataUserShell({
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
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[224px_1fr]">
      <aside className="glass sticky top-0 z-20 hidden h-screen flex-col overflow-auto rounded-none border-y-0 border-l-0 p-3 lg:flex">
        <div className="flex items-center gap-2 px-2 pb-6 pt-1 text-[16px] font-semibold">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-md bg-accent text-xs font-bold text-white">
            G
          </span>
          Green Ledger
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${
                isActive(pathname, item.href) ? "bg-track font-semibold text-ink" : "text-ink2 hover:bg-track"
              }`}
            >
              <span className="w-5 text-center text-accent">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <div className="glass sticky top-0 z-10 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-5 py-3">
          <span className="text-[14px] font-medium">{orgName}</span>
          <div className="flex-1" />
          <span className="hidden text-[13px] text-ink2 sm:inline">{userName}</span>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2.5 py-1.5 text-[13px] text-ink2 hover:bg-track">
              Sign out
            </button>
          </form>
        </div>
        <main className="mx-auto w-full max-w-[860px] flex-1 p-5">{children}</main>
      </div>

      <nav className="glass fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-x-0 border-b-0 rounded-none px-1 py-2 lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10.5px] ${
              isActive(pathname, item.href) ? "font-semibold text-accent" : "text-ink2"
            }`}
          >
            <span className="text-[18px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
