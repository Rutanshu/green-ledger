/**
 * The four-eyes check shared by every approval workflow in this app
 * (restatements, assignment sign-off): whoever approves a thing must be a
 * different person from whoever submitted it. GHG_TOOL_ARCHITECTURE.md
 * §14/§15.
 *
 * PURE MODULE — no Prisma, no fetch.
 */
export class SelfApprovalError extends Error {
  constructor() {
    super("The approver must be a different person from whoever submitted this.");
    this.name = "SelfApprovalError";
  }
}

/** Throws SelfApprovalError if the same person submitted and would approve. Call before recording an approval. */
export function assertDistinctApprover(submittedById: string, approverId: string): void {
  if (submittedById === approverId) throw new SelfApprovalError();
}
