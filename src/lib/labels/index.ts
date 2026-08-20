/**
 * The label layer. See SPEC.md §3.19.
 *
 * Codes are the system's; labels are the customer's. Renaming a label can NEVER
 * change a number — every calculation, factor lookup, CSV key and audit record
 * uses the code.
 *
 * PURE MODULE: takes the override list as an argument; never queries a database.
 */

export const LABEL_ENTITY_KINDS = [
  'SCOPE', 'SCOPE3_CATEGORY', 'ACTIVITY_TYPE', 'METHOD', 'ASSET_TYPE', 'ASSET_CATEGORY',
  'SITE_TYPE', 'FUEL_OR_MATERIAL', 'UNIT', 'DATA_QUALITY', 'STATUS', 'SECTION',
  'QUESTION', 'DENOMINATOR', 'ROLE', 'DOCUMENT_TYPE',
] as const;
export type LabelEntityKind = (typeof LABEL_ENTITY_KINDS)[number];

export interface LabelOverride {
  entityKind: LabelEntityKind;
  code: string;
  /** `binding:<id>` | `question:<id>` | `template:<id>` | `site_type:<code>` | `org` */
  scopeKey: string;
  label: string;
  shortLabel?: string | null;
  description?: string | null;
  /** BCP-47, or '*' for all locales */
  locale: string;
  isHidden?: boolean;
  sortOrder?: number | null;
}

export interface LabelContext {
  bindingId?: string | null;
  questionId?: string | null;
  templateId?: string | null;
  siteType?: string | null;
  locale?: string;
}

export interface ResolvedLabel {
  code: string;
  label: string;
  shortLabel: string;
  description: string | null;
  /** which layer supplied it — shown in the Labels admin screen */
  source: 'binding' | 'question' | 'template' | 'site_type' | 'org' | 'system';
  isHidden: boolean;
}

/**
 * Most specific wins. This ORDER is the whole feature.
 * binding > question > template > site type > organisation > system default
 */
export function scopeKeyPrecedence(ctx: LabelContext): Array<{ key: string; source: ResolvedLabel['source'] }> {
  const out: Array<{ key: string; source: ResolvedLabel['source'] }> = [];
  if (ctx.bindingId) out.push({ key: `binding:${ctx.bindingId}`, source: 'binding' });
  if (ctx.questionId) out.push({ key: `question:${ctx.questionId}`, source: 'question' });
  if (ctx.templateId) out.push({ key: `template:${ctx.templateId}`, source: 'template' });
  if (ctx.siteType) out.push({ key: `site_type:${ctx.siteType}`, source: 'site_type' });
  out.push({ key: 'org', source: 'org' });
  return out;
}

export interface SystemDefault {
  label: string;
  shortLabel?: string;
  description?: string;
}

export function resolveLabel(
  entityKind: LabelEntityKind,
  code: string,
  overrides: readonly LabelOverride[],
  systemDefaults: Readonly<Record<string, SystemDefault>>,
  ctx: LabelContext = {},
): ResolvedLabel {
  const locale = ctx.locale ?? '*';
  const candidates = overrides.filter(
    (o) => o.entityKind === entityKind && o.code === code && (o.locale === locale || o.locale === '*'),
  );

  for (const { key, source } of scopeKeyPrecedence(ctx)) {
    // an exact-locale override beats a wildcard one at the same scope level
    const atScope = candidates.filter((o) => o.scopeKey === key);
    const hit = atScope.find((o) => o.locale === locale) ?? atScope.find((o) => o.locale === '*');
    if (hit) {
      return {
        code,
        label: hit.label,
        shortLabel: hit.shortLabel ?? hit.label,
        description: hit.description ?? systemDefaults[code]?.description ?? null,
        source,
        isHidden: hit.isHidden ?? false,
      };
    }
  }

  const sys = systemDefaults[code];
  return {
    code,
    label: sys?.label ?? code,
    shortLabel: sys?.shortLabel ?? sys?.label ?? code,
    description: sys?.description ?? null,
    source: 'system',
    isHidden: false,
  };
}

/** Options for a dropdown: resolved, hidden entries removed, sorted by override order then label. */
export function resolveOptions(
  entityKind: LabelEntityKind,
  codes: readonly string[],
  overrides: readonly LabelOverride[],
  systemDefaults: Readonly<Record<string, SystemDefault>>,
  ctx: LabelContext = {},
): ResolvedLabel[] {
  const sortOf = (code: string) =>
    overrides.find((o) => o.entityKind === entityKind && o.code === code && o.sortOrder != null)?.sortOrder ??
    Number.MAX_SAFE_INTEGER;

  return codes
    .map((c) => resolveLabel(entityKind, c, overrides, systemDefaults, ctx))
    .filter((r) => !r.isHidden)
    .sort((a, b) => sortOf(a.code) - sortOf(b.code) || a.label.localeCompare(b.label));
}

/**
 * Closed taxonomies come from the GHG Protocol / ESRS. They can be RELABELLED
 * but never extended — adding to them would break the report mapping.
 */
export const CLOSED_KINDS: readonly LabelEntityKind[] = [
  'SCOPE', 'SCOPE3_CATEGORY', 'METHOD', 'DATA_QUALITY', 'ACTIVITY_TYPE', 'STATUS', 'ROLE', 'UNIT',
];

export function isExtensible(kind: LabelEntityKind): boolean {
  return !CLOSED_KINDS.includes(kind);
}
