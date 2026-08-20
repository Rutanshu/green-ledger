import { describe, it, expect } from 'vitest';
import {
  resolveFactor, checkBindingHealth, isPublishable, sliceByFactorValidity,
  NoFactorError, AmbiguousFactorError, regionPreference,
  type CandidateFactor, type ResolveQuery,
} from './index';

const d = (s: string) => new Date(s + 'T00:00:00Z');

const F = (p: Partial<CandidateFactor> & { id: string }): CandidateFactor => ({
  scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED',
  fuelOrMaterialCode: 'diesel', region: 'GLOBAL', gas: 'CO2E_BLENDED', basis: 'SINGLE',
  value: '2.68', unitNumerator: 'KG_CO2E', unitDenominator: 'L',
  validFrom: d('2026-01-01'), validTo: d('2026-12-31'),
  sourceCitation: 'Table 5', factorSetName: 'DEFRA 2026', factorSetVersion: 'v1.0',
  ...p,
});

const Q = (p: Partial<ResolveQuery> = {}): ResolveQuery => ({
  activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuelOrMaterialCode: 'diesel',
  regionStrategy: 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL', siteCountry: 'GB', siteGridRegion: 'GB-NAT',
  on: d('2026-03-01'), ...p,
});

describe('factor resolution', () => {
  it('finds the factor valid on the activity date', () => {
    const c = [F({ id: 'a' })];
    expect(resolveFactor(c, Q()).factor.id).toBe('a');
  });

  it('prefers the most specific region, and flags a fallback', () => {
    const c = [F({ id: 'global', region: 'GLOBAL' }), F({ id: 'gb', region: 'GB' })];
    const r = resolveFactor(c, Q());
    expect(r.factor.id).toBe('gb');
    expect(r.usedFallbackRegion).toBe(true); // grid region was preferred and missing

    const withGrid = [...c, F({ id: 'grid', region: 'GB-NAT' })];
    const r2 = resolveFactor(withGrid, Q());
    expect(r2.factor.id).toBe('grid');
    expect(r2.usedFallbackRegion).toBe(false);
  });

  it('region preference order is grid, then country, then global', () => {
    expect(regionPreference(Q())).toEqual(['GB-NAT', 'GB', 'GLOBAL']);
    expect(regionPreference(Q({ regionStrategy: 'GLOBAL_ONLY' }))).toEqual(['GLOBAL']);
    expect(regionPreference(Q({ regionStrategy: 'FIXED_REGION', fixedRegion: 'FR' }))).toEqual(['FR']);
  });

  it('a tie is an ERROR, never a silent pick', () => {
    const c = [F({ id: 'a' }), F({ id: 'b' })];
    expect(() => resolveFactor(c, Q())).toThrow(AmbiguousFactorError);
  });

  it('no match throws with an actionable message', () => {
    expect(() => resolveFactor([], Q())).toThrow(NoFactorError);
    try { resolveFactor([], Q()); } catch (e) {
      expect((e as Error).message).toContain('Add one in the Factor Lab');
    }
  });

  it('ignores factors that expired before the activity date', () => {
    const old = F({ id: 'old', validFrom: d('2025-01-01'), validTo: d('2025-12-31') });
    expect(() => resolveFactor([old], Q())).toThrow(NoFactorError);
  });

  describe('binding health — the publish gate', () => {
    it('OK resolves cleanly', () => {
      const h = checkBindingHealth([F({ id: 'grid', region: 'GB-NAT' })], Q());
      expect(h.health).toBe('OK');
      expect(isPublishable(h.health)).toBe(true);
    });
    it('FALLBACK_REGION is publishable but warned', () => {
      const h = checkBindingHealth([F({ id: 'g', region: 'GLOBAL' })], Q());
      expect(h.health).toBe('FALLBACK_REGION');
      expect(isPublishable(h.health)).toBe(true);
      expect(h.message).toContain('GB');
    });
    it('BROKEN blocks publishing', () => {
      const h = checkBindingHealth([], Q());
      expect(h.health).toBe('BROKEN');
      expect(isPublishable(h.health)).toBe(false);
    });
    it('AMBIGUOUS blocks publishing', () => {
      const h = checkBindingHealth([F({ id: 'a' }), F({ id: 'b' })], Q());
      expect(h.health).toBe('AMBIGUOUS');
      expect(isPublishable(h.health)).toBe(false);
    });
  });

  describe('mid-year factor changes', () => {
    it('splits an activity across a factor change, day-weighted', () => {
      const c = [
        F({ id: 'y26', value: '2.68', validFrom: d('2026-01-01'), validTo: d('2026-12-31') }),
        F({ id: 'y27', value: '2.71', validFrom: d('2027-01-01'), validTo: null, factorSetVersion: 'v2.0' }),
      ];
      const slices = sliceByFactorValidity(c, Q(), d('2026-12-01'), d('2027-01-31'));
      expect(slices).toHaveLength(2);
      expect(slices[0].factor.id).toBe('y26');
      expect(slices[0].days).toBe(31); // December
      expect(slices[1].factor.id).toBe('y27');
      expect(slices[1].days).toBe(31); // January
      expect(slices[0].days + slices[1].days).toBe(62);
    });

    it('a single-factor activity is one slice covering every day', () => {
      const slices = sliceByFactorValidity([F({ id: 'a' })], Q(), d('2026-03-01'), d('2026-03-31'));
      expect(slices).toHaveLength(1);
      expect(slices[0].days).toBe(31);
    });
  });
});
