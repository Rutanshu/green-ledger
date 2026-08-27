/**
 * Rules engine. GHG_TOOL_ARCHITECTURE.md §13/§4.2, BUILD_PLAN Step 3.6.
 *
 * A rule's condition is a lib/formula/ source string — never an eval'd
 * string — reusing the same parser and evaluator the indicator engine
 * uses (formulas already return 0/1 for comparisons, so "diesel_qty <=
 * 1000000" IS a boolean predicate with no new grammar needed).
 *
 * PURE MODULE — no Prisma, no fetch, no Date.now(). Every check takes a
 * plain context object and returns a verdict; nothing here writes
 * anything, which is also what makes the required "test-run against
 * historical data, write nothing" acceptance criterion trivially true —
 * evaluateRule always writes nothing, by construction.
 */
import Decimal from "decimal.js";
import { parseFormula, evaluateFormula, FormulaSyntaxError, type EvalContext } from "../formula";

export type RuleType =
  | "HARD_LIMIT"
  | "PLAUSIBILITY_BAND"
  | "MANDATORY_COMMENT"
  | "MANDATORY_ATTACHMENT"
  | "MIN_DATA_QUALITY"
  | "CROSS_POSITION_CONSISTENCY"
  | "COMPLETENESS";

export type RuleSeverity = "BLOCK" | "WARN";

export type DataQuality = "MEASURED" | "CALCULATED" | "ESTIMATED" | "PROXY";

/** Best to worst, matching CLAUDE.md's data-quality vocabulary. A rule's minLevel is the worst level still acceptable. */
const DATA_QUALITY_RANK: Record<DataQuality, number> = { MEASURED: 0, CALCULATED: 1, ESTIMATED: 2, PROXY: 3 };

export type RuleConfig =
  | { type: "HARD_LIMIT"; condition: string }
  | { type: "CROSS_POSITION_CONSISTENCY"; condition: string }
  | { type: "PLAUSIBILITY_BAND"; positionCode: string; maxDeltaPct: string }
  | { type: "MANDATORY_COMMENT"; positionCode: string }
  | { type: "MANDATORY_ATTACHMENT"; positionCode: string }
  | { type: "MIN_DATA_QUALITY"; positionCode: string; minLevel: DataQuality }
  | { type: "COMPLETENESS"; minPct: string };

export interface RuleEvalContext {
  positionValues: EvalContext["positionValues"];
  priorPeriodValues?: EvalContext["priorPeriodValues"];
  siteAttributes?: EvalContext["siteAttributes"];
  /** per-position comment text, keyed by position code — null/missing means no comment. */
  comments?: Readonly<Record<string, string | null | undefined>>;
  /** per-position attachment count, keyed by position code. */
  attachmentCounts?: Readonly<Record<string, number | undefined>>;
  /** per-position data quality, keyed by position code. */
  dataQualities?: Readonly<Record<string, DataQuality | null | undefined>>;
  completenessPct?: string | number | Decimal;
}

export interface RuleVerdict {
  violated: boolean;
  message: string;
}

export class InvalidRuleConditionError extends Error {
  constructor(readonly condition: string, cause: unknown) {
    super(`Rule condition is not a valid formula: ${condition}`);
    this.name = "InvalidRuleConditionError";
    this.cause = cause;
  }
}

function evaluateCondition(condition: string, ctx: RuleEvalContext): RuleVerdict {
  let ast;
  try {
    ast = parseFormula(condition);
  } catch (e) {
    if (e instanceof FormulaSyntaxError) throw new InvalidRuleConditionError(condition, e);
    throw e;
  }
  const result = evaluateFormula(ast, {
    positionValues: ctx.positionValues,
    priorPeriodValues: ctx.priorPeriodValues,
    siteAttributes: ctx.siteAttributes,
  });
  if (result.reason) {
    // A condition that can't evaluate (missing upstream value) can't assert compliance — flag it, don't silently pass.
    return { violated: true, message: `Could not evaluate condition — ${result.reason.toLowerCase().replaceAll("_", " ")}${result.position ? ` (${result.position})` : ""}.` };
  }
  return result.value.isZero() ? { violated: true, message: `Condition failed: ${condition}` } : { violated: false, message: "" };
}

