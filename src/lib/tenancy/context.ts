/**
 * Request-scoped tenant context (GHG_TOOL_ARCHITECTURE.md §19.2, requirement
 * 2 — "an ORM layer... sourced from request context (AsyncLocalStorage), and
 * throws if the context is missing").
 *
 * This app's tenant concept is the existing `Organization` model — it is
 * already exactly the shape §8.1 asks of Tenant (a `User` global and unique
 * by email, a `Membership` linking it to any number of orgs — that's
 * PlatformUser/Membership already, not something to rebuild under a new
 * name). This module adds the piece that was genuinely missing: a context
 * any nested code can read WITHOUT the org id being threaded through every
 * function signature, with no silent default if it's unset.
 *
 * This does not replace orgScopedClient(orgId)'s explicit-parameter API —
 * every existing call site keeps working unchanged. orgScopedClient and
 * withOrgTransaction now also populate this context for the duration of
 * their operation, so code running underneath them (recordAudit, anything
 * added later) can call getCurrentOrgId() as a second, independent check
 * instead of trusting a parameter that could have been passed wrong.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<string>();

export class TenantContextError extends Error {
  constructor(message = "No tenant context is set — this code is running outside runWithOrg(). Reading the current org must never silently default.") {
    super(message);
    this.name = "TenantContextError";
  }
}

/** Runs `fn` with `orgId` set as the current tenant context for its whole (possibly async) call tree. */
export function runWithOrg<T>(orgId: string, fn: () => T): T {
  if (!orgId) throw new TenantContextError("runWithOrg() requires a non-empty organisation id.");
  return storage.run(orgId, fn);
}

/** Throws TenantContextError if called outside runWithOrg() — never returns a default. */
export function getCurrentOrgId(): string {
  const orgId = storage.getStore();
  if (!orgId) throw new TenantContextError();
  return orgId;
}

/** Non-throwing read, for code that has a legitimate reason to behave differently with no context (e.g. admin scripts). */
export function tryGetCurrentOrgId(): string | undefined {
  return storage.getStore();
}
