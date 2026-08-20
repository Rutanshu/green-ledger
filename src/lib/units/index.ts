/**
 * Units are a TYPE, not a string. See SPEC.md §6.
 *
 * Conversion WITHIN a dimension is a fixed ratio (this file).
 * Conversion ACROSS dimensions (litres of diesel -> GJ) is a FUEL PROPERTY
 * (density, net calorific value) and lives in lib/units/fuelProperty.ts.
 * Conflating the two is the classic failure mode in carbon accounting software.
 *
 * PURE MODULE: no I/O, no Date.now(), no database.
 */
import Decimal from 'decimal.js';

export const UNIT_DIMENSIONS = [
  'VOLUME', 'MASS', 'ENERGY', 'DISTANCE',
  'MASS_DISTANCE', 'PASSENGER_DISTANCE', 'CURRENCY', 'EMISSIONS', 'COUNT',
] as const;
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number];

export const UNITS = {
  // VOLUME — base: litre
  L:        { dimension: 'VOLUME',   toBase: '1' },
  M3:       { dimension: 'VOLUME',   toBase: '1000' },
  GAL_US:   { dimension: 'VOLUME',   toBase: '3.785411784' },
  GAL_UK:   { dimension: 'VOLUME',   toBase: '4.54609' },
  // MASS — base: kilogram
  G:        { dimension: 'MASS',     toBase: '0.001' },
  KG:       { dimension: 'MASS',     toBase: '1' },
  TONNE:    { dimension: 'MASS',     toBase: '1000' },
  LB:       { dimension: 'MASS',     toBase: '0.45359237' },
  // ENERGY — base: kilowatt-hour
  KWH:      { dimension: 'ENERGY',   toBase: '1' },
  MWH:      { dimension: 'ENERGY',   toBase: '1000' },
  GJ:       { dimension: 'ENERGY',   toBase: '277.777777777778' },
  MJ:       { dimension: 'ENERGY',   toBase: '0.277777777777778' },
  THERM:    { dimension: 'ENERGY',   toBase: '29.3071' },
  MMBTU:    { dimension: 'ENERGY',   toBase: '293.07107' },
  // DISTANCE — base: kilometre
  KM:       { dimension: 'DISTANCE', toBase: '1' },
  MI:       { dimension: 'DISTANCE', toBase: '1.609344' },
  NM:       { dimension: 'DISTANCE', toBase: '1.852' },
  // MASS_DISTANCE — base: tonne-kilometre
  TONNE_KM: { dimension: 'MASS_DISTANCE', toBase: '1' },
  KG_KM:    { dimension: 'MASS_DISTANCE', toBase: '0.001' },
  // PASSENGER_DISTANCE
  PASSENGER_KM: { dimension: 'PASSENGER_DISTANCE', toBase: '1' },
  // CURRENCY — no cross-currency ratio; FX is explicit and dated. Base is itself.
  GBP: { dimension: 'CURRENCY', toBase: '1' },
  EUR: { dimension: 'CURRENCY', toBase: '1' },
  USD: { dimension: 'CURRENCY', toBase: '1' },
  INR: { dimension: 'CURRENCY', toBase: '1' },
  CAD: { dimension: 'CURRENCY', toBase: '1' },
  // EMISSIONS — base: kg CO2e
  KG_CO2E: { dimension: 'EMISSIONS', toBase: '1' },
  T_CO2E:  { dimension: 'EMISSIONS', toBase: '1000' },
  KG_CO2:  { dimension: 'EMISSIONS', toBase: '1' },
  KG_CH4:  { dimension: 'EMISSIONS', toBase: '1' },
  KG_N2O:  { dimension: 'EMISSIONS', toBase: '1' },
  // dimensionless
  UNIT: { dimension: 'COUNT', toBase: '1' },
} as const satisfies Record<string, { dimension: UnitDimension; toBase: string }>;

export type UnitCode = keyof typeof UNITS;

export const ALL_UNIT_CODES = Object.keys(UNITS) as UnitCode[];

export function dimensionOf(unit: UnitCode): UnitDimension {
  return UNITS[unit].dimension;
}

export function unitsInDimension(dimension: UnitDimension): UnitCode[] {
  return ALL_UNIT_CODES.filter((u) => UNITS[u].dimension === dimension);
}

export class UnitMismatchError extends Error {
  constructor(
    readonly from: UnitCode,
    readonly to: UnitCode,
  ) {
    super(
      `Cannot convert ${from} (${dimensionOf(from)}) to ${to} (${dimensionOf(to)}). ` +
        `Cross-dimension conversion is a fuel property (density / calorific value), not a unit conversion.`,
    );
    this.name = 'UnitMismatchError';
  }
}

export class CurrencyConversionError extends Error {
  constructor(from: UnitCode, to: UnitCode) {
    super(
      `Cannot silently convert ${from} to ${to}. Currency conversion requires an explicit, ` +
        `stored FX rate with a date — see SPEC.md §6.`,
    );
    this.name = 'CurrencyConversionError';
  }
}

/** The multiplier that turns a quantity in `from` into a quantity in `to`. */
export function conversionFactor(from: UnitCode, to: UnitCode): Decimal {
  if (dimensionOf(from) !== dimensionOf(to)) throw new UnitMismatchError(from, to);
  if (dimensionOf(from) === 'CURRENCY' && from !== to) throw new CurrencyConversionError(from, to);
  return new Decimal(UNITS[from].toBase).div(new Decimal(UNITS[to].toBase));
}

export interface ConversionResult {
  quantity: Decimal;
  unit: UnitCode;
  /** snapshotted onto the EmissionRecord so the arithmetic stays reproducible */
  factor: Decimal;
}

export function convert(
  quantity: Decimal | string | number,
  from: UnitCode,
  to: UnitCode,
): ConversionResult {
  const factor = conversionFactor(from, to);
  return { quantity: new Decimal(quantity).mul(factor), unit: to, factor };
}

/** True when a unit may legally be offered for a question of this dimension. */
export function isUnitAllowed(unit: UnitCode, dimension: UnitDimension): boolean {
  return dimensionOf(unit) === dimension;
}
