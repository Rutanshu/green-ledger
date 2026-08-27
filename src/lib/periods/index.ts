/**
 * Collection period state machine. GHG_TOOL_ARCHITECTURE.md §5.1/§5.3,
 * BUILD_PLAN Step 2.1. This repo's PeriodStatus enum is DRAFT / IN_REVIEW /
 * LOCKED / ASSURED (Prisma-generated) rather than BUILD_PLAN's literal
 * Open/Closed/Locked names, but the same state machine: a period opens in
 * DRAFT, closes for review, locks, and can later be marked ASSURED by an
 * external auditor. Once LOCKED or ASSURED, no write is legal — only a
 * Restatement (CLAUDE.md rule 8).
 *
 * PURE MODULE — no Prisma, no fetch. Callers pass in the period's current
 * status and get back either the next status or a thrown, typed error.
 */
export type PeriodStatus = "DRAFT" | "IN_REVIEW" | "LOCKED" | "ASSURED";

export class IllegalPeriodTransitionError extends Error {
  constructor(readonly from: PeriodStatus, readonly to: PeriodStatus) {
    super(`Illegal period transition: ${from} -> ${to}`);
    this.name = "IllegalPeriodTransitionError";
  }
}

export class PeriodLockedError extends Error {
  constructor(readonly periodLabel: string, readonly status: PeriodStatus) {
    super(`Period ${periodLabel} is ${status.toLowerCase()} — edits are refused. Use a restatement instead.`);
    this.name = "PeriodLockedError";
  }
}

/** Legal next states from each state. IN_REVIEW can bounce back to DRAFT (reopened for correction before locking); nothing else goes backward. */
const ALLOWED_TRANSITIONS: Record<PeriodStatus, readonly PeriodStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "LOCKED"],
  LOCKED: ["ASSURED"],
  ASSURED: [],
};

/** Throws IllegalPeriodTransitionError for anything not in the state machine; otherwise returns the target status. */
export function transitionPeriod(from: PeriodStatus, to: PeriodStatus): PeriodStatus {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw new IllegalPeriodTransitionError(from, to);
  return to;
}

export function isPeriodWritable(status: PeriodStatus): boolean {
  return status !== "LOCKED" && status !== "ASSURED";
}

/** Throws PeriodLockedError if the period can't be written to. Call before any write that targets a period. */
export function assertPeriodWritable(period: { label: string; status: PeriodStatus }): void {
  if (!isPeriodWritable(period.status)) throw new PeriodLockedError(period.label, period.status);
}
