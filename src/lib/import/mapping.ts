/**
 * Column mapping. BUILD_PLAN Step 3.5: "MappingProfile: column -> position
 * ... saveable and reusable." This app's import format is long-form (one
 * row per Answer: site_code, question_code, value, unit, data_quality) —
 * the mapping problem is therefore "which of the customer's own column
 * headers holds each of those five fields," not a per-question column
 * fan-out.
 *
 * PURE MODULE.
 */
export const CANONICAL_FIELDS = ["site_code", "question_code", "value", "unit", "data_quality"] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export type ColumnMapping = Readonly<Partial<Record<string, CanonicalField>>>;

/** A CSV whose headers already match the canonical names 1:1 needs no saved profile at all. */
export function identityMapping(headers: readonly string[]): ColumnMapping {
  const mapping: Record<string, CanonicalField> = {};
  for (const h of headers) {
    if ((CANONICAL_FIELDS as readonly string[]).includes(h)) mapping[h] = h as CanonicalField;
  }
  return mapping;
}

export type MappedRow = Partial<Record<CanonicalField, string>>;

export function applyMapping(row: Readonly<Record<string, string>>, mapping: ColumnMapping): MappedRow {
  const out: MappedRow = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field && row[header] !== undefined) out[field] = row[header];
  }
  return out;
}
