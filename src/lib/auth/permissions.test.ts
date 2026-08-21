import { describe, it, expect } from 'vitest';
import { can } from './permissions';

describe('can', () => {
  it('SUPER_ADMIN can do everything', () => {
    for (const cap of ['manage_org', 'manage_users', 'manage_sites', 'manage_factors', 'manage_questionnaire', 'submit_answers', 'manage_tasks', 'view'] as const) {
      expect(can('SUPER_ADMIN', cap)).toBe(true);
    }
  });

  it('DATA_MANAGER cannot manage org settings or users', () => {
    expect(can('DATA_MANAGER', 'manage_org')).toBe(false);
    expect(can('DATA_MANAGER', 'manage_users')).toBe(false);
    expect(can('DATA_MANAGER', 'manage_factors')).toBe(true);
  });

  it('DATA_INPUTTER can only submit answers and view', () => {
    expect(can('DATA_INPUTTER', 'submit_answers')).toBe(true);
    expect(can('DATA_INPUTTER', 'view')).toBe(true);
    expect(can('DATA_INPUTTER', 'manage_factors')).toBe(false);
    expect(can('DATA_INPUTTER', 'manage_tasks')).toBe(false);
  });

  it('READ_ONLY can view and nothing else', () => {
    expect(can('READ_ONLY', 'view')).toBe(true);
    expect(can('READ_ONLY', 'submit_answers')).toBe(false);
    expect(can('READ_ONLY', 'manage_factors')).toBe(false);
    expect(can('READ_ONLY', 'manage_tasks')).toBe(false);
  });

  it('a missing role can do nothing, not even view', () => {
    expect(can(null, 'view')).toBe(false);
    expect(can(undefined, 'view')).toBe(false);
  });
});
