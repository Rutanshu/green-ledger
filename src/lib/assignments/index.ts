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

export class NothingToReleaseError extends Error {
  constructor() {
    super("Nothing has been answered yet — there's nothing to release for review.");
    this.name = "NothingToReleaseError";
  }
}

/**
 * IN_REVIEW can bounce back to IN_PROGRESS (sent back for changes) as
 * well as forward to APPROVED. APPROVED can bounce back to IN_REVIEW
 * too — not a normal step, only reachable via a manager's single-answer
 * unlock (review/actions.ts unlockPositionValue), which needs the
 * assignment to land somewhere review/page.tsx already queries for
 * (status: "IN_REVIEW") rather than inventing a new status value for a
 * "mostly approved, one field reopened" state. Everything else moves one
 * step at a time.
 */
const ALLOWED_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "APPROVED"],
  APPROVED: ["LOCKED", "IN_REVIEW"],
  LOCKED: [],
};

export function transitionAssignment(from: AssignmentStatus, to: AssignmentStatus): AssignmentStatus {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw new IllegalAssignmentTransitionError(from, to);
  return to;
}

/** A FULL submission requires 100% completeness — never a partial submission silently accepted as complete. */
export function assertCompleteForSubmission(completenessPct: number): void {
  if (completenessPct < 100) throw new IncompleteAssignmentError(completenessPct);
}

/**
 * A PARTIAL release ("release what's ready") only requires that
 * something has actually been answered — the assignment still moves to
 * IN_REVIEW, but stays honestly short of 100% until the rest is
 * answered and re-released. review/page.tsx's own per-answer status
 * (draft/answered/approved) is what tells a reviewer it was partial, not
 * this check.
 */
export function assertHasReleasableAnswers(answeredCount: number): void {
  if (answeredCount <= 0) throw new NothingToReleaseError();
}
