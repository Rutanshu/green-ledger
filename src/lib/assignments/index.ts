/**
 * Assignment workflow state machine. GHG_TOOL_ARCHITECTURE.md §8.3/§14,
 * BUILD_PLAN Step 3.2: "Not started -> In progress -> Submitted -> Under
 * review -> Approved -> Locked, with optional four-eyes (submitter !=
 * approver, enforced server-side)." This repo's AssignmentStatus enum
 * collapses Submitted/Under review into one IN_REVIEW state rather than
 * carrying both — the same five-stage shape, one fewer intermediate label.
 *
 * PURE MODULE — no Prisma, no fetch. Four-eyes itself is
 * lib/workflow/fourEyes.ts, shared with the restatement workflow.
 */
export type AssignmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "IN_REVIEW" | "APPROVED" | "LOCKED";

export class IllegalAssignmentTransitionError extends Error {
  constructor(readonly from: AssignmentStatus, readonly to: AssignmentStatus) {
    super(`Illegal assignment transition: ${from} -> ${to}`);
    this.name = "IllegalAssignmentTransitionError";
  }
}

export class IncompleteAssignmentError extends Error {
  constructor(readonly completenessPct: number) {
    super(`Assignment is ${completenessPct}% complete — it must reach 100% before it can be submitted for review.`);
    this.name = "IncompleteAssignmentError";
  }
}

/** IN_REVIEW can bounce back to IN_PROGRESS (sent back for changes) as well as forward to APPROVED. Everything else moves one step at a time. */
const ALLOWED_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "APPROVED"],
  APPROVED: ["LOCKED"],
  LOCKED: [],
};

export function transitionAssignment(from: AssignmentStatus, to: AssignmentStatus): AssignmentStatus {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw new IllegalAssignmentTransitionError(from, to);
  return to;
}

/** Submitting for review requires 100% completeness — never a partial submission silently accepted. */
export function assertCompleteForSubmission(completenessPct: number): void {
  if (completenessPct < 100) throw new IncompleteAssignmentError(completenessPct);
}
