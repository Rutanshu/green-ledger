/**
 * The capability matrix. The Role enum (schema.prisma) is the source of
 * truth for what roles exist; this file is the source of truth for what
 * each one can do. Every write path — server action AND the UI control
 * that triggers it — should check can() rather than re-deriving its own
 * notion of who's allowed to do what.
 *
 * PURE. No Prisma, no fetch — just a lookup table.
 */

export type Role = 'SUPER_ADMIN' | 'DATA_MANAGER' | 'DATA_INPUTTER' | 'READ_ONLY';

export type Capability =
  | 'manage_org' // Organisation settings
  | 'manage_users' // Users & roles
  | 'manage_sites' // Sites & assets
  | 'manage_factors' // Factor Lab: edit factors, retest bindings
  | 'manage_questionnaire' // Builder: author/publish questions
  | 'submit_answers' // Data Collection
  | 'manage_tasks' // mark tasks done/reopen
  | 'view' // read every screen
  | 'manage_platform'; // the Super Admin portal itself — cross-company, not gated per-org

const MATRIX: Record<Role, readonly Capability[]> = {
  SUPER_ADMIN: [
    'manage_org', 'manage_users', 'manage_sites', 'manage_factors',
    'manage_questionnaire', 'submit_answers', 'manage_tasks', 'view', 'manage_platform',
  ],
  DATA_MANAGER: ['manage_sites', 'manage_factors', 'manage_questionnaire', 'submit_answers', 'manage_tasks', 'view'],
  DATA_INPUTTER: ['submit_answers', 'view'],
  READ_ONLY: ['view'],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(capability) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  DATA_MANAGER: 'Data Manager',
  DATA_INPUTTER: 'Data Inputter',
  READ_ONLY: 'Read Only',
};
