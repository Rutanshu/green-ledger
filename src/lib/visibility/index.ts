/**
 * `visible_if` evaluation. See SPEC.md §3.15.
 *
 * ONE pure function, used by BOTH client and server — the client renders with it,
 * the server computes completeness with it. Divergence between the two is a whole
 * bug class this eliminates.
 */

export type VisibilityRule =
  | { all: VisibilityRule[] }
  | { any: VisibilityRule[] }
  | { not: VisibilityRule }
  | { site_has_asset: { category?: string; assetTypeCode?: string; fuelOrMaterialCode?: string } }
  | { site_type_in: string[] }
  | { site_country_in: string[] }
  | { answer_equals: { question_code: string; value: unknown } }
  | { answer_greater_than: { question_code: string; value: number } };

export interface VisibilityAsset {
  category: string;
  assetTypeCode: string;
  fuelOrMaterialCode?: string | null;
  status: 'ACTIVE' | 'STANDBY' | 'DECOMMISSIONED';
  commissionedOn?: Date | null;
  decommissionedOn?: Date | null;
}

export interface VisibilityContext {
  siteType: string;
  siteCountry: string;
  assets: readonly VisibilityAsset[];
  /** answers keyed by question code */
  answers: Readonly<Record<string, unknown>>;
  /** the reporting period, so a decommissioned asset still drives its own periods */
  periodStart: Date;
  periodEnd: Date;
}

/** An asset counts if it was in service for any part of the reporting period. */
export function assetActiveInPeriod(a: VisibilityAsset, start: Date, end: Date): boolean {
  if (a.status === 'DECOMMISSIONED' && a.decommissionedOn && a.decommissionedOn < start) return false;
  if (a.commissionedOn && a.commissionedOn > end) return false;
  return true;
}

export function evaluateVisibility(
  rule: VisibilityRule | null | undefined,
  ctx: VisibilityContext,
): boolean {
  if (!rule) return true; // no rule = always visible

  if ('all' in rule) return rule.all.every((r) => evaluateVisibility(r, ctx));
  if ('any' in rule) return rule.any.some((r) => evaluateVisibility(r, ctx));
  if ('not' in rule) return !evaluateVisibility(rule.not, ctx);

  if ('site_has_asset' in rule) {
    const q = rule.site_has_asset;
    return ctx.assets.some((a) => {
      if (!assetActiveInPeriod(a, ctx.periodStart, ctx.periodEnd)) return false;
      if (q.category && a.category !== q.category) return false;
      if (q.assetTypeCode && a.assetTypeCode !== q.assetTypeCode) return false;
      if (q.fuelOrMaterialCode && a.fuelOrMaterialCode !== q.fuelOrMaterialCode) return false;
      return true;
    });
  }

  if ('site_type_in' in rule) return rule.site_type_in.includes(ctx.siteType);
  if ('site_country_in' in rule) return rule.site_country_in.includes(ctx.siteCountry);

  if ('answer_equals' in rule) {
    const { question_code, value } = rule.answer_equals;
    return ctx.answers[question_code] === value;
  }

  if ('answer_greater_than' in rule) {
    const { question_code, value } = rule.answer_greater_than;
    const a = ctx.answers[question_code];
    return typeof a === 'number' && a > value;
  }

  return true;
}

export interface CompletenessInput {
  questions: ReadonlyArray<{
    code: string;
    isRequired: boolean;
    visibleIf?: VisibilityRule | null;
  }>;
  /** codes of questions that are answered or explicitly marked N/A */
  satisfied: ReadonlySet<string>;
}

/**
 * completeness = satisfied required questions / APPLICABLE required questions.
 * Applicability comes from visible_if, so a warehouse is not stuck at 60% forever
 * because it has no boiler.
 */
export function computeCompleteness(input: CompletenessInput, ctx: VisibilityContext) {
  const applicable = input.questions.filter(
    (q) => q.isRequired && evaluateVisibility(q.visibleIf, ctx),
  );
  const done = applicable.filter((q) => input.satisfied.has(q.code));
  const pct = applicable.length === 0 ? 100 : (done.length / applicable.length) * 100;
  return {
    applicable: applicable.length,
    satisfied: done.length,
    pct: Math.round(pct * 100) / 100,
  };
}
