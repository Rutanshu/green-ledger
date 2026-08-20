import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateEmissions, calculateDualBasis, sumKg, toTonnes, CALC_ENGINE_VERSION, type CalcInput } from './index';
import type { CandidateFactor } from '../factors';
import { UnitMismatchError } from '../units';

const d = (s: string) => new Date(s + 'T00:00:00Z');

const DEFRA_2026_V1_0: CandidateFactor = {
  id: 'defra-diesel-2026-v1.0', scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION',
  method: 'FUEL_BASED', fuelOrMaterialCode: 'diesel', region: 'GLOBAL', gas: 'CO2E_BLENDED',
  basis: 'SINGLE', value: '2.68', unitNumerator: 'KG_CO2E', unitDenominator: 'L',
  validFrom: d('2026-01-01'), validTo: d('2026-12-31'),
  sourceCitation: 'Table 5', factorSetName: 'DEFRA 2026', factorSetVersion: 'v1.0',
};

const DEFRA_2026_V1_1: CandidateFactor = {
  ...DEFRA_2026_V1_0, id: 'defra-diesel-2026-v1.1', value: '2.71', factorSetVersion: 'v1.1',
};

const base = (over: Partial<CalcInput> = {}): CalcInput => ({
  activity: { quantity: '14200', unit: 'L', activityStart: d('2026-03-01'), activityEnd: d('2026-03-31') },
  candidates: [DEFRA_2026_V1_0],
  query: {
    activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuelOrMaterialCode: 'diesel',
    regionStrategy: 'GLOBAL_ONLY', siteCountry: 'GB', siteGridRegion: 'GB-NAT',
  },
  gwpValues: { CO2E_BLENDED: 1, CH4: '27.9', N2O: '273' },
  gwpSetName: 'IPCC AR6',
  consolidationShare: 1,
  ...over,
});

describe('calculation engine', () => {
  it('the worked example from SPEC.md: 14,200 L diesel = 38,056 kg = 38.06 t', () => {
    const [r] = calculateEmissions(base());
    expect(r.emissionsKgCo2e.toString()).toBe('38056');
    expect(toTonnes(r.emissionsKgCo2e)).toBe('38.06');
  });

  it('snapshots EVERY input onto the result', () => {
    const [r] = calculateEmissions(base());
    expect(r.quantityNormalised.toString()).toBe('14200');
    expect(r.unitNormalised).toBe('L');
    expect(r.unitConversionFactor.toString()).toBe('1');
    expect(r.factorValue.toString()).toBe('2.68');
    expect(r.factorSource).toBe('DEFRA 2026 v1.0, Table 5');
    expect(r.factorVersion).toBe('v1.0');
    expect(r.gwpValue.toString()).toBe('1');
    expect(r.gwpSet).toBe('IPCC AR6');
    expect(r.consolidationShare.toString()).toBe('1');
    expect(r.calcEngineVersion).toBe(CALC_ENGINE_VERSION);
  });

  // ─────────── THE canonical test. SPEC.md §5. ───────────
  it('A SUPERSEDED FACTOR DOES NOT CHANGE A PAST RESULT', () => {
    // Recorded in March 2026 against DEFRA 2026 v1.0 (2.68).
    const asRecorded = calculateEmissions(base())[0];
    expect(asRecorded.emissionsKgCo2e.toString()).toBe('38056');
    expect(asRecorded.factorVersion).toBe('v1.0');

    // The snapshot on the record is what a report reads — the factor row is only a link.
    // Even if v1.0 is deleted outright, these stored values still render the arithmetic.
    const snapshot = { ...asRecorded };
    expect(snapshot.factorValue.toString()).toBe('2.68');
    expect(snapshot.emissionsKgCo2e.toString()).toBe('38056');

    // Later, someone deliberately recalculates against v1.1 (2.71).
    const recalculated = calculateEmissions(base({ candidates: [DEFRA_2026_V1_1] }))[0];
    expect(recalculated.emissionsKgCo2e.toString()).toBe('38482');
    expect(recalculated.factorVersion).toBe('v1.1');

    // The original is untouched — moving to the new factor is a deliberate, logged act.
    expect(asRecorded.emissionsKgCo2e.toString()).toBe('38056');
    expect(asRecorded.factorValue.toString()).toBe('2.68');
  });

  it('converts units before multiplying, and snapshots the conversion factor', () => {
    const [r] = calculateEmissions(base({
      activity: { quantity: '14.2', unit: 'M3', activityStart: d('2026-03-01'), activityEnd: d('2026-03-31') },
    }));
    expect(r.quantityNormalised.toString()).toBe('14200');
    expect(r.unitConversionFactor.toString()).toBe('1000');
    expect(r.emissionsKgCo2e.toString()).toBe('38056');
  });

  it('THROWS on a unit-dimension mismatch rather than producing a wrong number', () => {
    expect(() =>
      calculateEmissions(base({
        activity: { quantity: '100', unit: 'KWH', activityStart: d('2026-03-01'), activityEnd: d('2026-03-31') },
      })),
    ).toThrow(UnitMismatchError);
  });

  it('applies and snapshots the consolidation share', () => {
    const [r] = calculateEmissions(base({ consolidationShare: '0.4' }));
    expect(r.emissionsKgCo2e.toString()).toBe('15222.4');
    expect(r.consolidationShare.toString()).toBe('0.4');
  });

  it('applies the binding multiplier', () => {
    const [r] = calculateEmissions(base({ multiplier: 12 }));
    expect(r.emissionsKgCo2e.toString()).toBe('456672');
  });

  it('applies GWP for a non-CO2 gas', () => {
    const n2o: CandidateFactor = { ...DEFRA_2026_V1_0, id: 'n2o', gas: 'N2O', value: '1', unitDenominator: 'KG' };
    const [r] = calculateEmissions(base({
      candidates: [n2o],
      activity: { quantity: '10', unit: 'KG', activityStart: d('2026-03-01'), activityEnd: d('2026-03-31') },
    }));
    expect(r.gwpValue.toString()).toBe('273');
    expect(r.emissionsKgCo2e.toString()).toBe('2730');
  });

  it('rejects a negative quantity', () => {
    expect(() => calculateEmissions(base({
      activity: { quantity: '-5', unit: 'L', activityStart: d('2026-03-01'), activityEnd: d('2026-03-31') },
    }))).toThrow(/negative/);
  });

  it('splits day-weighted across a mid-year factor change, and the parts sum correctly', () => {
    const v27: CandidateFactor = {
      ...DEFRA_2026_V1_0, id: 'y27', value: '2.71', factorSetVersion: 'v2.0',
      validFrom: d('2027-01-01'), validTo: null,
    };
    const results = calculateEmissions(base({
      candidates: [DEFRA_2026_V1_0, v27],
      // 62 days: 31 in Dec 2026 @2.68, 31 in Jan 2027 @2.71
      activity: { quantity: '6200', unit: 'L', activityStart: d('2026-12-01'), activityEnd: d('2027-01-31') },
    }));

    expect(results).toHaveLength(2);
    expect(results[0].factorValue.toString()).toBe('2.68');
    expect(results[0].daysCovered).toBe(31);
    expect(results[0].daysTotal).toBe(62);
    expect(results[0].quantityNormalised.toString()).toBe('3100');
    expect(results[0].emissionsKgCo2e.toString()).toBe('8308');

    expect(results[1].factorValue.toString()).toBe('2.71');
    expect(results[1].emissionsKgCo2e.toString()).toBe('8401');

    expect(sumKg(results).toString()).toBe('16709');
    // sanity: strictly between using either factor for the whole period
    expect(sumKg(results).lt(new Decimal('6200').mul('2.71'))).toBe(true);
    expect(sumKg(results).gt(new Decimal('6200').mul('2.68'))).toBe(true);
  });

  it('never loses precision to floating point', () => {
    const [r] = calculateEmissions(base({
      activity: { quantity: '0.1', unit: 'L', activityStart: d('2026-03-01'), activityEnd: d('2026-03-01') },
    }));
    expect(r.emissionsKgCo2e.toString()).toBe('0.268'); // 0.1 * 2.68, not 0.268000000000000004
  });
});

