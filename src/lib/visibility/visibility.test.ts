import { describe, it, expect } from 'vitest';
import { evaluateVisibility, computeCompleteness, assetActiveInPeriod, type VisibilityContext, type VisibilityAsset } from './index';

const d = (s: string) => new Date(s + 'T00:00:00Z');

const asset = (p: Partial<VisibilityAsset>): VisibilityAsset => ({
  category: 'STATIONARY_COMBUSTION', assetTypeCode: 'diesel_generator',
  fuelOrMaterialCode: 'diesel', status: 'ACTIVE', ...p,
});

const ctx = (p: Partial<VisibilityContext> = {}): VisibilityContext => ({
  siteType: 'MANUFACTURING', siteCountry: 'GB',
  assets: [asset({}), asset({ category: 'REFRIGERATION', assetTypeCode: 'chiller', fuelOrMaterialCode: 'r410a' })],
  answers: {}, periodStart: d('2026-04-01'), periodEnd: d('2027-03-31'), ...p,
});

describe('visibility rules', () => {
  it('no rule means always visible', () => {
    expect(evaluateVisibility(null, ctx())).toBe(true);
  });

  it('site_has_asset is what makes the right questions appear', () => {
    expect(evaluateVisibility({ site_has_asset: { fuelOrMaterialCode: 'r410a' } }, ctx())).toBe(true);
    expect(evaluateVisibility({ site_has_asset: { fuelOrMaterialCode: 'r134a' } }, ctx())).toBe(false);
  });

  it('a warehouse with no assets sees none of the asset-driven questions', () => {
    const warehouse = ctx({ siteType: 'WAREHOUSE', assets: [] });
    expect(evaluateVisibility({ site_has_asset: { category: 'STATIONARY_COMBUSTION' } }, warehouse)).toBe(false);
  });

  it('combines with all / any / not', () => {
    const c = ctx();
    expect(evaluateVisibility({ all: [{ site_type_in: ['MANUFACTURING'] }, { site_has_asset: { fuelOrMaterialCode: 'diesel' } }] }, c)).toBe(true);
    expect(evaluateVisibility({ all: [{ site_type_in: ['OFFICE'] }, { site_has_asset: { fuelOrMaterialCode: 'diesel' } }] }, c)).toBe(false);
    expect(evaluateVisibility({ any: [{ site_type_in: ['OFFICE'] }, { site_type_in: ['MANUFACTURING'] }] }, c)).toBe(true);
    expect(evaluateVisibility({ not: { site_type_in: ['OFFICE'] } }, c)).toBe(true);
  });

  it('a previous answer can reveal follow-up questions', () => {
    const c = ctx({ answers: { used_furnace_oil: true, staff_count: 400 } });
    expect(evaluateVisibility({ answer_equals: { question_code: 'used_furnace_oil', value: true } }, c)).toBe(true);
    expect(evaluateVisibility({ answer_equals: { question_code: 'used_furnace_oil', value: false } }, c)).toBe(false);
    expect(evaluateVisibility({ answer_greater_than: { question_code: 'staff_count', value: 250 } }, c)).toBe(true);
  });

  it('a decommissioned asset still drives questions for periods it was active in', () => {
    const retired = asset({ status: 'DECOMMISSIONED', decommissionedOn: d('2025-11-30'), fuelOrMaterialCode: 'furnace_oil' });
    expect(assetActiveInPeriod(retired, d('2025-04-01'), d('2026-03-31'))).toBe(true);  // FY25 — yes
    expect(assetActiveInPeriod(retired, d('2026-04-01'), d('2027-03-31'))).toBe(false); // FY26 — no
  });

  it('an asset commissioned after the period ends does not count yet', () => {
    const future = asset({ commissionedOn: d('2027-06-01') });
    expect(assetActiveInPeriod(future, d('2026-04-01'), d('2027-03-31'))).toBe(false);
  });
});

describe('completeness', () => {
  const questions = [
    { code: 'diesel', isRequired: true, visibleIf: { site_has_asset: { fuelOrMaterialCode: 'diesel' } } },
    { code: 'r410a', isRequired: true, visibleIf: { site_has_asset: { fuelOrMaterialCode: 'r410a' } } },
    { code: 'furnace_oil', isRequired: true, visibleIf: { site_has_asset: { fuelOrMaterialCode: 'furnace_oil' } } },
    { code: 'notes', isRequired: false, visibleIf: null },
  ];

  it('counts only APPLICABLE required questions', () => {
    // furnace_oil is not applicable — the site has no furnace-oil asset
    const r = computeCompleteness({ questions, satisfied: new Set(['diesel']) }, ctx());
    expect(r.applicable).toBe(2);
    expect(r.satisfied).toBe(1);
    expect(r.pct).toBe(50);
  });

  it('a site with nothing applicable is 100%, not 0% — the warehouse problem', () => {
    const r = computeCompleteness({ questions, satisfied: new Set() }, ctx({ assets: [] }));
    expect(r.applicable).toBe(0);
    expect(r.pct).toBe(100);
  });

  it('reaches 100% when every applicable required question is satisfied', () => {
    const r = computeCompleteness({ questions, satisfied: new Set(['diesel', 'r410a']) }, ctx());
    expect(r.pct).toBe(100);
  });

  it('N/A with a reason counts as satisfied', () => {
    const r = computeCompleteness({ questions, satisfied: new Set(['diesel', 'r410a']) }, ctx());
    expect(r.satisfied).toBe(2);
  });
});
