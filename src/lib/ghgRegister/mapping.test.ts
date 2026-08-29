import { describe, expect, it } from 'vitest';
import {
  mapUnit, inferActivityType, inferCalcMethod, parseScope3Category, inferBasis, buildSourceCitation,
  UNIT_MAP, SKIPPED_UNIT_PAIRS, type RegisterRecord,
} from './mapping';

describe('mapUnit', () => {
  it('converts gCO2e/EUR to KG_CO2E/EUR with a /1000 multiplier', () => {
    const m = mapUnit('gCO2e', 'EUR');
    expect(m).not.toBeNull();
    expect(m!.numerator).toBe('KG_CO2E');
    expect(m!.denominator).toBe('EUR');
    expect(m!.rawValue(1000)).toBeCloseTo(1, 10);
  });

  it('converts lbCO2e/MWh to KG_CO2E/MWH via the real lb->kg factor', () => {
    const m = mapUnit('lbCO2e', 'MWh');
    expect(m!.rawValue(1)).toBeCloseTo(0.45359237, 8);
  });

  it('passes kgCO2e/km through unchanged', () => {
    const m = mapUnit('kgCO2e', 'km');
    expect(m!.numerator).toBe('KG_CO2E');
    expect(m!.denominator).toBe('KM');
    expect(m!.rawValue(2.68)).toBe(2.68);
  });

  it('returns null for an unmapped pair rather than guessing', () => {
    expect(mapUnit('kgCO2e', 'ha')).toBeNull();
    expect(SKIPPED_UNIT_PAIRS.has('kgCO2e|ha')).toBe(true);
  });

  it('every UNIT_MAP entry has a positive multiplier', () => {
    for (const [key, m] of Object.entries(UNIT_MAP)) {
      expect(m.multiplier, key).toBeGreaterThan(0);
    }
  });
});

const base: RegisterRecord = {
  id: 'test-1', activity: '', scope: 1, category: '1', category_name: 'Scope 1 direct',
  method: 'activity-based', value: 1, unit_numerator: 'kgCO2e', unit_denominator: 'kg',
  gwp_basis: 'AR5', country: 'GB', region: null, year: 2025, publication_year: 2025,
  organization: 'Defra', dataset: 'GHG Conversion Factors', source_url: 'https://example.com',
  source_page_or_table: 'Table 1', licence: 'OGL v3.0', price_year: null, boundary: 'combustion',
  value_status: 'verified', notes: null,
};

describe('inferActivityType', () => {
  it('classifies refrigerant text as FUGITIVE', () => {
    expect(inferActivityType({ ...base, activity: 'Refrigerant & other — R410A' })).toBe('FUGITIVE');
  });
  it('classifies vehicle/HGV text as MOBILE_COMBUSTION', () => {
    expect(inferActivityType({ ...base, activity: 'Delivery vehicles — HGV (all diesel)' })).toBe('MOBILE_COMBUSTION');
  });
  it('defaults scope 1 to STATIONARY_COMBUSTION', () => {
    expect(inferActivityType({ ...base, activity: 'Fuels — Liquid fuels — Naphtha' })).toBe('STATIONARY_COMBUSTION');
  });
  it('defaults scope 2 to PURCHASED_ELECTRICITY, detects steam/heat/cooling', () => {
    expect(inferActivityType({ ...base, scope: 2, category: '2', activity: 'Purchased electricity — UK grid' })).toBe('PURCHASED_ELECTRICITY');
    expect(inferActivityType({ ...base, scope: 2, category: '2', activity: 'Purchased steam' })).toBe('PURCHASED_STEAM');
    expect(inferActivityType({ ...base, scope: 2, category: '2', activity: 'Purchased heat' })).toBe('PURCHASED_HEAT');
  });
  it('scope 3 spend-based always maps to SPEND regardless of text', () => {
    expect(inferActivityType({ ...base, scope: 3, category: '3.1', method: 'spend-based', activity: 'Purchased goods' })).toBe('SPEND');
  });
  it('scope 3 category 3.5 maps to WASTE', () => {
    expect(inferActivityType({ ...base, scope: 3, category: '3.5', activity: 'Waste to landfill' })).toBe('WASTE');
  });
  it('scope 3 category 3.6/3.7 map to DISTANCE', () => {
    expect(inferActivityType({ ...base, scope: 3, category: '3.6', activity: 'Business travel — air' })).toBe('DISTANCE');
    expect(inferActivityType({ ...base, scope: 3, category: '3.7', activity: 'Employee commuting' })).toBe('DISTANCE');
  });
});

describe('inferCalcMethod', () => {
  it('spend-based register method always maps to SPEND_BASED', () => {
    expect(inferCalcMethod('spend-based', 'SPEND')).toBe('SPEND_BASED');
  });
  it('MASS activity type maps to DISTANCE_BASED, matching the existing hgv_average convention', () => {
    expect(inferCalcMethod('activity-based', 'MASS')).toBe('DISTANCE_BASED');
  });
  it('WASTE activity type maps to WASTE_TYPE_SPECIFIC', () => {
    expect(inferCalcMethod('activity-based', 'WASTE')).toBe('WASTE_TYPE_SPECIFIC');
  });
});

describe('parseScope3Category', () => {
  it('parses "3.1" -> 1 and "3.15" -> 15', () => {
    expect(parseScope3Category('3.1')).toBe(1);
    expect(parseScope3Category('3.15')).toBe(15);
  });
  it('returns null for unclassified "3", and for scope 1/2 category strings', () => {
    expect(parseScope3Category('3')).toBeNull();
    expect(parseScope3Category('1')).toBeNull();
    expect(parseScope3Category('2')).toBeNull();
  });
});

describe('inferBasis', () => {
  it('is SINGLE for anything that is not purchased electricity', () => {
    expect(inferBasis('STATIONARY_COMBUSTION', 'combustion')).toBe('SINGLE');
  });
  it('detects market-based from the boundary text', () => {
    expect(inferBasis('PURCHASED_ELECTRICITY', 'market-based residual mix')).toBe('MARKET_BASED');
  });
  it('defaults purchased electricity to LOCATION_BASED', () => {
    expect(inferBasis('PURCHASED_ELECTRICITY', 'generation (location-based national grid average)')).toBe('LOCATION_BASED');
  });
});

describe('buildSourceCitation', () => {
  it('joins organization, dataset, table, and licence', () => {
    expect(buildSourceCitation(base)).toBe('Defra — GHG Conversion Factors — Table 1 — OGL v3.0');
  });
  it('omits a missing source_page_or_table cleanly', () => {
    expect(buildSourceCitation({ ...base, source_page_or_table: null })).toBe('Defra — GHG Conversion Factors — OGL v3.0');
  });
});
