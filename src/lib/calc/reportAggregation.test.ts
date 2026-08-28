import { describe, it, expect } from 'vitest';
import { aggregateEmissionsForReport, type ReportEmissionRow } from './reportAggregation';

const row = (overrides: Partial<ReportEmissionRow>): ReportEmissionRow => ({
  scope: 'SCOPE_1',
  scope3Category: null,
  siteId: 's1',
  siteName: 'Site One',
  emissionsKgCo2e: '100',
  ...overrides,
});

describe('aggregateEmissionsForReport', () => {
  it('sums an empty set to zero without dividing by zero', () => {
    const result = aggregateEmissionsForReport([]);
    expect(result.totalKgCo2e.toString()).toBe('0');
    expect(result.totalTonnes).toBe('0.00');
    expect(result.recordCount).toBe(0);
    expect(result.bySite).toEqual([]);
  });

  it('sums totals and per-scope totals across scopes', () => {
    const result = aggregateEmissionsForReport([
      row({ scope: 'SCOPE_1', emissionsKgCo2e: '1000' }),
      row({ scope: 'SCOPE_2', emissionsKgCo2e: '2000' }),
      row({ scope: 'SCOPE_3', emissionsKgCo2e: '500', scope3Category: 6 }),
    ]);
    expect(result.totalKgCo2e.toString()).toBe('3500');
    expect(result.totalTonnes).toBe('3.50');
    expect(result.byScope.SCOPE_1.toString()).toBe('1000');
    expect(result.byScope.SCOPE_2.toString()).toBe('2000');
    expect(result.byScope.SCOPE_3.toString()).toBe('500');
  });

  it('groups Scope 3 by category, ignoring rows with no category', () => {
    const result = aggregateEmissionsForReport([
      row({ scope: 'SCOPE_3', scope3Category: 6, emissionsKgCo2e: '300' }),
      row({ scope: 'SCOPE_3', scope3Category: 6, emissionsKgCo2e: '200' }),
      row({ scope: 'SCOPE_3', scope3Category: 1, emissionsKgCo2e: '50' }),
      row({ scope: 'SCOPE_3', scope3Category: null, emissionsKgCo2e: '999' }),
    ]);
    expect(result.byScope3Category[6].toString()).toBe('500');
    expect(result.byScope3Category[1].toString()).toBe('50');
    expect(Object.keys(result.byScope3Category)).toHaveLength(2);
  });

  it('groups by site and sorts sites alphabetically by name', () => {
    const result = aggregateEmissionsForReport([
      row({ siteId: 'b', siteName: 'Riverside Office', emissionsKgCo2e: '10' }),
      row({ siteId: 'a', siteName: 'Ashford Data Centre', emissionsKgCo2e: '20' }),
      row({ siteId: 'a', siteName: 'Ashford Data Centre', emissionsKgCo2e: '5' }),
    ]);
    expect(result.bySite.map((s) => s.siteName)).toEqual(['Ashford Data Centre', 'Riverside Office']);
    expect(result.bySite[0].kgCo2e.toString()).toBe('25');
    expect(result.bySite[1].kgCo2e.toString()).toBe('10');
  });

  it('never uses floating point for decimal-heavy sums', () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE754 — Decimal must not inherit that.
    const result = aggregateEmissionsForReport([
      row({ emissionsKgCo2e: '0.1' }),
      row({ emissionsKgCo2e: '0.2' }),
    ]);
    expect(result.totalKgCo2e.toString()).toBe('0.3');
  });
});
