/**
 * Optimistic concurrency. GHG_TOOL_ARCHITECTURE.md §8.3/§14, BUILD_PLAN
 * Step 3.2: "a write carrying a stale updated_at is rejected with a typed
 * conflict error." Two people editing the same answer shouldn't silently
 * let the second save clobber the first — this is the check that catches
 * it, not a lock, just a compare-then-write guard the caller must run
 * against the row it's about to overwrite.
 *
 * PURE MODULE — no Prisma, no fetch, no Date.now(). The caller supplies
 * both timestamps (what the form was loaded with, what's in the database
 * right now); this module only compares them.
 */
export class StaleWriteError extends Error {
  constructor(readonly expected: string, readonly actual: string) {
    super(`This was changed by someone else since you loaded it (expected updated_at ${expected}, found ${actual}). Reload and try again.`);
    this.name = "StaleWriteError";
  }
}

/**
 * Throws StaleWriteError if `actualUpdatedAt` (the row's current
 * updated_at, read inside the write transaction) doesn't match
 * `expectedUpdatedAt` (what the client had when it submitted the form).
 * `expectedUpdatedAt: null` means the client believes there's no existing
 * row yet — skip the check only when `actualUpdatedAt` agrees there isn't one.
 */
export function assertFreshWrite(expectedUpdatedAt: string | null, actualUpdatedAt: string | null): void {
  if (expectedUpdatedAt === null && actualUpdatedAt === null) return;
  if (expectedUpdatedAt !== actualUpdatedAt) {
    throw new StaleWriteError(expectedUpdatedAt ?? "(none)", actualUpdatedAt ?? "(none)");
  }
}