describe('Scope 2 dual basis (ESRS E1-6)', () => {
  const LOCATION: CandidateFactor = {
    id: 'grid-loc', scope: 'SCOPE_2', activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA',
    fuelOrMaterialCode: 'grid_electricity', region: 'GB-NAT', gas: 'CO2E_BLENDED', basis: 'LOCATION_BASED',
    value: '0.71', unitNumerator: 'KG_CO2E', unitDenominator: 'KWH',
    validFrom: d('2026-01-01'), validTo: d('2026-12-31'),
    sourceCitation: 'Grid average', factorSetName: 'NG ESO 2026', factorSetVersion: 'v2026.1',
  };
  const MARKET: CandidateFactor = { ...LOCATION, id: 'grid-mkt', basis: 'MARKET_BASED', value: '0.61' };

  const elec = (candidates: CandidateFactor[]): CalcInput => ({
    activity: { quantity: '4802000', unit: 'KWH', activityStart: d('2026-04-01'), activityEnd: d('2026-04-30') },
    candidates,
    query: {
      activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA', fuelOrMaterialCode: 'grid_electricity',
      regionStrategy: 'SITE_GRID_ONLY', siteCountry: 'GB', siteGridRegion: 'GB-NAT',
    },
    gwpValues: { CO2E_BLENDED: 1 }, gwpSetName: 'IPCC AR6', consolidationShare: 1,
  });

  it('produces both bases from one activity', () => {
    const r = calculateDualBasis(elec([LOCATION, MARKET]));
    expect(toTonnes(sumKg(r.locationBased))).toBe('3409.42');
    expect(toTonnes(sumKg(r.marketBased))).toBe('2929.22');
    expect(r.marketFellBackToLocation).toBe(false);
  });

  it('falls back to location-based when nothing contractual exists, and SAYS SO', () => {
    const r = calculateDualBasis(elec([LOCATION]));
    expect(r.marketFellBackToLocation).toBe(true);
    expect(sumKg(r.marketBased).toString()).toBe(sumKg(r.locationBased).toString());
    expect(r.marketBased[0].basis).toBe('MARKET_BASED');
  });
});
