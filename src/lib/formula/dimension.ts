/**
 * Dimensional analysis for the formula engine. GHG_TOOL_ARCHITECTURE.md §10:
 * "kWh + L is rejected; kWh / m² yields an intensity dimension." The app's
 * existing UnitDimension (lib/units) is a closed set of nine base
 * dimensions — this is the general algebra OVER that set: a formula's
 * dimension is a power-map (ENERGY^1, or EMISSIONS^1 x CURRENCY^-1 for an
 * intensity), which is what multiplication and division actually produce
 * and what a single enum value can't represent.
 *
 * PURE MODULE.
 */
import type { UnitDimension } from '../units';
import type { FormulaNode } from './parse';

/** e.g. { EMISSIONS: 1, CURRENCY: -1 } for "emissions per currency spent". Missing key = power 0. */
export type Dimension = Readonly<Partial<Record<UnitDimension, number>>>;

export const DIMENSIONLESS: Dimension = {};

export function dimensionOfBase(base: UnitDimension): Dimension {
  return { [base]: 1 };
}

/** Internal working representation — a plain string-keyed map, zero powers dropped. `Dimension` (the public type) is just this cast to the closed key set at the API boundary. */
function normalize(d: Dimension): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v) out[k] = v;
  }
  return out;
}

export class DimensionMismatchError extends Error {
  constructor(
    readonly left: Dimension,
    readonly right: Dimension,
    readonly op: '+' | '-',
  ) {
    super(
      `Cannot ${op === '+' ? 'add' : 'subtract'} ${formatDimension(left)} and ${formatDimension(right)} — ` +
        `they are different dimensions. Only quantities of the same dimension can be added or subtracted.`,
    );
    this.name = 'DimensionMismatchError';
  }
}

function sameDimension(a: Dimension, b: Dimension): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)]);
  for (const k of keys) if ((na[k] ?? 0) !== (nb[k] ?? 0)) return false;
  return true;
}

/** + and - require identical dimensions — rejects kWh + L. */
export function addDimension(a: Dimension, b: Dimension, op: '+' | '-' = '+'): Dimension {
  if (!sameDimension(a, b)) throw new DimensionMismatchError(a, b, op);
  return a;
}

/** * multiplies power-maps — combines exponents. */
export function multiplyDimension(a: Dimension, b: Dimension): Dimension {
  const out: Record<string, number> = { ...normalize(a) };
  for (const [k, v] of Object.entries(normalize(b))) out[k] = (out[k] ?? 0) + v;
  return normalize(out as unknown as Dimension) as Dimension;
}

/** / subtracts the denominator's power-map — this is how an intensity dimension is produced. */
export function divideDimension(a: Dimension, b: Dimension): Dimension {
  const out: Record<string, number> = { ...normalize(a) };
  for (const [k, v] of Object.entries(normalize(b))) out[k] = (out[k] ?? 0) - v;
  return normalize(out as unknown as Dimension) as Dimension;
}

export function isDimensionless(d: Dimension): boolean {
  return Object.keys(normalize(d)).length === 0;
}

export function formatDimension(d: Dimension): string {
  const n = normalize(d);
  const keys = Object.keys(n);
  if (keys.length === 0) return 'dimensionless';
  return keys
    .sort()
    .map((k) => (n[k] === 1 ? k : `${k}^${n[k]}`))
    .join(' · ');
}

/**
 * Walks a parsed formula computing its dimension at parse time, before any
 * value is available — "kWh + L is rejected; kWh / m² yields an intensity
 * dimension." `identifierDimension` supplies the dimension of every
 * position/indicator code the formula reads; an unknown identifier throws.
 * `siteAttributeDimension` is consulted for SITE_ATTRIBUTE("code") calls —
 * an attribute not listed there is treated as dimensionless.
 */
export function checkFormulaDimension(
  node: FormulaNode,
  identifierDimension: Readonly<Record<string, Dimension>>,
  siteAttributeDimension: Readonly<Record<string, Dimension>> = {},
): Dimension {
  switch (node.type) {
    case 'number':
      return DIMENSIONLESS;
    case 'string':
      return DIMENSIONLESS;
    case 'identifier': {
      const dim = identifierDimension[node.code];
      if (dim === undefined) {
        throw new Error(`Unknown position/indicator "${node.code}" — it isn't in the identifier dimension table.`);
      }
      return dim;
    }
    case 'unaryMinus':
      return checkFormulaDimension(node.operand, identifierDimension, siteAttributeDimension);
    case 'binary': {
      const left = checkFormulaDimension(node.left, identifierDimension, siteAttributeDimension);
      const right = checkFormulaDimension(node.right, identifierDimension, siteAttributeDimension);
      // A bare numeric literal (5, 0, -1...) carries no dimension of its
      // own and is compatible with anything for +/-/comparison — "x > 0"
      // is an ordinary, common formula and must not be rejected just
      // because 0 has no inherent dimension. This does NOT relax += for
      // two identifiers/expressions of different dimensions — only a
      // literal on one side is polymorphic.
      const leftIsLiteral = node.left.type === 'number';
      const rightIsLiteral = node.right.type === 'number';
      const literalPermissive = leftIsLiteral || rightIsLiteral;
      switch (node.op) {
        case '+':
        case '-':
          if (literalPermissive) return leftIsLiteral ? right : left;
          return addDimension(left, right, node.op);
        case '*':
          return multiplyDimension(left, right);
        case '/':
          return divideDimension(left, right);
        case '<':
        case '>':
        case '<=':
        case '>=':
        case '==':
        case '!=':
          if (!literalPermissive) addDimension(left, right, '+'); // comparable => same dimension; throws otherwise
          return DIMENSIONLESS;
      }
      break;
    }
    case 'conditional': {
      checkFormulaDimension(node.test, identifierDimension, siteAttributeDimension);
      const whenTrue = checkFormulaDimension(node.whenTrue, identifierDimension, siteAttributeDimension);
      const whenFalse = checkFormulaDimension(node.whenFalse, identifierDimension, siteAttributeDimension);
      return addDimension(whenTrue, whenFalse, '+');
    }
    case 'call': {
      if (node.name === 'SITE_ATTRIBUTE') {
        const arg = node.args[0];
        const key = arg && arg.type === 'string' ? arg.value : undefined;
        if (!key) return DIMENSIONLESS;
        return siteAttributeDimension[key] ?? DIMENSIONLESS;
      }
      if (node.name === 'PRIOR_PERIOD') {
        return checkFormulaDimension(node.args[0], identifierDimension, siteAttributeDimension);
      }
      // SUM / AVG / MIN / MAX: every argument must share one dimension.
      const dims = node.args.map((a) => checkFormulaDimension(a, identifierDimension, siteAttributeDimension));
      return dims.reduce((acc, d) => addDimension(acc, d, '+'), dims[0] ?? DIMENSIONLESS);
    }
  }
  throw new Error('Unreachable formula node');
}
