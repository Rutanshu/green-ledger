import { rawPrisma } from "@/lib/db/client";
import { getSessionOrgId, getSessionUserId } from "@/lib/session";
import type { Role } from "@/lib/auth/permissions";

/** Looked up by name — used only by the legacy "Try the demo" fallback. */
export function findDemoOrg() {
  return rawPrisma.organization.findFirst({
    where: { legalName: "Meridian Industries (Demo)" },
  });
}

/** The org for the current session, or null if not signed in. */
export async function getCurrentOrg() {
  const orgId = await getSessionOrgId();
  if (!orgId) return null;
  return rawPrisma.organization.findUnique({ where: { id: orgId } });
}

export interface CurrentMembership {
  org: NonNullable<Awaited<ReturnType<typeof getCurrentOrg>>>;
  user: { id: string; name: string | null; email: string };
  role: Role;
}

/**
 * Org + user + role for the current session in one call — what every page
 * that needs to gate a control on `can(role, ...)` should use instead of
 * getCurrentOrg() alone. Returns null if there's no session, no matching
 * Membership (shouldn't happen for a real login, but a stale/foreign
 * session cookie shouldn't silently grant access), or the org is missing.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const [orgId, userId] = await Promise.all([getSessionOrgId(), getSessionUserId()]);
  if (!orgId || !userId) return null;

  const membership = await rawPrisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    include: { user: true, organization: true },
  });
  if (!membership) return null;

  return {
    org: membership.organization,
    user: { id: membership.user.id, name: membership.user.name, email: membership.user.email },
    role: membership.role,
  };
}
