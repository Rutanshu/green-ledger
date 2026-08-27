import { describe, it, expect } from 'vitest';
import { parseFormula, FormulaSyntaxError } from './parse';

describe('parseFormula()', () => {
  it('parses a number', () => {
    expect(parseFormula('42')).toEqual({ type: 'number', value: '42' });
  });

  it('parses an identifier', () => {
    expect(parseFormula('diesel_qty')).toEqual({ type: 'identifier', code: 'diesel_qty' });
  });

  it('respects operator precedence: multiplication before addition', () => {
    const ast = parseFormula('1 + 2 * 3');
    expect(ast).toEqual({
      type: 'binary', op: '+',
      left: { type: 'number', value: '1' },
      right: { type: 'binary', op: '*', left: { type: 'number', value: '2' }, right: { type: 'number', value: '3' } },
    });
  });

  it('parentheses override precedence', () => {
    const ast = parseFormula('(1 + 2) * 3');
    expect(ast).toEqual({
      type: 'binary', op: '*',
      left: { type: 'binary', op: '+', left: { type: 'number', value: '1' }, right: { type: 'number', value: '2' } },
      right: { type: 'number', value: '3' },
    });
  });

  it('parses unary minus', () => {
    expect(parseFormula('-5')).toEqual({ type: 'unaryMinus', operand: { type: 'number', value: '5' } });
  });

  it('parses a conditional', () => {
    const ast = parseFormula('a > 0 ? a : 0');
    expect(ast.type).toBe('conditional');
  });

  it('parses SUM/AVG/MIN/MAX/PRIOR_PERIOD/SITE_ATTRIBUTE calls', () => {
    expect(parseFormula('SUM(a, b, c)')).toEqual({
      type: 'call', name: 'SUM',
      args: [{ type: 'identifier', code: 'a' }, { type: 'identifier', code: 'b' }, { type: 'identifier', code: 'c' }],
    });
    expect(parseFormula('PRIOR_PERIOD(x)')).toEqual({ type: 'call', name: 'PRIOR_PERIOD', args: [{ type: 'identifier', code: 'x' }] });
    expect(parseFormula('SITE_ATTRIBUTE("floor_area_m2")')).toEqual({
      type: 'call', name: 'SITE_ATTRIBUTE', args: [{ type: 'string', value: 'floor_area_m2' }],
    });
  });

  it('rejects an unknown function name', () => {
    expect(() => parseFormula('BOGUS(x)')).toThrow(FormulaSyntaxError);
  });

  it('rejects a dangling operator', () => {
    expect(() => parseFormula('1 +')).toThrow(FormulaSyntaxError);
  });

  it('rejects unbalanced parentheses', () => {
    expect(() => parseFormula('(1 + 2')).toThrow(FormulaSyntaxError);
  });

  it('rejects trailing garbage after a valid expression', () => {
    expect(() => parseFormula('1 + 2 3')).toThrow(FormulaSyntaxError);
  });

  it('never evaluates — a formula that looks like code injection is just rejected as an unknown function', () => {
    // No eval/new Function is reachable from this module at all; a
    // hostile-looking call syntax can't do anything but fail to parse,
    // since only the six allowed function names are recognized.
    expect(() => parseFormula('require("fs")')).toThrow(FormulaSyntaxError);
  });
});
