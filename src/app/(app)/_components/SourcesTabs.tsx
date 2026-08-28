"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/factor-lab", label: "Factor Sets" },
  { href: "/builder", label: "Questionnaire Builder" },
  { href: "/positions-library", label: "Position Library" },
] as const;

/**
 * Redesign spec §01: three separate nav items (Factor Lab, Builder,
 * Position library) become one — "Emission Sources" — without rewriting
 * the three screens underneath. This strip, dropped at the top of each,
 * is what makes switching between them read as one screen.
 */
export function SourcesTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-1 border-b border-grid">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-2 text-[13px] font-medium ${
              active ? "border-b-2 border-accent text-ink" : "text-ink2 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
