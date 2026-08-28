"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/understand", label: "Understand" },
  { href: "/understand/topics/scope-1", label: "Scope 1" },
  { href: "/understand/topics/scope-2", label: "Scope 2" },
  { href: "/understand/topics/scope-3", label: "Scope 3" },
  { href: "/understand/topics/whats-next", label: "What's Next" },
] as const;

function isActive(pathname: string, href: string) {
  // Exact match only — every nav item here is specific (a leaf page or
  // /understand itself), so prefix-matching "/understand" would also
  // light it up on /understand/topics/scope-2, which already has its
  // own, more specific entry. /understand/scopes has no entry of its
  // own, so it defers to "Understand".
  if (href === "/understand") return pathname === "/understand" || pathname === "/understand/scopes";
  return pathname === href;
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-plane/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3.5 sm:px-10">
        <Link href="/home" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">G</span>
          Green Ledger
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-1.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                isActive(pathname, item.href) ? "bg-track text-ink" : "text-ink2 hover:bg-track hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/login" className="whitespace-nowrap rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white">
          Sign in
        </Link>
      </div>
    </header>
  );
}
