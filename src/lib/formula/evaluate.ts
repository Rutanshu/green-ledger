/**
 * Formula evaluation. GHG_TOOL_ARCHITECTURE.md §10: "Division by zero,
 * missing upstream values and partial periods produce a typed null with a
 * reason, never a 0. A blank and a zero mean very different things in an
 * assurance review."
 *
 * PURE MODULE. Every value the formula reads is an argument (current-period
 * values, prior-period values, site attributes) — no Prisma, no fetch.
 */
import Decimal from 'decimal.js';
import type { FormulaNode } from './parse';

export type EvalReason = 'UPSTREAM_MISSING' | 'DIVISION_BY_ZERO' | 'PARTIAL_PERIOD' | 'MISSING_SITE_ATTRIBUTE';

export type EvalResult =
  | { value: Decimal; reason: null; position?: undefined }
  | { value: null; reason: EvalReason; position?: string };

export interface EvalContext {
  /** current-period value for each position/indicator code the formula may read. */
  positionValues: Readonly<Record<string, Decimal | string | number | null | undefined>>;
  /** value for the SAME position in the prior period — consulted only by PRIOR_PERIOD(x). */
  priorPeriodValues?: Readonly<Record<string, Decimal | string | number | null | undefined>>;
  /** value for SITE_ATTRIBUTE("code") calls. */
  siteAttributes?: Readonly<Record<string, Decimal | string | number | null | undefined>>;
  /**
   * Codes to report as PARTIAL_PERIOD rather than UPSTREAM_MISSING when
   * their positionValues entry is null/undefined — a caller-supplied
   * distinction the evaluator can't infer on its own (§10: "a blank and a
   * zero mean very different things," and neither is quite "just missing").
   */
  partialPeriodCodes?: ReadonlySet<string>;
}

const ok = (value: Decimal): EvalResult => ({ value, reason: null });
const fail = (reason: EvalReason, position?: string): EvalResult => ({ value: null, reason, position });

function toDecimalOrNull(v: Decimal | string | number | null | undefined): Decimal | null {
  if (v === null || v === undefined) return null;
  return v instanceof Decimal ? v : new Decimal(v);
}

/** Evaluates a parsed formula. Never throws for a data problem (missing value, div/0) — those are EvalResult failures; a genuinely malformed AST (e.g. an unresolvable node shape) still throws, since that's a programming error, not a data one. */
export function evaluateFormula(node: FormulaNode, ctx: EvalContext): EvalResult {
  switch (node.type) {
    case 'number':
      return ok(new Decimal(node.value));

    case 'string':
      // A bare string literal has no numeric value on its own — only meaningful as a SITE_ATTRIBUTE argument, handled there.
      throw new Error('A string literal cannot be evaluated as a number outside SITE_ATTRIBUTE(...).');

    case 'identifier': {
      const raw = ctx.positionValues[node.code];
      const dec = toDecimalOrNull(raw);
      if (dec === null) {
        const reason: EvalReason = ctx.partialPeriodCodes?.has(node.code) ? 'PARTIAL_PERIOD' : 'UPSTREAM_MISSING';
        return fail(reason, node.code);
      }
      return ok(dec);
    }

    case 'unaryMinus': {
      const r = evaluateFormula(node.operand, ctx);
      return r.reason ? r : ok(r.value.neg());
    }

    case 'binary': {
      const left = evaluateFormula(node.left, ctx);
      if (left.reason) return left;
      const right = evaluateFormula(node.right, ctx);
      if (right.reason) return right;
      switch (node.op) {
        case '+':
          return ok(left.value.plus(right.value));
        case '-':
          return ok(left.value.minus(right.value));
        case '*':
          return ok(left.value.mul(right.value));
        case '/':
          if (right.value.isZero()) return fail('DIVISION_BY_ZERO');
          return ok(left.value.div(right.value));
        case '<':
          return ok(new Decimal(left.value.lt(right.value) ? 1 : 0));
        case '>':
          return ok(new Decimal(left.value.gt(right.value) ? 1 : 0));
        case '<=':
          return ok(new Decimal(left.value.lte(right.value) ? 1 : 0));
        case '>=':
          return ok(new Decimal(left.value.gte(right.value) ? 1 : 0));
        case '==':
          return ok(new Decimal(left.value.eq(right.value) ? 1 : 0));
        case '!=':
          return ok(new Decimal(left.value.eq(right.value) ? 0 : 1));
      }
      break;
    }

    case 'conditional': {
      const test = evaluateFormula(node.test, ctx);
      if (test.reason) return test;
      return test.value.isZero() ? evaluateFormula(node.whenFalse, ctx) : evaluateFormula(node.whenTrue, ctx);
    }

    case 'call': {
      if (node.name === 'SITE_ATTRIBUTE') {
        const arg = node.args[0];
        const key = arg && arg.type === 'string' ? arg.value : undefined;
        const raw = key ? ctx.siteAttributes?.[key] : undefined;
        const dec = toDecimalOrNull(raw);
        return dec === null ? fail('MISSING_SITE_ATTRIBUTE', key) : ok(dec);
      }
      if (node.name === 'PRIOR_PERIOD') {
        const arg = node.args[0];
        if (arg?.type !== 'identifier') throw new Error('PRIOR_PERIOD(x) requires a plain position/indicator identifier.');
        const raw = ctx.priorPeriodValues?.[arg.code];
        const dec = toDecimalOrNull(raw);
        return dec === null ? fail('UPSTREAM_MISSING', arg.code) : ok(dec);
      }
      // SUM / AVG / MIN / MAX
      const results = node.args.map((a) => evaluateFormula(a, ctx));
      const firstFailure = results.find((r) => r.reason !== null);
      if (firstFailure) return firstFailure;
      const values = results.map((r) => r.value as Decimal);
      if (values.length === 0) return fail('UPSTREAM_MISSING');
      switch (node.name) {
        case 'SUM':
          return ok(values.reduce((a, b) => a.plus(b), new Decimal(0)));
        case 'AVG':
          return ok(values.reduce((a, b) => a.plus(b), new Decimal(0)).div(values.length));
        case 'MIN':
          return ok(values.reduce((a, b) => (b.lt(a) ? b : a)));
        case 'MAX':
          return ok(values.reduce((a, b) => (b.gt(a) ? b : a)));
      }
    }
  }
  throw new Error('Unreachable formula node');
}
