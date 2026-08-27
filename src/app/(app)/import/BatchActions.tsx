"use client";

import { useState, useTransition } from "react";
import { commitImport, revertImport } from "./actions";

export function BatchActions({ batchId, status }: { batchId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof commitImport | typeof revertImport) => {
    startTransition(async () => {
      const result = await action(batchId);
      setError(result?.ok ? null : result?.error ?? "Failed.");
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {status === "DRY_RUN" && (
        <button
          onClick={() => run(commitImport)}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
        >
          {pending ? "Committing…" : "Commit"}
        </button>
      )}
      {status === "COMMITTED" && (
        <button
          onClick={() => run(revertImport)}
          disabled={pending}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
        >
          {pending ? "Reverting…" : "Revert"}
        </button>
      )}
      {error && <span className="text-xs text-crit">{error}</span>}
    </div>
  );
}
