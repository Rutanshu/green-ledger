/**
 * Some question labels in seed data were authored with
 * {{asset.name}}/{{period.label}} placeholders for a per-asset templating
 * pass that was never built. Resolve what's resolvable (the period) and
 * fall back neutrally for the rest, rather than showing raw template
 * syntax to a user. PURE — no Prisma, no fetch.
 */
export function formatQuestionLabel(label: string, periodLabel: string): string {
  return label.replace(/\{\{period\.label\}\}/g, periodLabel).replace(/\{\{asset\.name\}\}/g, "this equipment");
}
