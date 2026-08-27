import { describe, expect, it } from "vitest";
import { assertFreshWrite, StaleWriteError } from "./index";

describe("assertFreshWrite", () => {
  it("passes when both are null (a brand-new row, nothing to conflict with)", () => {
    expect(() => assertFreshWrite(null, null)).not.toThrow();
  });
  it("passes when expected matches actual", () => {
    expect(() => assertFreshWrite("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).not.toThrow();
  });
  it("throws StaleWriteError when someone else changed it since the form loaded", () => {
    expect(() => assertFreshWrite("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toThrow(StaleWriteError);
  });
  it("throws when the client expected no row but one now exists", () => {
    expect(() => assertFreshWrite(null, "2026-01-01T00:00:00.000Z")).toThrow(StaleWriteError);
  });
  it("throws when the client expected a row but it's gone", () => {
    expect(() => assertFreshWrite("2026-01-01T00:00:00.000Z", null)).toThrow(StaleWriteError);
  });
});
