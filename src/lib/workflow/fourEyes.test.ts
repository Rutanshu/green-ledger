import { describe, expect, it } from "vitest";
import { assertDistinctApprover, SelfApprovalError } from "./fourEyes";

describe("assertDistinctApprover", () => {
  it("passes when submitter and approver differ", () => {
    expect(() => assertDistinctApprover("user-a", "user-b")).not.toThrow();
  });
  it("throws SelfApprovalError when they're the same person", () => {
    expect(() => assertDistinctApprover("user-a", "user-a")).toThrow(SelfApprovalError);
  });
});
