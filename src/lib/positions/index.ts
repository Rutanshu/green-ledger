/**
 * Position immutability guard. GHG_TOOL_ARCHITECTURE.md / BUILD_PLAN Step
 * 2.2: "Type and dimension are immutable once any data exists against the
 * position... changing a position's type when data exists throws."
 *
 * PURE MODULE — no Prisma, no fetch. The caller computes `hasData` (an
 * indexed EXISTS check against PositionValue/PositionAssetValue for this
 * position, run inside the same transaction as the update so it can't
 * race a concurrent write) and passes it in; this module only decides
 * whether the specific fields being changed are allowed to change.
 */
export type PositionType = "ASSET" | "FLOW" | "INDICATOR" | "OVERVIEW" | "QUESTION" | "TEXT";
export type UnitDimension =
  | "VOLUME" | "MASS" | "ENERGY" | "DISTANCE" | "MASS_DISTANCE"
  | "PASSENGER_DISTANCE" | "CURRENCY" | "EMISSIONS" | "COUNT";

export class PositionImmutableFieldError extends Error {
  constructor(readonly field: "type" | "dimension", readonly from: unknown, readonly to: unknown) {
    super(`Position ${field} is immutable once data exists (was ${String(from)}, tried to change to ${String(to)}).`);
    this.name = "PositionImmutableFieldError";
  }
}

/**
 * Throws PositionImmutableFieldError if `next` changes `type` or
 * `dimension` while `hasData` is true. Every other field (label, tags,
 * help text, visibility, etc.) stays editable regardless of data —
 * only type and dimension are locked, per the spec's own wording.
 */
export function assertPositionMutable(
  current: { type: PositionType; dimension: UnitDimension | null },
  next: { type: PositionType; dimension: UnitDimension | null },
  hasData: boolean,
): void {
  if (!hasData) return;
  if (current.type !== next.type) throw new PositionImmutableFieldError("type", current.type, next.type);
  if (current.dimension !== next.dimension) throw new PositionImmutableFieldError("dimension", current.dimension, next.dimension);
}
