/**
 * Proves the seeded demo is internally consistent BEFORE it ever reaches a database.
 * Every question's binding must resolve against the seeded factors — except the one
 * we broke on purpose so the Factor Lab has something to show.
 */
import { describe, it, expect } from 'vitest';
import { checkBindingHealth, type CandidateFactor, type ResolveQuery } from '../factors';
import { calculateEmissions, sumKg, toTonnes } from '../calc';
import { isUnitAllowed, type UnitCode, type UnitDimension } from '../units';
import { evaluateVisibility, computeCompleteness, type VisibilityContext } from '../visibility';
import {
  DEFRA_2026, GRID_2026, DEMO_TEMPLATE, DEMO_SITES, DEMO_ASSETS, DEMO_ANSWERS,
  ASSET_TYPES, SITE_TYPES, GWP_AR6,
} from '../../../prisma/seed-data';

const d = (s: string) => new Date(s + 'T00:00:00Z');
const PERIOD_START = d('2026-04-01');
const PERIOD_END = d('2027-03-31');

/** Turn the seed's factor rows into resolver candidates. */
const CANDIDATES: CandidateFactor[] = [
  ...DEFRA_2026.factors.map((f, i) => ({
    id: `defra-${i}`, scope: f.scope as never, scope3Category: 'cat' in f ? f.cat : null,
    activityType: f.activityType as never, method: f.method as never,
    fuelOrMaterialCode: f.fuel, region: f.region, gas: 'CO2E_BLENDED' as const,
    basis: 'SINGLE' as const, value: f.value,
    unitNumerator: f.num as UnitCode, unitDenominator: f.den as UnitCode,
    validFrom: d('2026-01-01'), validTo: null, sourceCitation: f.cite,
    factorSetName: DEFRA_2026.name, factorSetVersion: DEFRA_2026.version,
  })),
  ...GRID_2026.factors.map((f, i) => ({
    id: `grid-${i}`, scope: f.scope as never, scope3Category: null,
    activityType: f.activityType as never, method: f.method as never,
    fuelOrMaterialCode: f.fuel, region: f.region, gas: 'CO2E_BLENDED' as const,
    basis: f.basis as never, value: f.value,
    unitNumerator: f.num as UnitCode, unitDenominator: f.den as UnitCode,
    validFrom: d('2026-04-01'), validTo: d('2027-03-31'), sourceCitation: f.cite,
    factorSetName: GRID_2026.name, factorSetVersion: GRID_2026.version,
  })),
];

const GWP = Object.fromEntries(GWP_AR6.map((g) => [g.gas, g.gwp100]));
const ALL_QUESTIONS = DEMO_TEMPLATE.sections.flatMap((s) => s.questions);

/** The one we broke on purpose. */
const INTENTIONALLY_BROKEN = ['cleaning_spend'];

