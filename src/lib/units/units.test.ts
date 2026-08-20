import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { convert, conversionFactor, dimensionOf, unitsInDimension, isUnitAllowed, UnitMismatchError, CurrencyConversionError } from './index';

describe('units', () => {
  it('converts within a dimension exactly', () => {
    expect(convert(1, 'M3', 'L').quantity.toString()).toBe('1000');
    expect(convert(1, 'TONNE', 'KG').quantity.toString()).toBe('1000');
    expect(convert(1, 'MWH', 'KWH').quantity.toString()).toBe('1000');
    expect(convert(1, 'MI', 'KM').quantity.toString()).toBe('1.609344');
  });

  it('round-trips without drift', () => {
    const there = convert(new Decimal('14200'), 'L', 'M3');
    const back = convert(there.quantity, 'M3', 'L');
    expect(back.quantity.toString()).toBe('14200');
  });

  it('returns the conversion factor so it can be snapshotted', () => {
    expect(convert(5, 'GAL_UK', 'L').factor.toString()).toBe('4.54609');
  });

  it('THROWS across dimensions — litres of diesel are not kWh', () => {
    expect(() => convert(100, 'L', 'KWH')).toThrow(UnitMismatchError);
    expect(() => conversionFactor('KG', 'KM')).toThrow(UnitMismatchError);
  });

  it('refuses to silently convert currency', () => {
    expect(() => convert(100, 'GBP', 'EUR')).toThrow(CurrencyConversionError);
    expect(convert(100, 'GBP', 'GBP').quantity.toString()).toBe('100');
  });

  it('knows which units belong to a dimension', () => {
    expect(dimensionOf('L')).toBe('VOLUME');
    expect(unitsInDimension('VOLUME')).toEqual(['L', 'M3', 'GAL_US', 'GAL_UK']);
    expect(isUnitAllowed('KWH', 'VOLUME')).toBe(false);
    expect(isUnitAllowed('L', 'VOLUME')).toBe(true);
  });
});