/** Evaluates one rule against one context. Never throws for a data problem — only for a malformed condition string, which is a rule-authoring error, not a data one. */
export function evaluateRule(config: RuleConfig, ctx: RuleEvalContext): RuleVerdict {
  switch (config.type) {
    case "HARD_LIMIT":
    case "CROSS_POSITION_CONSISTENCY":
      return evaluateCondition(config.condition, ctx);

    case "PLAUSIBILITY_BAND": {
      const current = ctx.positionValues[config.positionCode];
      const prior = ctx.priorPeriodValues?.[config.positionCode];
      if (current === null || current === undefined) return { violated: false, message: "" };
      if (prior === null || prior === undefined) return { violated: false, message: "" }; // nothing to compare against yet
      const curDec = current instanceof Decimal ? current : new Decimal(current);
      const priorDec = prior instanceof Decimal ? prior : new Decimal(prior);
      if (priorDec.isZero()) return { violated: false, message: "" };
      const deltaPct = curDec.minus(priorDec).div(priorDec).abs().mul(100);
      const max = new Decimal(config.maxDeltaPct);
      return deltaPct.gt(max)
        ? { violated: true, message: `${config.positionCode} moved ${deltaPct.toDecimalPlaces(1)}% vs prior period (band is ${max}%).` }
        : { violated: false, message: "" };
    }

    case "MANDATORY_COMMENT": {
      const comment = ctx.comments?.[config.positionCode];
      return !comment || !comment.trim()
        ? { violated: true, message: `${config.positionCode} requires a comment.` }
        : { violated: false, message: "" };
    }

    case "MANDATORY_ATTACHMENT": {
      const count = ctx.attachmentCounts?.[config.positionCode] ?? 0;
      return count < 1
        ? { violated: true, message: `${config.positionCode} requires at least one attachment.` }
        : { violated: false, message: "" };
    }

    case "MIN_DATA_QUALITY": {
      const actual = ctx.dataQualities?.[config.positionCode];
      if (!actual) return { violated: true, message: `${config.positionCode} has no data quality recorded.` };
      return DATA_QUALITY_RANK[actual] > DATA_QUALITY_RANK[config.minLevel]
        ? { violated: true, message: `${config.positionCode} is ${actual}, below the required ${config.minLevel}.` }
        : { violated: false, message: "" };
    }

    case "COMPLETENESS": {
      if (ctx.completenessPct === undefined) return { violated: false, message: "" };
      const pct = ctx.completenessPct instanceof Decimal ? ctx.completenessPct : new Decimal(ctx.completenessPct);
      const min = new Decimal(config.minPct);
      return pct.lt(min)
        ? { violated: true, message: `${pct}% complete, below the required ${min}%.` }
        : { violated: false, message: "" };
    }
  }
}

export interface TestRunResult<T> {
  flaggedCount: number;
  totalCount: number;
  flagged: Array<{ context: T; verdict: RuleVerdict }>;
}

/**
 * "Evaluate a draft rule against historical data and report how many past
 * lines it would have flagged, without writing anything." Writes nothing
 * by construction — evaluateRule is pure — so there is nothing to roll
 * back even if the caller never persists this result.
 */
export function testRunRule<T extends RuleEvalContext>(config: RuleConfig, historicalContexts: readonly T[]): TestRunResult<T> {
  const flagged: TestRunResult<T>["flagged"] = [];
  for (const context of historicalContexts) {
    const verdict = evaluateRule(config, context);
    if (verdict.violated) flagged.push({ context, verdict });
  }
  return { flaggedCount: flagged.length, totalCount: historicalContexts.length, flagged };
}
