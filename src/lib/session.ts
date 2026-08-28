/**
 * Stand-in for real auth (Auth.js is the eventual replacement — DEPLOY.md
 * step 3). Every call site that reads the session goes through here so
 * that swap touches one file, not every page.
 *
 * Two cookies: which org, and which real user within it (so Membership.role
 * can actually be looked up — plain org-only sessions had no identity to
 * attach a role to).
 */
import { cookies } from "next/headers";

const ORG_COOKIE = "gl_org";
const USER_COOKIE = "gl_user";
/** Set only while a Super Admin is impersonating — the identity to return to. */
const IMPERSONATOR_COOKIE = "gl_impersonator";
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 7 };

export async function getSessionOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ORG_COOKIE)?.value ?? null;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(USER_COOKIE)?.value ?? null;
}

export async function setSession(params: { orgId: string; userId: string }) {
  const store = await cookies();
  store.set(ORG_COOKIE, params.orgId, COOKIE_OPTS);
  store.set(USER_COOKIE, params.userId, COOKIE_OPTS);
}

/** @deprecated kept for the demo-only flow that has no real user yet — prefer setSession() */
export async function setSessionOrgId(orgId: string) {
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, COOKIE_OPTS);
}

export async function clearSession() {
  const store = await cookies();
  store.delete(ORG_COOKIE);
  store.delete(USER_COOKIE);
  store.delete(IMPERSONATOR_COOKIE);
}

export interface Impersonator {
  orgId: string;
  userId: string;
}

/** Swaps the active session to the target org/user, remembering who to return to. Refuses to nest. */
export async function startImpersonation(target: { orgId: string; userId: string }) {
  const store = await cookies();
  if (store.get(IMPERSONATOR_COOKIE)?.value) {
    throw new Error("Already impersonating — stop first before starting another.");
  }
  const currentOrgId = store.get(ORG_COOKIE)?.value;
  const currentUserId = store.get(USER_COOKIE)?.value;
  if (!currentOrgId || !currentUserId) throw new Error("Not signed in.");
  store.set(IMPERSONATOR_COOKIE, JSON.stringify({ orgId: currentOrgId, userId: currentUserId }), COOKIE_OPTS);
  store.set(ORG_COOKIE, target.orgId, COOKIE_OPTS);
  store.set(USER_COOKIE, target.userId, COOKIE_OPTS);
}

/** Restores the pre-impersonation session. No-op if not impersonating. */
export async function stopImpersonation() {
  const store = await cookies();
  const raw = store.get(IMPERSONATOR_COOKIE)?.value;
  if (!raw) return;
  const { orgId, userId } = JSON.parse(raw) as Impersonator;
  store.set(ORG_COOKIE, orgId, COOKIE_OPTS);
  store.set(USER_COOKIE, userId, COOKIE_OPTS);
  store.delete(IMPERSONATOR_COOKIE);
}

export async function getImpersonator(): Promise<Impersonator | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATOR_COOKIE)?.value;
  return raw ? (JSON.parse(raw) as Impersonator) : null;
}
