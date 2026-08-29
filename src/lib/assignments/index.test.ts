import { describe, expect, it } from "vitest";
import {
  assertCompleteForSubmission, assertHasReleasableAnswers, IllegalAssignmentTransitionError,
  IncompleteAssignmentError, NothingToReleaseError, transitionAssignment,
} from "./index";

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
  it("allows APPROVED -> IN_REVIEW (a manager unlocking one previously-approved answer bounces the assignment back)", () => {
    expect(transitionAssignment("APPROVED", "IN_REVIEW")).toBe("IN_REVIEW");
  });
  it("still refuses APPROVED -> IN_PROGRESS or NOT_STARTED (only the review bounce-back is allowed)", () => {
    expect(() => transitionAssignment("APPROVED", "IN_PROGRESS")).toThrow(IllegalAssignmentTransitionError);
    expect(() => transitionAssignment("APPROVED", "NOT_STARTED")).toThrow(IllegalAssignmentTransitionError);
  });
});

describe("assertHasReleasableAnswers", () => {
  it("passes when at least one question has been answered", () => {
    expect(() => assertHasReleasableAnswers(1)).not.toThrow();
  });
  it("throws NothingToReleaseError at zero", () => {
    expect(() => assertHasReleasableAnswers(0)).toThrow(NothingToReleaseError);
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
