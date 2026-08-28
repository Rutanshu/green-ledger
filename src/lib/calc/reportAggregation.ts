/**
 * Phase 3 of the redesign (imperative-coalescing-hollerith.md): summing
 * already-computed EmissionRecord rows into report shapes. Still
 * emissions arithmetic even though it never touches a factor directly —
 * lives in lib/calc/ per CLAUDE.md rule 1. PURE: Decimal in, Decimal out,
 * no Prisma, no fetch, no Date.now().
 */
import Decimal from 'decimal.js';

export type ReportScope = 'SCOPE_1' | 'SCOPE_2' | 'SCOPE_3';

export interface ReportEmissionRow {
  scope: ReportScope;
  scope3Category: number | null;
  siteId: string;
  siteName: string;
  emissionsKgCo2e: string;
}

export interface SiteTotal {
  siteId: string;
  siteName: string;
  kgCo2e: Decimal;
}

export interface ReportAggregate {
  totalKgCo2e: Decimal;
  totalTonnes: string;
  byScope: Record<ReportScope, Decimal>;
  byScope3Category: Record<number, Decimal>;
  bySite: SiteTotal[];
  recordCount: number;
}

export function aggregateEmissionsForReport(rows: readonly ReportEmissionRow[]): ReportAggregate {
  const byScope: Record<ReportScope, Decimal> = {
    SCOPE_1: new Decimal(0),
    SCOPE_2: new Decimal(0),
    SCOPE_3: new Decimal(0),
  };
  const byScope3Category: Record<number, Decimal> = {};
  const siteTotals = new Map<string, SiteTotal>();
  let total = new Decimal(0);

  for (const row of rows) {
    const kg = new Decimal(row.emissionsKgCo2e);
    total = total.plus(kg);
    byScope[row.scope] = byScope[row.scope].plus(kg);

    if (row.scope === 'SCOPE_3' && row.scope3Category != null) {
      byScope3Category[row.scope3Category] = (byScope3Category[row.scope3Category] ?? new Decimal(0)).plus(kg);
    }

    const existing = siteTotals.get(row.siteId);
    siteTotals.set(row.siteId, {
      siteId: row.siteId,
      siteName: row.siteName,
      kgCo2e: (existing?.kgCo2e ?? new Decimal(0)).plus(kg),
    });
  }

  return {
    totalKgCo2e: total,
    totalTonnes: total.div(1000).toFixed(2),
    byScope,
    byScope3Category,
    bySite: [...siteTotals.values()].sort((a, b) => a.siteName.localeCompare(b.siteName)),
    recordCount: rows.length,
  };
}
