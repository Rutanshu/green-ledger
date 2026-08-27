import { describe, expect, it } from "vitest";
import { validateRow, type ValidationContext } from "./validate";

const baseCtx: ValidationContext = {
  siteCodes: new Set(["MI-AD-04"]),
  questions: new Map([["diesel_qty", { allowedUnits: ["L", "GAL_UK"] }]]),
  periodWritable: true,
  periodLabel: "FY2026",
};

describe("validateRow", () => {
  it("accepts a well-formed row", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "3100", unit: "L", data_quality: "MEASURED" }, baseCtx, new Set());
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown site code with the row number", () => {
    const result = validateRow(2, { site_code: "ZZ-99", question_code: "diesel_qty", value: "1", unit: "L" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rowNumber).toBe(2);
      expect(result.reason).toMatch(/unknown site_code/);
    }
  });

  it("rejects an unknown question code", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "not_a_question", value: "1", unit: "L" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unknown question_code/);
  });

  it("rejects a unit not allowed for the question", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "1", unit: "KG" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unit "KG" not allowed/);
  });

  it("rejects a non-numeric value (type error)", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "lots", unit: "L" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not a number/);
  });

  it("rejects a negative value", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "-5", unit: "L" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
  });

  it("rejects when the period is locked", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "1", unit: "L" }, { ...baseCtx, periodWritable: false }, new Set());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/locked/);
  });

  it("rejects a duplicate line within the same file", () => {
    const seen = new Set<string>();
    const first = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "1", unit: "L" }, baseCtx, seen);
    expect(first.ok).toBe(true);
    const second = validateRow(3, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "2", unit: "L" }, baseCtx, seen);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/duplicate line/);
  });

  it("defaults data_quality to ESTIMATED when not provided", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "1", unit: "L" }, baseCtx, new Set());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.dataQuality).toBe("ESTIMATED");
  });

  it("rejects an invalid data_quality", () => {
    const result = validateRow(2, { site_code: "MI-AD-04", question_code: "diesel_qty", value: "1", unit: "L", data_quality: "GUESSED" }, baseCtx, new Set());
    expect(result.ok).toBe(false);
  });
});
