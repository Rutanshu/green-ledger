import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { parseFormula } from './parse';
import { evaluateFormula, type EvalContext } from './evaluate';

function ev(source: string, ctx: Partial<EvalContext> = {}) {
  return evaluateFormula(parseFormula(source), { positionValues: {}, ...ctx });
}

describe('evaluateFormula() — arithmetic', () => {
  it('evaluates a plain expression', () => {
    const r = ev('1 + 2 * 3');
    expect(r.reason).toBeNull();
    expect((r.value as Decimal).toString()).toBe('7');
  });

  it('reads position values', () => {
    const r = ev('grid_electricity + diesel_qty', {
      positionValues: { grid_electricity: '100', diesel_qty: 50 },
    });
    expect(r.reason).toBeNull();
    expect((r.value as Decimal).toString()).toBe('150');
  });

  it('is Decimal end to end, not float', () => {
    const r = ev('0.1 + 0.2');
    expect(r.value).toBeInstanceOf(Decimal);
    expect((r.value as Decimal).toString()).toBe('0.3'); // a float would give 0.30000000000000004
  });
});

describe('evaluateFormula() — "missing upstream, division by zero and partial period return a typed null, never 0"', () => {
  it('a missing position value yields UPSTREAM_MISSING, naming the position', () => {
    const r = ev('grid_electricity + 1', { positionValues: {} });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('UPSTREAM_MISSING');
    expect(r.position).toBe('grid_electricity');
  });

  it('division by zero yields DIVISION_BY_ZERO, not Infinity and not a throw', () => {
    const r = ev('10 / (5 - 5)');
    expect(r.value).toBeNull();
    expect(r.reason).toBe('DIVISION_BY_ZERO');
  });

  it('a position flagged as a partial period yields PARTIAL_PERIOD, distinct from plain missing', () => {
    const r = ev('grid_electricity + 1', {
      positionValues: {},
      partialPeriodCodes: new Set(['grid_electricity']),
    });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('PARTIAL_PERIOD');
  });

  it('a failure short-circuits — the rest of the formula is never spuriously evaluated as 0', () => {
    const r = ev('missing_position * 1000000', { positionValues: {} });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('UPSTREAM_MISSING');
  });

  it('propagates a failure through SUM/AVG/MIN/MAX rather than silently skipping it', () => {
    const r = ev('SUM(a, b, missing)', { positionValues: { a: 1, b: 2 } });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('UPSTREAM_MISSING');
    expect(r.position).toBe('missing');
  });

  it('propagates a failure through a conditional test', () => {
    const r = ev('missing > 0 ? 1 : 2', { positionValues: {} });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('UPSTREAM_MISSING');
  });
});

describe('evaluateFormula() — functions', () => {
  it('SUM / AVG / MIN / MAX', () => {
    const ctx = { positionValues: { a: 10, b: 20, c: 30 } };
    expect((ev('SUM(a, b, c)', ctx).value as Decimal).toString()).toBe('60');
    expect((ev('AVG(a, b, c)', ctx).value as Decimal).toString()).toBe('20');
    expect((ev('MIN(a, b, c)', ctx).value as Decimal).toString()).toBe('10');
    expect((ev('MAX(a, b, c)', ctx).value as Decimal).toString()).toBe('30');
  });

  it('PRIOR_PERIOD reads from the prior-period lookup, not the current one', () => {
    const r = ev('PRIOR_PERIOD(diesel_qty)', {
      positionValues: { diesel_qty: 999 }, // current period — must NOT be used
      priorPeriodValues: { diesel_qty: 500 },
    });
    expect((r.value as Decimal).toString()).toBe('500');
  });

  it('SITE_ATTRIBUTE reads a named site attribute', () => {
    const r = ev('total_emissions / SITE_ATTRIBUTE("floor_area_m2")', {
      positionValues: { total_emissions: 1000 },
      siteAttributes: { floor_area_m2: 500 },
    });
    expect((r.value as Decimal).toString()).toBe('2');
  });

  it('a missing site attribute yields MISSING_SITE_ATTRIBUTE, naming it', () => {
    const r = ev('SITE_ATTRIBUTE("headcount_fte")', { siteAttributes: {} });
    expect(r.value).toBeNull();
    expect(r.reason).toBe('MISSING_SITE_ATTRIBUTE');
    expect(r.position).toBe('headcount_fte');
  });
});

describe('evaluateFormula() — conditional', () => {
  it('evaluates only the taken branch', () => {
    const r = ev('diesel_qty > 0 ? diesel_qty * 2 : -1', { positionValues: { diesel_qty: 10 } });
    expect((r.value as Decimal).toString()).toBe('20');
  });

  it('the untaken branch can be missing without affecting the result', () => {
    const r = ev('1 > 0 ? 99 : missing_position', { positionValues: {} });
    expect((r.value as Decimal).toString()).toBe('99');
  });
});
