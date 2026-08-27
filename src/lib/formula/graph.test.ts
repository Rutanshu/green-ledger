import { describe, it, expect } from 'vitest';
import { parseFormula } from './parse';
import { extractDependencies, checkForCycle, topologicalOrder, CycleError } from './graph';

describe('extractDependencies()', () => {
  it('collects every plain identifier read', () => {
    const ast = parseFormula('a + b * c');
    expect(extractDependencies(ast)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('collects identifiers inside SUM/AVG/MIN/MAX/PRIOR_PERIOD', () => {
    const ast = parseFormula('SUM(a, b) + PRIOR_PERIOD(c)');
    expect(extractDependencies(ast).sort()).toEqual(['a', 'b', 'c']);
  });

  it('does NOT treat a SITE_ATTRIBUTE string argument as a position dependency', () => {
    const ast = parseFormula('a / SITE_ATTRIBUTE("floor_area_m2")');
    expect(extractDependencies(ast)).toEqual(['a']);
  });

  it('deduplicates repeated reads of the same position', () => {
    const ast = parseFormula('a + a + a');
    expect(extractDependencies(ast)).toEqual(['a']);
  });
});

describe('checkForCycle() — "a cycle is rejected at save, not discovered mid-calculation"', () => {
  it('accepts a plain DAG', () => {
    const edges = new Map([
      ['c', ['a', 'b']],
      ['a', []],
      ['b', []],
    ]);
    expect(() => checkForCycle(edges)).not.toThrow();
  });

  it('rejects a direct self-reference', () => {
    const edges = new Map([['a', ['a']]]);
    expect(() => checkForCycle(edges)).toThrow(CycleError);
  });

  it('rejects an indirect cycle and reports the actual cycle path', () => {
    // a depends on b, b depends on c, c depends on a
    const edges = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);
    try {
      checkForCycle(edges);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CycleError);
      const e = err as CycleError;
      // the cycle path should visit all three nodes and return to the start
      expect(new Set(e.cycle.slice(0, -1))).toEqual(new Set(['a', 'b', 'c']));
      expect(e.cycle[0]).toBe(e.cycle[e.cycle.length - 1]);
    }
  });

  it('does not false-positive on a diamond dependency (shared, not circular)', () => {
    // d depends on b and c, both of which depend on a — not a cycle
    const edges = new Map([
      ['d', ['b', 'c']],
      ['b', ['a']],
      ['c', ['a']],
      ['a', []],
    ]);
    expect(() => checkForCycle(edges)).not.toThrow();
  });
});

describe('topologicalOrder()', () => {
  it('orders dependencies before dependents', () => {
    const edges = new Map([
      ['total', ['scope1', 'scope2']],
      ['scope1', ['diesel']],
      ['scope2', []],
      ['diesel', []],
    ]);
    const order = topologicalOrder(edges);
    expect(order.indexOf('diesel')).toBeLessThan(order.indexOf('scope1'));
    expect(order.indexOf('scope1')).toBeLessThan(order.indexOf('total'));
    expect(order.indexOf('scope2')).toBeLessThan(order.indexOf('total'));
  });

  it('throws the same CycleError a cyclic graph would produce, rather than returning a bad order', () => {
    const edges = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    expect(() => topologicalOrder(edges)).toThrow(CycleError);
  });
});
