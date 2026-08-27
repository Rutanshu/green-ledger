/**
 * The DB-touching half of the label layer — kept out of index.ts, which
 * stays a pure module per its own header comment (no Prisma, takes the
 * override list as an argument).
 */
import { orgScopedClient } from "@/lib/db/tenant";
import type { LabelOverride } from "./index";

export async function getOrgLabelOverrides(orgId: string): Promise<LabelOverride[]> {
  const db = orgScopedClient(orgId);
  const rows = await db.labelOverride.findMany();
  return rows.map((r) => ({
    entityKind: r.entityKind,
    code: r.code,
    scopeKey: r.scopeKey,
    label: r.label,
    shortLabel: r.shortLabel,
    description: r.description,
    locale: r.locale,
    isHidden: r.isHidden,
    sortOrder: r.sortOrder,
  }));
}
