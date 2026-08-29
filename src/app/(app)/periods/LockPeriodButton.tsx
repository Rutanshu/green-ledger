"use client";

import { useActionState } from "react";
import { lockPeriod, type PeriodReadiness } from "./actions";

export function LockPeriodButton({ periodId, readiness }: { periodId: string; readiness: PeriodReadiness }) {
  const [state, formAction, pending] = useActionState(lockPeriod, null);

  const checks = [
    {
      label: "Every facility approved",
      ok: readiness.totalFacilities > 0 && readiness.approvedFacilities === readiness.totalFacilities,
      detail: `${readiness.approvedFacilities} of ${readiness.totalFacilities}`,
    },
    {
      label: "No blocking data-quality flags open",
      ok: readiness.openBlockingViolations === 0,
      detail: readiness.openBlockingViolations === 0 ? "none open" : `${readiness.openBlockingViolations} open`,
    },
    {
      label: "No broken emission sources",
      ok: readiness.brokenBindings === 0,
      detail: readiness.brokenBindings === 0 ? "all linked" : `${readiness.brokenBindings} unlinked`,
    },
  ];

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-grid pt-2.5">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center justify-between gap-3 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className={c.ok ? "text-good" : "text-muted"}>{c.ok ? "✓" : "○"}</span>
            <span className={c.ok ? "text-ink2" : "text-ink"}>{c.label}</span>
          </span>
          <span className="text-muted">{c.detail}</span>
        </div>
      ))}
      <form action={formAction} className="mt-1 flex items-center gap-2">
        <input type="hidden" name="periodId" value={periodId} />
        <button
          type="submit"
          disabled={pending || !readiness.ready}
          title={readiness.ready ? undefined : "All three checks above must pass first"}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold hover:bg-track disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Locking…" : "Lock period"}
        </button>
        {state?.error && <span className="text-xs text-crit">{state.error}</span>}
      </form>
    </div>
  );
}
