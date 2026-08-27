/**
 * Cross-dimension conversion (litres of diesel -> GJ) is a FUEL PROPERTY —
 * calorific value, density — not a unit conversion. CLAUDE.md rule 4.
 * `convert()` in index.ts refuses this on purpose (UnitMismatchError);
 * this is the separate, explicit bridge that's allowed to cross a
 * dimension, and only because a dated, sourced record says it may.
 *
 * PURE MODULE: takes the property list as an argument, same as resolveLabel
 * takes overrides and resolveFactor takes candidates — never queries a
 * database. Matches prisma/schema.prisma's FuelProperty model.
 */
import Decimal from 'decimal.js';
import { conversionFactor, UnitMismatchError, type UnitCode } from './index';

export interface FuelPropertyRecord {
  fuelCode: string;
  /** "density" | "ncv" (net calorific value) — free text in the schema, not yet a closed set */
  property: string;
  value: Decimal | string | number;
  fromUnit: UnitCode;
  toUnit: UnitCode;
  source: string;
  validFrom: Date;
  validTo: Date | null;
}

export class NoFuelPropertyError extends Error {
  constructor(
    readonly fuelCode: string,
    readonly from: UnitCode,
    readonly to: UnitCode,
  ) {
    super(
      `No fuel property bridges ${from} to ${to} for "${fuelCode}". Cross-dimension conversion needs ` +
        `a dated, sourced calorific value or density on this fuel — it is a configuration gap, not something to coerce.`,
    );
    this.name = 'NoFuelPropertyError';
  }
}

export interface BridgeResult {
  quantity: Decimal;
  unit: UnitCode;
  /** snapshotted onto the EmissionRecord so the arithmetic stays reproducible, same as ConversionResult.factor */
  factor: Decimal;
  propertyUsed: FuelPropertyRecord;
}

/**
 * Crosses a unit dimension using a fuel property valid on the given date.
 * Tries the property in its stored direction first (fromUnit -> toUnit),
 * then its inverse (toUnit -> fromUnit, using 1/value) — an NCV is often
 * recorded in only one direction, and asking for the other is legitimate.
 */
export function bridge(
  quantity: Decimal | string | number,
  from: UnitCode,
  to: UnitCode,
  fuelCode: string,
  properties: readonly FuelPropertyRecord[],
  on: Date,
): BridgeResult {
  const q = new Decimal(quantity);
  const candidates = properties.filter(
    (p) => p.fuelCode === fuelCode && p.validFrom <= on && (!p.validTo || p.validTo >= on),
  );

  const direct = candidates.find((p) => p.fromUnit === from && p.toUnit === to);
  if (direct) {
    const factor = new Decimal(direct.value);
    return { quantity: q.mul(factor), unit: to, factor, propertyUsed: direct };
  }

  const inverse = candidates.find((p) => p.fromUnit === to && p.toUnit === from);
  if (inverse) {
    const factor = new Decimal(1).div(new Decimal(inverse.value));
    return { quantity: q.mul(factor), unit: to, factor, propertyUsed: inverse };
  }

  throw new NoFuelPropertyError(fuelCode, from, to);
}

/**
 * Same-dimension shortcut first (cheap, exact, no property needed), falling
 * back to bridge() only when `from` and `to` are genuinely different
 * dimensions. This is the function calculateEmissions() actually calls —
 * convert()/bridge() individually stay available for direct use elsewhere.
 */
export type ConvertOrBridgeResult =
  | { quantity: Decimal; unit: UnitCode; factor: Decimal; usedBridge: false }
  | { quantity: Decimal; unit: UnitCode; factor: Decimal; usedBridge: true; propertyUsed: FuelPropertyRecord };

export function convertOrBridge(
  quantity: Decimal | string | number,
  from: UnitCode,
  to: UnitCode,
  fuelCode: string,
  properties: readonly FuelPropertyRecord[],
  on: Date,
): ConvertOrBridgeResult {
  try {
    const { quantity: qty, unit, factor } = conversionFactorSameDimension(quantity, from, to);
    return { quantity: qty, unit, factor, usedBridge: false };
  } catch (err) {
    // Only a genuine cross-dimension mismatch falls through to bridging.
    // CurrencyConversionError (same dimension, no implicit FX) must still
    // surface as itself — a fuel-property bridge has nothing to say about it.
    if (!(err instanceof UnitMismatchError)) throw err;
    const result = bridge(quantity, from, to, fuelCode, properties, on);
    return { ...result, usedBridge: true };
  }
}

function conversionFactorSameDimension(quantity: Decimal | string | number, from: UnitCode, to: UnitCode) {
  const factor = conversionFactor(from, to);
  return { quantity: new Decimal(quantity).mul(factor), unit: to, factor };
}
