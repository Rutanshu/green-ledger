import { describe, expect, it } from "vitest";
import { assertCompleteForSubmission, IllegalAssignmentTransitionError, IncompleteAssignmentError, transitionAssignment } from "./index";

describe("transitionAssignment", () => {
  it("walks the happy path NOT_STARTED -> IN_PROGRESS -> IN_REVIEW -> APPROVED -> LOCKED", () => {
    expect(transitionAssignment("NOT_STARTED", "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(transitionAssignment("IN_PROGRESS", "IN_REVIEW")).toBe("IN_REVIEW");
    expect(transitionAssignment("IN_REVIEW", "APPROVED")).toBe("APPROVED");
    expect(transitionAssignment("APPROVED", "LOCKED")).toBe("LOCKED");
  });
  it("allows IN_REVIEW -> IN_PROGRESS (sent back for changes)", () => {
    expect(transitionAssignment("IN_REVIEW", "IN_PROGRESS")).toBe("IN_PROGRESS");
  });
  it("throws skipping a stage: NOT_STARTED -> IN_REVIEW", () => {
    expect(() => transitionAssignment("NOT_STARTED", "IN_REVIEW")).toThrow(IllegalAssignmentTransitionError);
  });
  it("throws on LOCKED -> anything (terminal)", () => {
    expect(() => transitionAssignment("LOCKED", "APPROVED")).toThrow(IllegalAssignmentTransitionError);
  });
  it("throws APPROVED -> IN_REVIEW (no going back once approved)", () => {
    expect(() => transitionAssignment("APPROVED", "IN_REVIEW")).toThrow(IllegalAssignmentTransitionError);
  });
});

describe("assertCompleteForSubmission", () => {
  it("passes at 100%", () => {
    expect(() => assertCompleteForSubmission(100)).not.toThrow();
  });
  it("throws IncompleteAssignmentError below 100%", () => {
    expect(() => assertCompleteForSubmission(99.5)).toThrow(IncompleteAssignmentError);
  });
});
