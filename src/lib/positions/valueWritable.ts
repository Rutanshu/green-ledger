/**
 * Guards submitAnswer (data-collection/actions.ts) from silently
 * overwriting a PositionValue a manager already approved. Same shape as
 * lib/periods' PeriodLockedError — a plain check thrown as a typed error,
 * pure, no Prisma. The only way past it is review/actions.ts's
 * unlockPositionValue, a manager-only action that moves the value back
 * to DRAFT first.
 */
export class PositionValueLockedError extends Error {
  constructor() {
    super("This answer has already been approved and is locked. A manager can unlock it for re-entry from Review Data.");
    this.name = "PositionValueLockedError";
  }
}

export function assertPositionValueWritable(status: string | undefined): void {
  if (status === "APPROVED") throw new PositionValueLockedError();
}
