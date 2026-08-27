import { describe, expect, it } from "vitest";
import { evaluateRule, InvalidRuleConditionError, testRunRule, type RuleConfig, type RuleEvalContext } from "./index";

describe("HARD_LIMIT / CROSS_POSITION_CONSISTENCY", () => {
  it("passes when the condition is truthy", () => {
    const config: RuleConfig = { type: "HARD_LIMIT", condition: "diesel_qty <= 1000000" };
    const ctx: RuleEvalContext = { positionValues: { diesel_qty: "3100" } };
    expect(evaluateRule(config, ctx)).toEqual({ violated: false, message: "" });
  });

  it("flags a violated condition", () => {
    const config: RuleConfig = { type: "HARD_LIMIT", condition: "diesel_qty <= 1000000" };
    const ctx: RuleEvalContext = { positionValues: { diesel_qty: "2000000" } };
    const verdict = evaluateRule(config, ctx);
    expect(verdict.violated).toBe(true);
  });

  it("flags rather than silently passes when an input is missing", () => {
    const config: RuleConfig = { type: "HARD_LIMIT", condition: "diesel_qty <= 1000000" };
    const ctx: RuleEvalContext = { positionValues: {} };
    const verdict = evaluateRule(config, ctx);
    expect(verdict.violated).toBe(true);
    expect(verdict.message).toMatch(/missing/i);
  });

  it("cross-position consistency compares two positions", () => {
    const config: RuleConfig = { type: "CROSS_POSITION_CONSISTENCY", condition: "waste_landfill + waste_recycled <= total_waste" };
    const ctx: RuleEvalContext = { positionValues: { waste_landfill: "40", waste_recycled: "50", total_waste: "100" } };
    expect(evaluateRule(config, ctx).violated).toBe(false);
  });

  it("throws InvalidRuleConditionError on a malformed condition string, not a data-problem verdict", () => {
    const config: RuleConfig = { type: "HARD_LIMIT", condition: "diesel_qty <= " };
    expect(() => evaluateRule(config, { positionValues: {} })).toThrow(InvalidRuleConditionError);
  });
});

describe("PLAUSIBILITY_BAND", () => {
  const config: RuleConfig = { type: "PLAUSIBILITY_BAND", positionCode: "grid_electricity", maxDeltaPct: "20" };

  it("passes within the band", () => {
    const ctx: RuleEvalContext = { positionValues: { grid_electricity: "105" }, priorPeriodValues: { grid_electricity: "100" } };
    expect(evaluateRule(config, ctx).violated).toBe(false);
  });

  it("flags outside the band", () => {
    const ctx: RuleEvalContext = { positionValues: { grid_electricity: "200" }, priorPeriodValues: { grid_electricity: "100" } };
    const verdict = evaluateRule(config, ctx);
    expect(verdict.violated).toBe(true);
    expect(verdict.message).toContain("100%");
  });

  it("does not flag when there's no prior value to compare against", () => {
    const ctx: RuleEvalContext = { positionValues: { grid_electricity: "200" } };
    expect(evaluateRule(config, ctx).violated).toBe(false);
  });
});

describe("MANDATORY_COMMENT / MANDATORY_ATTACHMENT", () => {
  it("flags a missing comment", () => {
    const config: RuleConfig = { type: "MANDATORY_COMMENT", positionCode: "r410a_topup" };
    expect(evaluateRule(config, { positionValues: {}, comments: {} }).violated).toBe(true);
  });
  it("passes with a real comment", () => {
    const config: RuleConfig = { type: "MANDATORY_COMMENT", positionCode: "r410a_topup" };
    expect(evaluateRule(config, { positionValues: {}, comments: { r410a_topup: "Top-up per service log #4" } }).violated).toBe(false);
  });
  it("flags zero attachments", () => {
    const config: RuleConfig = { type: "MANDATORY_ATTACHMENT", positionCode: "raw_materials_spend" };
    expect(evaluateRule(config, { positionValues: {}, attachmentCounts: {} }).violated).toBe(true);
  });
  it("passes with at least one attachment", () => {
    const config: RuleConfig = { type: "MANDATORY_ATTACHMENT", positionCode: "raw_materials_spend" };
    expect(evaluateRule(config, { positionValues: {}, attachmentCounts: { raw_materials_spend: 1 } }).violated).toBe(false);
  });
});

describe("MIN_DATA_QUALITY", () => {
  const config: RuleConfig = { type: "MIN_DATA_QUALITY", positionCode: "diesel_qty", minLevel: "CALCULATED" };
  it("passes MEASURED (better than the minimum)", () => {
    expect(evaluateRule(config, { positionValues: {}, dataQualities: { diesel_qty: "MEASURED" } }).violated).toBe(false);
  });
  it("passes CALCULATED (exactly the minimum)", () => {
    expect(evaluateRule(config, { positionValues: {}, dataQualities: { diesel_qty: "CALCULATED" } }).violated).toBe(false);
  });
  it("flags ESTIMATED (worse than the minimum)", () => {
    expect(evaluateRule(config, { positionValues: {}, dataQualities: { diesel_qty: "ESTIMATED" } }).violated).toBe(true);
  });
  it("flags a missing data quality", () => {
    expect(evaluateRule(config, { positionValues: {}, dataQualities: {} }).violated).toBe(true);
  });
});

describe("COMPLETENESS", () => {
  const config: RuleConfig = { type: "COMPLETENESS", minPct: "80" };
  it("passes at or above the minimum", () => {
    expect(evaluateRule(config, { positionValues: {}, completenessPct: "80" }).violated).toBe(false);
    expect(evaluateRule(config, { positionValues: {}, completenessPct: "95.5" }).violated).toBe(false);
  });
  it("flags below the minimum", () => {
    expect(evaluateRule(config, { positionValues: {}, completenessPct: "79.9" }).violated).toBe(true);
  });
});

describe("testRunRule", () => {
  it("reports the count flagged across historical contexts without needing any persistence", () => {
    const config: RuleConfig = { type: "HARD_LIMIT", condition: "diesel_qty <= 1000" };
    const historical: RuleEvalContext[] = [
      { positionValues: { diesel_qty: "500" } },
      { positionValues: { diesel_qty: "1500" } },
      { positionValues: { diesel_qty: "2500" } },
    ];
    const result = testRunRule(config, historical);
    expect(result.totalCount).toBe(3);
    expect(result.flaggedCount).toBe(2);
    expect(result.flagged).toHaveLength(2);
  });
});
