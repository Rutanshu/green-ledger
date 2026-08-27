/**
 * Restatement state machine. GHG_TOOL_ARCHITECTURE.md §15, BUILD_PLAN Step
 * 3.3, CLAUDE.md rule 8: "Locked periods are immutable. Corrections go
 * through restatement." This is the pure decision logic; the DB write it
 * gates lives in data-collection/actions.ts.
 *
 * PURE MODULE — no Prisma, no fetch, no Date.now().
 */
export type RestatementStatus = "PENDING" | "APPROVED" | "REJECTED";

export class IllegalRestatementTransitionError extends Error {
  constructor(readonly from: RestatementStatus, readonly to: RestatementStatus) {
    super(`Illegal restatement transition: ${from} -> ${to}`);
    this.name = "IllegalRestatementTransitionError";
  }
}

export class SelfApprovalError extends Error {
  constructor() {
    super("A restatement's approver must be a different person from whoever requested it.");
    this.name = "SelfApprovalError";
  }
}

/** PENDING -> APPROVED or REJECTED; both are terminal. */
export function decideRestatement(status: RestatementStatus, decision: "APPROVED" | "REJECTED"): RestatementStatus {
  if (status !== "PENDING") throw new IllegalRestatementTransitionError(status, decision);
  return decision;
}

/** Four-eyes: throws SelfApprovalError if the same person requested and would approve. Call before decideRestatement. */
export function assertDistinctApprover(requestedById: string, approverId: string): void {
  if (requestedById === approverId) throw new SelfApprovalError();
}
