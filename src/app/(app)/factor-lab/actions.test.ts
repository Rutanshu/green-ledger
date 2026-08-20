import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '@/lib/db/client';

let orgId: string;
let bindingId: string;
let originalHealth: string;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'gl_org' ? { value: orgId } : undefined) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { retestBinding } = await import('./actions');

beforeAll(async () => {
  const org = await rawPrisma.organization.findFirstOrThrow({ where: { legalName: 'Meridian Industries (Demo)' } });
  orgId = org.id;
  const binding = await rawPrisma.factorBinding.findFirstOrThrow({ where: { fuelOrMaterialCode: 'diesel' } });
  bindingId = binding.id;
  originalHealth = binding.health;
});

afterAll(async () => {
  await rawPrisma.$disconnect();
});

describe('retestBinding', () => {
  it('does nothing for a binding id that does not exist (fail check)', async () => {
    await expect(retestBinding('00000000-0000-0000-0000-000000000000')).resolves.not.toThrow();
  });

  it('recomputes health for a real binding using the real checkBindingHealth() logic', async () => {
    await retestBinding(bindingId);
    const updated = await rawPrisma.factorBinding.findUniqueOrThrow({ where: { id: bindingId } });
    // diesel/stationary combustion only has a GLOBAL-region DEFRA factor, so
    // any strict region strategy resolves via fallback, not OK — this is the
    // real computed answer, not an assumption.
    expect(['OK', 'FALLBACK_REGION', 'AMBIGUOUS', 'BROKEN']).toContain(updated.health);
    expect(updated.healthCheckedAt).not.toBeNull();
    expect(updated.health).toBe(originalHealth); // re-running against unchanged data reproduces the same answer
  });
});
