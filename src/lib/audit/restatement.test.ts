import { describe, expect, it } from "vitest";
import { assertDistinctApprover, decideRestatement, IllegalRestatementTransitionError, SelfApprovalError } from "./restatement";

describe("decideRestatement", () => {
  it("PENDING -> APPROVED", () => {
    expect(decideRestatement("PENDING", "APPROVED")).toBe("APPROVED");
  });
  it("PENDING -> REJECTED", () => {
    expect(decideRestatement("PENDING", "REJECTED")).toBe("REJECTED");
  });
  it("throws deciding an already-APPROVED restatement", () => {
    expect(() => decideRestatement("APPROVED", "REJECTED")).toThrow(IllegalRestatementTransitionError);
  });
  it("throws deciding an already-REJECTED restatement", () => {
    expect(() => decideRestatement("REJECTED", "APPROVED")).toThrow(IllegalRestatementTransitionError);
  });
});

describe("assertDistinctApprover", () => {
  it("passes when requester and approver differ", () => {
    expect(() => assertDistinctApprover("user-a", "user-b")).not.toThrow();
  });
  it("throws SelfApprovalError when they're the same person", () => {
    expect(() => assertDistinctApprover("user-a", "user-a")).toThrow(SelfApprovalError);
  });
});
