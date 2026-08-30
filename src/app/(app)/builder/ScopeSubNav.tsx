"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Filters Position Library's flat position list to one scope at a time
 * via a ?scope= query param. (Builder itself no longer uses this —
 * questions now live in 17 real per-scope templates, so its own
 * scope-to-scope navigation is TemplateSwitcher.tsx, a link between
 * pages rather than a filter within one. Position Library stays one
 * flat, filterable list since a Position isn't owned by any one
 * template.)
 */
const SCOPE_3_CATEGORIES = Array.from({ length: 15 }, (_, i) => i + 1);

export function ScopeSubNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("scope") ?? "";

  const tabs: { key: string; label: string }[] = [
    { key: "", label: "All" },
    { key: "1", label: "Scope 1" },
    { key: "2", label: "Scope 2" },
    ...SCOPE_3_CATEGORIES.map((n) => ({ key: `3.${n}`, label: `3.${n}` })),
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-grid pb-2">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const count = t.key === "" ? undefined : counts[t.key];
        const href = t.key === "" ? pathname : `${pathname}?scope=${encodeURIComponent(t.key)}`;
        return (
          <Link
            key={t.key || "all"}
            href={href}
            className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ${
              isActive ? "bg-accent text-white" : "bg-track text-ink2 hover:text-ink"
            }`}
          >
            {t.label}
            {count !== undefined && <span className="ml-1 opacity-75">({count})</span>}
          </Link>
        );
      })}
    </div>
  );
}
