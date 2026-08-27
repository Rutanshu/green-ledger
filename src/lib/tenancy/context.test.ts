import { describe, it, expect } from 'vitest';
import { runWithOrg, getCurrentOrgId, tryGetCurrentOrgId, TenantContextError } from './context';

describe('tenant context', () => {
  it('throws when read outside runWithOrg()', () => {
    expect(() => getCurrentOrgId()).toThrow(TenantContextError);
  });

  it('returns undefined (not a throw) from the non-throwing read outside context', () => {
    expect(tryGetCurrentOrgId()).toBeUndefined();
  });

  it('returns the org id set by runWithOrg()', () => {
    const result = runWithOrg('org-123', () => getCurrentOrgId());
    expect(result).toBe('org-123');
  });

  it('propagates through async work inside the same call tree', async () => {
    const result = await runWithOrg('org-456', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getCurrentOrgId();
    });
    expect(result).toBe('org-456');
  });

  it('does not leak context to code outside the run() call', () => {
    runWithOrg('org-789', () => {});
    expect(tryGetCurrentOrgId()).toBeUndefined();
  });

  it('rejects an empty org id', () => {
    expect(() => runWithOrg('', () => 'unreachable')).toThrow('non-empty');
  });

  it('nested runWithOrg() shadows the outer context only within its own scope', () => {
    runWithOrg('outer', () => {
      expect(getCurrentOrgId()).toBe('outer');
      runWithOrg('inner', () => {
        expect(getCurrentOrgId()).toBe('inner');
      });
      expect(getCurrentOrgId()).toBe('outer');
    });
  });
});
