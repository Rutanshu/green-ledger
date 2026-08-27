import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminPrisma } from '@/lib/db/admin-client';
import { can, isUnderLimit } from './index';

let orgId: string;

beforeAll(async () => {
  const org = await adminPrisma.organization.create({ data: { legalName: 'Entitlements Test Org (delete me)' } });
  orgId = org.id;
}, 30000);

afterAll(async () => {
  await adminPrisma.organization.delete({ where: { id: orgId } });
}, 30000);

describe('can()', () => {
  it('allows a feature with no entitlement row — restriction is opt-in, not opt-out', async () => {
    const result = await can(orgId, 'never_configured_feature');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeUndefined();
  });

  it('respects an explicit disabled row', async () => {
    await adminPrisma.entitlement.create({ data: { organizationId: orgId, featureCode: 'disabled_feature', enabled: false } });
    const result = await can(orgId, 'disabled_feature');
    expect(result.allowed).toBe(false);
  });

  it('surfaces a configured limit', async () => {
    await adminPrisma.entitlement.create({ data: { organizationId: orgId, featureCode: 'limited_feature', limitValue: 5 } });
    const result = await can(orgId, 'limited_feature');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
  });
});

describe('isUnderLimit()', () => {
  it('is unlimited with no entitlement row', async () => {
    expect(await isUnderLimit(orgId, 'never_configured_feature', 1_000_000)).toBe(true);
  });

  it('is false once the count reaches the limit', async () => {
    expect(await isUnderLimit(orgId, 'limited_feature', 4)).toBe(true);
    expect(await isUnderLimit(orgId, 'limited_feature', 5)).toBe(false);
  });

  it('is false for a disabled feature regardless of count', async () => {
    expect(await isUnderLimit(orgId, 'disabled_feature', 0)).toBe(false);
  });
});
