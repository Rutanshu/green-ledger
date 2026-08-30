"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

/**
 * Data Collection now shows every facility's location and its assigned
 * questionnaire collapsed by default — the questions themselves (and the
 * approve/submit controls) only render once someone clicks in, instead
 * of every site dumping its whole answer table on page load.
 */
export function CollapsibleSite({
  name,
  code,
  status,
  workflow,
  children,
}: {
  name: string;
  code: string;
  status?: ReactNode;
  workflow?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[11px] glass">
      <div className="border-b border-grid p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          )}
          <div>
            <div className="font-semibold">
              {name} <span className="font-normal text-muted">({code})</span>
            </div>
            {status && <div className="mt-0.5 text-[13px] text-ink2">{status}</div>}
          </div>
        </button>
        {workflow && <div className="mt-2 pl-6">{workflow}</div>}
      </div>
      {open && children}
    </div>
  );
}
