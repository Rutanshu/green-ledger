/**
 * Data Collection's own bridge from persisted Question/Answer rows into the
 * pure lib/formula engine. NOT part of lib/formula/ itself — this file is
 * allowed to know about Prisma-shaped inputs; lib/formula/ never is.
 */
import Decimal from "decimal.js";
import {
  parseFormula,
  evaluateFormula,
  extractDependencies,
  topologicalOrder,
  type EvalResult,
  type FormulaNode,
} from "@/lib/formula";

export interface IndicatorQuestionLike {
  id: string;
  code: string;
  inputType: string;
  formula: string | null;
}

export interface PositionValueLike {
  valueNumeric: Decimal | string | number | null;
}

export interface SiteAttributeSource {
  floorAreaM2: Decimal | string | number | null;
  headcountFte: Decimal | string | number | null;
  annualRevenue: Decimal | string | number | null;
  denominators: unknown;
}

function toDecimalOrNull(v: Decimal | string | number | null | undefined): Decimal | null {
  if (v === null || v === undefined) return null;
  return v instanceof Decimal ? v : new Decimal(v);
}

function buildSiteAttributes(site: SiteAttributeSource): Record<string, Decimal | null> {
  const attrs: Record<string, Decimal | null> = {
    floor_area_m2: toDecimalOrNull(site.floorAreaM2),
    headcount_fte: toDecimalOrNull(site.headcountFte),
    revenue: toDecimalOrNull(site.annualRevenue),
  };
  if (site.denominators && typeof site.denominators === "object") {
    for (const [k, v] of Object.entries(site.denominators as Record<string, unknown>)) {
      if (typeof v === "number" || typeof v === "string") attrs[k] = new Decimal(v);
    }
  }
  return attrs;
}

/**
 * Computes every INDICATOR question's value for one assignment, in
 * dependency order, so an indicator that references another indicator sees
 * the referenced one's already-computed value rather than UPSTREAM_MISSING.
 * Formulas were parsed/cycle-checked/dimension-checked at save time
 * (builder/actions.ts) — a parse failure here is defensive only.
 *
 * Step 2.2 Phase C: sibling values are looked up by position code (matching
 * Question.code) rather than by questionId — they now live in
 * PositionValue, keyed by site+period, not on the assignment.
 */
export function evaluateIndicators(
  allQuestions: readonly IndicatorQuestionLike[],
  valueByQuestionCode: (code: string) => PositionValueLike | undefined,
  site: SiteAttributeSource,
): ReadonlyMap<string, EvalResult> {
  const positionValues: Record<string, Decimal | null> = {};
  for (const q of allQuestions) {
    if (q.inputType === "INDICATOR") continue;
    const v = valueByQuestionCode(q.code);
    positionValues[q.code] = v ? toDecimalOrNull(v.valueNumeric) : null;
  }
  const siteAttributes = buildSiteAttributes(site);

  const indicatorQuestions = allQuestions.filter((q) => q.inputType === "INDICATOR" && q.formula);
  const parsed = new Map<string, FormulaNode>();
  const edges = new Map<string, readonly string[]>();
  for (const q of indicatorQuestions) {
    try {
      const ast = parseFormula(q.formula!);
      parsed.set(q.code, ast);
      edges.set(q.code, extractDependencies(ast));
    } catch {
      // Persisted formulas are already validated at save time; skip a malformed one defensively.
    }
  }

  let order: readonly string[];
  try {
    order = topologicalOrder(edges);
  } catch {
    order = [...parsed.keys()];
  }

  const results = new Map<string, EvalResult>();
  for (const code of order) {
    const ast = parsed.get(code);
    if (!ast) continue;
    const result = evaluateFormula(ast, { positionValues, siteAttributes });
    results.set(code, result);
    positionValues[code] = result.reason ? null : result.value;
  }
  return results;
}

export const EVAL_REASON_LABEL: Record<string, string> = {
  UPSTREAM_MISSING: "missing input",
  DIVISION_BY_ZERO: "division by zero",
  PARTIAL_PERIOD: "partial period",
  MISSING_SITE_ATTRIBUTE: "missing site attribute",
};
