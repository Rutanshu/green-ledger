import { describe, it, expect } from 'vitest';
import { parseFormula } from './parse';
import {
  checkFormulaDimension, dimensionOfBase, addDimension, multiplyDimension, divideDimension,
  formatDimension, isDimensionless, DimensionMismatchError, DIMENSIONLESS,
} from './dimension';

const ENERGY = dimensionOfBase('ENERGY');
const VOLUME = dimensionOfBase('VOLUME');
const EMISSIONS = dimensionOfBase('EMISSIONS');
const CURRENCY = dimensionOfBase('CURRENCY');

describe('dimension algebra', () => {
  it('adding the same dimension keeps it', () => {
    expect(addDimension(ENERGY, ENERGY)).toEqual(ENERGY);
  });

  it('adding different dimensions throws', () => {
    expect(() => addDimension(ENERGY, VOLUME)).toThrow(DimensionMismatchError);
  });

  it('multiplying combines exponents', () => {
    // DISTANCE * DISTANCE = DISTANCE^2 (e.g. area, informally)
    const area = multiplyDimension(dimensionOfBase('DISTANCE'), dimensionOfBase('DISTANCE'));
    expect(area).toEqual({ DISTANCE: 2 });
  });

  it('dividing produces an intensity dimension — kWh / m² style', () => {
    const intensity = divideDimension(EMISSIONS, CURRENCY);
    expect(intensity).toEqual({ EMISSIONS: 1, CURRENCY: -1 });
    expect(isDimensionless(intensity)).toBe(false);
  });

  it('a dimension divided by itself is dimensionless', () => {
    expect(divideDimension(ENERGY, ENERGY)).toEqual({});
    expect(isDimensionless(divideDimension(ENERGY, ENERGY))).toBe(true);
  });

  it('formats a dimension for error messages', () => {
    expect(formatDimension(DIMENSIONLESS)).toBe('dimensionless');
    expect(formatDimension(ENERGY)).toBe('ENERGY');
    expect(formatDimension({ EMISSIONS: 1, CURRENCY: -1 })).toBe('CURRENCY^-1 · EMISSIONS');
  });
});

describe('checkFormulaDimension() — the spec example: "kWh + L is rejected; kWh / m² yields an intensity"', () => {
  const dims = { grid_electricity: ENERGY, diesel_qty: VOLUME, total_emissions: EMISSIONS, revenue: CURRENCY };

  it('rejects adding two different dimensions', () => {
    const ast = parseFormula('grid_electricity + diesel_qty');
    expect(() => checkFormulaDimension(ast, dims)).toThrow(DimensionMismatchError);
  });

  it('allows adding the same dimension', () => {
    const ast = parseFormula('grid_electricity + grid_electricity');
    expect(checkFormulaDimension(ast, dims)).toEqual(ENERGY);
  });

  it('division produces an intensity dimension', () => {
    const ast = parseFormula('total_emissions / revenue');
    expect(checkFormulaDimension(ast, dims)).toEqual({ EMISSIONS: 1, CURRENCY: -1 });
  });

  it('throws on an identifier not in the dimension table', () => {
    const ast = parseFormula('unknown_code + grid_electricity');
    expect(() => checkFormulaDimension(ast, dims)).toThrow(/unknown_code/i);
  });

  it('a conditional requires both branches to share a dimension', () => {
    const ok = parseFormula('grid_electricity > 0 ? grid_electricity : diesel_qty');
    expect(() => checkFormulaDimension(ok, dims)).toThrow(DimensionMismatchError);
    const consistent = parseFormula('grid_electricity > 0 ? grid_electricity : grid_electricity');
    expect(checkFormulaDimension(consistent, dims)).toEqual(ENERGY);
  });

  it('SUM/AVG/MIN/MAX require every argument to share one dimension', () => {
    expect(() => checkFormulaDimension(parseFormula('SUM(grid_electricity, diesel_qty)'), dims)).toThrow(DimensionMismatchError);
    expect(checkFormulaDimension(parseFormula('AVG(grid_electricity, grid_electricity)'), dims)).toEqual(ENERGY);
  });

  it('a numeric literal is dimensionless, so a ratio still works', () => {
    const ast = parseFormula('grid_electricity * 2');
    expect(checkFormulaDimension(ast, dims)).toEqual(ENERGY);
  });

  it('a bare numeric literal is dimension-polymorphic in +/-/comparisons — "x > 0" must not be rejected', () => {
    // Regression test: this failed until checkFormulaDimension special-cased
    // literal operands, because 0 is DIMENSIONLESS and grid_electricity is
    // ENERGY, and the strict same-dimension rule alone would reject it —
    // but comparing anything to a bare 0 is an extremely ordinary formula.
    expect(checkFormulaDimension(parseFormula('grid_electricity > 0'), dims)).toEqual(DIMENSIONLESS);
    expect(checkFormulaDimension(parseFormula('grid_electricity + 5'), dims)).toEqual(ENERGY);
    expect(checkFormulaDimension(parseFormula('5 - grid_electricity'), dims)).toEqual(ENERGY);
    // but two DIFFERENT non-literal dimensions must still be rejected
    expect(() => checkFormulaDimension(parseFormula('grid_electricity > diesel_qty'), dims)).toThrow(DimensionMismatchError);
  });

  it('SITE_ATTRIBUTE defaults to dimensionless unless a lookup says otherwise', () => {
    const ast = parseFormula('total_emissions / SITE_ATTRIBUTE("headcount_fte")');
    expect(checkFormulaDimension(ast, dims)).toEqual(EMISSIONS);
  });
});
