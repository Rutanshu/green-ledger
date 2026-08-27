"use client";

import { useState, useTransition } from "react";
import { submitAssignment, approveAssignment } from "./actions";

interface Props {
  assignmentId: string;
  status: string;
  completenessPct: number;
  canSubmit: boolean;
  canApprove: boolean;
  isOwnSubmission: boolean;
}

export function AssignmentWorkflow({ assignmentId, status, completenessPct, canSubmit, canApprove, isOwnSubmission }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof submitAssignment | typeof approveAssignment) => {
    startTransition(async () => {
      const result = await action(assignmentId);
      setError(result?.ok ? null : result?.error ?? "Failed.");
    });
  };

  if (status === "NOT_STARTED" || status === "IN_PROGRESS") {
    if (!canSubmit) return null;
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <button
          onClick={() => run(submitAssignment)}
          disabled={pending || completenessPct < 100}
          title={completenessPct < 100 ? "Must be 100% complete to submit" : undefined}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit for review"}
        </button>
        {error && <span className="text-xs text-crit">{error}</span>}
      </div>
    );
  }

  if (status === "IN_REVIEW") {
    if (!canApprove) return null;
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <button
          onClick={() => run(approveAssignment)}
          disabled={pending || isOwnSubmission}
          title={isOwnSubmission ? "You submitted this — a different person must approve it" : undefined}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
        >
          {pending ? "Approving…" : "Approve"}
        </button>
        {error && <span className="text-xs text-crit">{error}</span>}
      </div>
    );
  }

  return null;
}