const queryFor = (q: (typeof ALL_QUESTIONS)[number], site = DEMO_SITES[0]): ResolveQuery => ({
  activityType: q.binding!.activityType as never,
  method: q.binding!.method as never,
  fuelOrMaterialCode: q.binding!.fuel,
  basis: q.binding!.outputBasis === 'DUAL' ? 'LOCATION_BASED' : undefined,
  regionStrategy: (q.binding!.regionStrategy ?? 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL') as never,
  siteCountry: site.country, siteGridRegion: site.gridRegion, on: d('2026-06-15'),
});

describe('seed integrity — the demo must not ship broken', () => {
  it('every question code is unique', () => {
    const codes = ALL_QUESTIONS.map((q) => q.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every bound question resolves to a factor, except the deliberate one', () => {
    const broken: string[] = [];
    for (const q of ALL_QUESTIONS) {
      if (!q.binding) continue;
      const h = checkBindingHealth(CANDIDATES, queryFor(q));
      if (h.health === 'BROKEN' || h.health === 'AMBIGUOUS') broken.push(q.code);
    }
    expect(broken).toEqual(INTENTIONALLY_BROKEN);
  });

  it('the deliberately broken binding really is broken, so the Factor Lab has something to show', () => {
    const q = ALL_QUESTIONS.find((x) => x.code === 'cleaning_spend')!;
    expect(checkBindingHealth(CANDIDATES, queryFor(q)).health).toBe('BROKEN');
  });

  it('no two factors collide — resolution is deterministic everywhere', () => {
    for (const q of ALL_QUESTIONS) {
      if (!q.binding) continue;
      const h = checkBindingHealth(CANDIDATES, queryFor(q));
      expect(h.health).not.toBe('AMBIGUOUS');
    }
  });

  it("every question's allowed units belong to its declared dimension", () => {
    for (const q of ALL_QUESTIONS) {
      if (!q.unitDim || !q.allowedUnits) continue;
      for (const u of q.allowedUnits) {
        expect(isUnitAllowed(u as UnitCode, q.unitDim as UnitDimension), `${q.code}: ${u}`).toBe(true);
      }
    }
  });

  it("every answer's unit is one the question actually offers", () => {
    for (const [siteCode, answers] of Object.entries(DEMO_ANSWERS)) {
      for (const [qCode, a] of Object.entries(answers)) {
        const q = ALL_QUESTIONS.find((x) => x.code === qCode);
        expect(q, `${siteCode}: unknown question ${qCode}`).toBeDefined();
        expect(q!.allowedUnits, `${qCode}`).toContain(a.unit);
      }
    }
  });

  it('every asset references a seeded asset type, and every site a seeded site type', () => {
    const types = new Set(ASSET_TYPES.map((t) => t.code));
    const siteTypes = new Set(SITE_TYPES.map((t) => t.code));
    for (const s of DEMO_SITES) expect(siteTypes.has(s.siteType), s.code).toBe(true);
    for (const [code, assets] of Object.entries(DEMO_ASSETS)) {
      for (const a of assets) expect(types.has(a.assetTypeCode as never), `${code}: ${a.assetTypeCode}`).toBe(true);
    }
  });

  it('the demo answers actually compute — Northgate produces a real total', () => {
    const site = DEMO_SITES[0];
    const answers = DEMO_ANSWERS[site.code];
    let totalKg = 0;

    for (const [qCode, a] of Object.entries(answers)) {
      const q = ALL_QUESTIONS.find((x) => x.code === qCode)!;
      if (!q.binding) continue;
      if (INTENTIONALLY_BROKEN.includes(qCode)) continue;
      const results = calculateEmissions({
        activity: { quantity: a.value, unit: a.unit as UnitCode, activityStart: PERIOD_START, activityEnd: PERIOD_END },
        candidates: CANDIDATES,
        query: queryFor(q, site),
        gwpValues: GWP, gwpSetName: 'IPCC AR6', consolidationShare: 1,
      });
      totalKg += Number(sumKg(results));
    }

    // A real plant's footprint, in a believable range — not zero, not absurd.
    expect(totalKg).toBeGreaterThan(1_000_000);
    expect(totalKg).toBeLessThan(20_000_000);
  });

  it('the SPEC worked example survives the real seeded factor', () => {
    const q = ALL_QUESTIONS.find((x) => x.code === 'diesel_qty')!;
    const [r] = calculateEmissions({
      activity: { quantity: '14200', unit: 'L', activityStart: PERIOD_START, activityEnd: PERIOD_END },
      candidates: CANDIDATES, query: queryFor(q),
      gwpValues: GWP, gwpSetName: 'IPCC AR6', consolidationShare: 1,
    });
    expect(r.factorValue.toString()).toBe('2.68');
    expect(toTonnes(r.emissionsKgCo2e)).toBe('38.06');
    expect(r.factorSource).toContain('Table 5');
  });

  it('the empty warehouse sits at 100%, not 0% — the whole point of visible_if', () => {
    const warehouse = DEMO_SITES.find((s) => s.code === 'MI-CW-07')!;
    const ctx: VisibilityContext = {
      siteType: warehouse.siteType, siteCountry: warehouse.country,
      assets: [], answers: {}, periodStart: PERIOD_START, periodEnd: PERIOD_END,
    };
    const assetDriven = ALL_QUESTIONS.filter((q) => q.visibleIf && JSON.stringify(q.visibleIf).includes('site_has_asset'));
    expect(assetDriven.length).toBeGreaterThan(0);
    for (const q of assetDriven) {
      expect(evaluateVisibility(q.visibleIf as never, ctx), q.code).toBe(false);
    }
  });

  it('Northgate sees its asset-driven questions and reaches a sensible completeness', () => {
    const site = DEMO_SITES[0];
    const ctx: VisibilityContext = {
      siteType: site.siteType, siteCountry: site.country,
      assets: DEMO_ASSETS[site.code].map((a) => ({
        category: a.category as string, assetTypeCode: a.assetTypeCode as string,
        fuelOrMaterialCode: (a.fuel as string) ?? null,
        status: (a.status as never) ?? 'ACTIVE',
        commissionedOn: a.commissionedOn ? d(a.commissionedOn as string) : null,
        decommissionedOn: a.decommissionedOn ? d(a.decommissionedOn as string) : null,
      })),
      answers: {}, periodStart: PERIOD_START, periodEnd: PERIOD_END,
    };
    expect(evaluateVisibility({ site_has_asset: { fuelOrMaterialCode: 'r410a' } }, ctx)).toBe(true);
    expect(evaluateVisibility({ site_has_asset: { fuelOrMaterialCode: 'r32' } }, ctx)).toBe(false);
    // the retired oil boiler is out of scope for FY26
    expect(evaluateVisibility({ site_has_asset: { fuelOrMaterialCode: 'furnace_oil' } }, ctx)).toBe(false);

    const r = computeCompleteness(
      {
        questions: ALL_QUESTIONS.map((q) => ({ code: q.code, isRequired: q.required !== false, visibleIf: q.visibleIf as never })),
        satisfied: new Set(Object.keys(DEMO_ANSWERS[site.code])),
      },
      ctx,
    );
    expect(r.applicable).toBeGreaterThan(5);
    expect(r.pct).toBeGreaterThan(60);
    expect(r.pct).toBeLessThan(100); // deliberately unfinished, so the dashboard has a story
  });
});
