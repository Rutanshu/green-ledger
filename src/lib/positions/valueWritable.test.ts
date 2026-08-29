import { describe, expect, it } from "vitest";
import { assertPositionValueWritable, PositionValueLockedError } from "./valueWritable";

describe("assertPositionValueWritable", () => {
  it("passes for every non-APPROVED status, including undefined (no existing value)", () => {
    for (const status of [undefined, "UNANSWERED", "DRAFT", "ANSWERED", "FLAGGED"]) {
      expect(() => assertPositionValueWritable(status)).not.toThrow();
    }
  });
  it("throws PositionValueLockedError for APPROVED", () => {
    expect(() => assertPositionValueWritable("APPROVED")).toThrow(PositionValueLockedError);
  });
});
