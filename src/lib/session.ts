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
}
