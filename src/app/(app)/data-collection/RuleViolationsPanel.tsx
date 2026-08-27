"use client";

import { useActionState } from "react";
import { acknowledgeRuleViolation } from "./actions";

interface Violation {
  id: string;
  ruleName: string;
  message: string;
  questionCode: string | null;
  status: string;
  acknowledgementComment: string | null;
}

export function RuleViolationsPanel({ violations }: { violations: Violation[] }) {
  const open = violations.filter((v) => v.status === "OPEN");
  const acknowledged = violations.filter((v) => v.status === "ACKNOWLEDGED");
  if (violations.length === 0) return null;

  return (
    <div className="border-t border-grid p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        Rule violations {open.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{open.length} open</span>}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {open.map((v) => (
          <OpenViolationRow key={v.id} violation={v} />
        ))}
        {acknowledged.map((v) => (
          <div key={v.id} className="text-xs text-muted">
            <span className="line-through">{v.ruleName}: {v.message}</span> — acknowledged: {v.acknowledgementComment}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenViolationRow({ violation }: { violation: Violation }) {
  const [state, formAction, pending] = useActionState(acknowledgeRuleViolation, null);
  if (state?.ok) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5 text-xs">
      <input type="hidden" name="violationId" value={violation.id} />
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        {violation.ruleName}
      </span>
      <span className="text-ink2">{violation.message}</span>
      <input
        name="comment"
        placeholder="acknowledgement comment"
        required
        className="w-40 rounded-md border border-border bg-plane px-2 py-1 outline-none focus:border-accent"
      />
      <button type="submit" disabled={pending} className="rounded-md border border-border bg-surface px-2 py-1 font-medium hover:bg-track disabled:opacity-60">
        {pending ? "Acknowledging…" : "Acknowledge"}
      </button>
      {state?.error && <span className="text-crit">{state.error}</span>}
    </form>
  );
}
