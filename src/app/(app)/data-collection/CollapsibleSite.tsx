"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

/**
 * Data Collection now shows every facility's location and its assigned
 * questionnaire(s) collapsed by default — the questions themselves (and
 * the approve/submit controls) only render once someone clicks in,
 * instead of every site dumping its whole answer table on page load.
 *
 * Reused at two levels: the outer, glass-styled site card (name + code),
 * and — nested inside it, once expanded — a plainer `compact` card per
 * scope-assignment (a facility can hold up to 17 of these, one per
 * template), so the second level reads as "inside" the first rather than
 * a sibling of equal weight.
 */
export function CollapsibleSite({
  name,
  code,
  status,
  workflow,
  compact,
  children,
}: {
  name: string;
  code?: string;
  status?: ReactNode;
  workflow?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={compact ? "rounded-[9px] border border-grid" : "rounded-[11px] glass"}>
      <div className={compact ? "border-b border-grid p-3" : "border-b border-grid p-4"}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          )}
          <div>
            <div className={compact ? "text-[13.5px] font-medium" : "font-semibold"}>
              {name} {code && <span className="font-normal text-muted">({code})</span>}
            </div>
            {status && <div className="mt-0.5 text-[12.5px] text-ink2">{status}</div>}
          </div>
        </button>
        {workflow && <div className="mt-2 pl-6">{workflow}</div>}
      </div>
      {open && children}
    </div>
  );
}
