import { describe, it, expect } from 'vitest';
import { resolveLabel, resolveOptions, isExtensible, type LabelOverride } from './index';
import { SYSTEM_DEFAULTS } from './systemDefaults';

const O = (p: Partial<LabelOverride>): LabelOverride => ({
  entityKind: 'ACTIVITY_TYPE', code: 'STATIONARY_COMBUSTION',
  scopeKey: 'org', label: 'x', locale: '*', ...p,
});

describe('label layer', () => {
  const defaults = SYSTEM_DEFAULTS.ACTIVITY_TYPE;

  it('falls back to the system default with no overrides', () => {
    const r = resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', [], defaults);
    expect(r.label).toBe('Stationary combustion');
    expect(r.source).toBe('system');
  });

  it('the SPEC.md §3.19 worked example: four words, one code', () => {
    const overrides = [
      O({ scopeKey: 'org', label: 'Fixed fuel burning' }),
      O({ scopeKey: 'site_type:OFFICE', label: 'Building heating' }),
      O({ scopeKey: 'binding:b1', label: 'Generator fuel' }),
    ];
    const at = (ctx = {}) => resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, ctx).label;

    expect(at()).toBe('Fixed fuel burning');
    expect(at({ siteType: 'OFFICE' })).toBe('Building heating');
    expect(at({ siteType: 'OFFICE', bindingId: 'b1' })).toBe('Generator fuel');
    expect(at({ siteType: 'MANUFACTURING' })).toBe('Fixed fuel burning');
  });

  it('honours the full precedence ladder, most specific first', () => {
    const overrides = [
      O({ scopeKey: 'org', label: 'org' }),
      O({ scopeKey: 'site_type:OFFICE', label: 'siteType' }),
      O({ scopeKey: 'template:t1', label: 'template' }),
      O({ scopeKey: 'question:q1', label: 'question' }),
      O({ scopeKey: 'binding:b1', label: 'binding' }),
    ];
    const ctx = { bindingId: 'b1', questionId: 'q1', templateId: 't1', siteType: 'OFFICE' };
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, ctx).label).toBe('binding');
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, { ...ctx, bindingId: null }).label).toBe('question');
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, { siteType: 'OFFICE' }).label).toBe('siteType');
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, {}).label).toBe('org');
  });

  it('an exact-locale override beats a wildcard at the same level', () => {
    const overrides = [
      O({ scopeKey: 'org', label: 'Fixed fuel burning', locale: '*' }),
      O({ scopeKey: 'org', label: 'Combustion fixe', locale: 'fr-FR' }),
    ];
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, { locale: 'fr-FR' }).label).toBe('Combustion fixe');
    expect(resolveLabel('ACTIVITY_TYPE', 'STATIONARY_COMBUSTION', overrides, defaults, { locale: 'en-GB' }).label).toBe('Fixed fuel burning');
  });

  it('hides an option without deleting it, and honours custom sort order', () => {
    const overrides: LabelOverride[] = [
      O({ entityKind: 'UNIT', code: 'GAL_UK', label: 'UK gallons', isHidden: true }),
      O({ entityKind: 'UNIT', code: 'M3', label: 'Cubic metres', sortOrder: 0 }),
      O({ entityKind: 'UNIT', code: 'L', label: 'Litres', sortOrder: 1 }),
    ];
    const opts = resolveOptions('UNIT', ['L', 'M3', 'GAL_UK'], overrides, SYSTEM_DEFAULTS.UNIT);
    expect(opts.map((o) => o.code)).toEqual(['M3', 'L']);
  });

  it('closed taxonomies cannot be extended, open ones can', () => {
    expect(isExtensible('SCOPE3_CATEGORY')).toBe(false);
    expect(isExtensible('METHOD')).toBe(false);
    expect(isExtensible('ASSET_TYPE')).toBe(true);
    expect(isExtensible('DENOMINATOR')).toBe(true);
  });
});
