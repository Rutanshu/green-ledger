"use client";

import { useState, useTransition } from "react";
import { decideRestatementAction } from "./actions";

export function RestatementDecision({ restatementId, disabled }: { restatementId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return <span className="text-xs text-muted" title="You requested this restatement — a different person must decide it">—</span>;
  }

  const decide = (decision: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      const result = await decideRestatementAction(restatementId, decision);
      setError(result?.ok ? null : result?.error ?? "Failed.");
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => decide("APPROVED")}
        disabled={pending}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
      >
        Approve
      </button>
      <button
        onClick={() => decide("REJECTED")}
        disabled={pending}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
      >
        Reject
      </button>
      {error && <span className="text-xs text-crit">{error}</span>}
    </div>
  );
}
