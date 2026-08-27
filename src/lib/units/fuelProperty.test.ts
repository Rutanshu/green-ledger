import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { bridge, convertOrBridge, NoFuelPropertyError, type FuelPropertyRecord } from './fuelProperty';
import { UnitMismatchError, CurrencyConversionError } from './index';

const dieselNcv: FuelPropertyRecord = {
  fuelCode: 'diesel',
  property: 'ncv',
  value: '35.8', // 1 L diesel ~ 35.8 MJ
  fromUnit: 'L',
  toUnit: 'MJ',
  source: 'DEFRA fuel properties, Table A',
  validFrom: new Date('2020-01-01'),
  validTo: null,
};

describe('bridge()', () => {
  it('crosses a unit dimension using a fuel property — the spec example', () => {
    const result = bridge(100, 'L', 'MJ', 'diesel', [dieselNcv], new Date('2026-01-01'));
    expect(result.quantity.toString()).toBe('3580');
    expect(result.unit).toBe('MJ');
    expect(result.propertyUsed).toBe(dieselNcv);
  });

  it('uses the inverse direction when only the reverse property is stored', () => {
    // 1/35.8 isn't a terminating decimal, so the round trip is exact to
    // many places but not bit-for-bit identical — that's correct decimal
    // arithmetic, not a bug. Assert precision, not exact string equality.
    const result = bridge(3580, 'MJ', 'L', 'diesel', [dieselNcv], new Date('2026-01-01'));
    expect(result.quantity.toDecimalPlaces(6).toString()).toBe('100');
  });

  it('throws NoFuelPropertyError with no matching property — never coerces', () => {
    expect(() => bridge(100, 'L', 'MJ', 'petrol', [dieselNcv], new Date('2026-01-01'))).toThrow(NoFuelPropertyError);
  });

  it('throws when the property exists but is not valid on the requested date', () => {
    const futureOnly: FuelPropertyRecord = { ...dieselNcv, validFrom: new Date('2030-01-01') };
    expect(() => bridge(100, 'L', 'MJ', 'diesel', [futureOnly], new Date('2026-01-01'))).toThrow(NoFuelPropertyError);
  });

  it('respects validTo — an expired property cannot bridge a later date', () => {
    const expired: FuelPropertyRecord = { ...dieselNcv, validTo: new Date('2024-12-31') };
    expect(() => bridge(100, 'L', 'MJ', 'diesel', [expired], new Date('2026-01-01'))).toThrow(NoFuelPropertyError);
  });

  it('names the fuel and both units in the error', () => {
    try {
      bridge(100, 'L', 'MJ', 'petrol', [], new Date('2026-01-01'));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(NoFuelPropertyError);
      const e = err as NoFuelPropertyError;
      expect(e.fuelCode).toBe('petrol');
      expect(e.from).toBe('L');
      expect(e.to).toBe('MJ');
    }
  });
});

describe('convertOrBridge()', () => {
  it('prefers a plain unit conversion when the dimension already matches', () => {
    const result = convertOrBridge(1000, 'L', 'M3', 'diesel', [], new Date('2026-01-01'));
    expect(result.quantity.toString()).toBe('1');
    expect(result.usedBridge).toBe(false);
  });

  it('falls back to a fuel-property bridge across dimensions', () => {
    const result = convertOrBridge(100, 'L', 'MJ', 'diesel', [dieselNcv], new Date('2026-01-01'));
    expect(result.quantity.toString()).toBe('3580');
    expect(result.usedBridge).toBe(true);
    if (!result.usedBridge) expect.unreachable();
    expect(result.propertyUsed).toBe(dieselNcv);
  });

  it('still refuses currency conversion even with properties available — a bridge has nothing to say about FX', () => {
    expect(() => convertOrBridge(100, 'GBP', 'EUR', 'diesel', [dieselNcv], new Date('2026-01-01'))).toThrow(
      CurrencyConversionError,
    );
  });

  it('surfaces NoFuelPropertyError, not a generic UnitMismatchError, when bridging fails', () => {
    expect(() => convertOrBridge(100, 'L', 'MJ', 'diesel', [], new Date('2026-01-01'))).toThrow(NoFuelPropertyError);
    expect(() => convertOrBridge(100, 'L', 'MJ', 'diesel', [], new Date('2026-01-01'))).not.toThrow(UnitMismatchError);
  });

  it('returns a Decimal, never a float', () => {
    const result = convertOrBridge(new Decimal('12345.6789'), 'L', 'M3', 'diesel', [], new Date('2026-01-01'));
    expect(result.quantity).toBeInstanceOf(Decimal);
  });
});
