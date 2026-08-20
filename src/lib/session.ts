/**
 * Stand-in for real auth. Stores an org id in a signed-in-spirit cookie —
 * no passwords, no users, just "which org's data am I looking at." Real
 * sign-in (Auth.js, per DEPLOY.md step 3) replaces this; every call site
 * that reads the session goes through here so that swap touches one file.
 */
import { cookies } from "next/headers";

const COOKIE = "gl_org";

export async function getSessionOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setSessionOrgId(orgId: string) {
  const store = await cookies();
  store.set(COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}
