/**
 * CLAUDE.md rule 12: "No hardcoded user-visible strings. Every label goes
 * through resolveLabel() / the <Label> component." This is that component
 * — the only place resolveLabel()'s output should reach the DOM.
 *
 * Takes an already-fetched overrides list (one query per page via
 * getOrgLabelOverrides(), not one per <Label>) so rendering many labels on
 * one page doesn't N+1. A page fetches overrides once and passes it down.
 */
import { resolveLabel, type LabelEntityKind, type LabelContext, type LabelOverride } from "@/lib/labels";
import { SYSTEM_DEFAULTS } from "@/lib/labels/systemDefaults";

export function Label({
  entityKind,
  code,
  overrides,
  context,
  className,
}: {
  entityKind: LabelEntityKind;
  code: string;
  overrides: readonly LabelOverride[];
  context?: LabelContext;
  className?: string;
}) {
  const resolved = resolveLabel(entityKind, code, overrides, SYSTEM_DEFAULTS[entityKind] ?? {}, context);
  return <span className={className}>{resolved.label}</span>;
}

/** For places that need the plain string (a <select> option, an aria-label) rather than a rendered element. */
export function labelText(
  entityKind: LabelEntityKind,
  code: string,
  overrides: readonly LabelOverride[],
  context?: LabelContext,
): string {
  return resolveLabel(entityKind, code, overrides, SYSTEM_DEFAULTS[entityKind] ?? {}, context).label;
}
