/**
 * Site hierarchy. GHG_TOOL_ARCHITECTURE.md §5.1/§5.3, BUILD_PLAN Step 2.1.
 *
 * PURE MODULE — no Prisma, no fetch. `path`/`depth` are maintained columns
 * on Site (computed here, written by the caller on create), so a roll-up
 * is `WHERE organization_id = ? AND $1 = ANY(path)` — one indexed query,
 * not a recursive CTE per request. `resolveSites` answers "which sites are
 * actually in scope for this period" from each site's inScopeFrom/To, so
 * an acquisition or divestment mid-period resolves without touching the
 * hierarchy itself.
 */
export const MAX_SITE_DEPTH = 6;

export class SiteDepthExceededError extends Error {
  constructor(readonly depth: number) {
    super(`Site hierarchy depth limit is ${MAX_SITE_DEPTH}; a site at depth ${depth} was rejected.`);
    this.name = "SiteDepthExceededError";
  }
}

export class SiteCycleError extends Error {
  constructor(readonly siteId: string) {
    super(`Site ${siteId} cannot be its own ancestor.`);
    this.name = "SiteCycleError";
  }
}

export interface SiteAncestor {
  id: string;
  path: readonly string[];
}

/**
 * Computes the maintained `path` (root-to-self, inclusive of the new
 * site's own id once it has one — call with the id already known, e.g. a
 * pre-generated uuid) and `depth` for a new/moved site under `parent`.
 * `parent: null` means a root site. Throws SiteDepthExceededError past
 * MAX_SITE_DEPTH and SiteCycleError if `newSiteId` already appears in the
 * parent's own path (which would make the new site its own ancestor).
 */
export function computeSitePath(
  newSiteId: string,
  parent: SiteAncestor | null,
): { path: readonly string[]; depth: number } {
  if (parent && parent.path.includes(newSiteId)) throw new SiteCycleError(newSiteId);
  const path = parent ? [...parent.path, newSiteId] : [newSiteId];
  const depth = path.length - 1;
  if (depth >= MAX_SITE_DEPTH) throw new SiteDepthExceededError(depth);
  return { path, depth };
}

export interface ScopableSite {
  id: string;
  inScopeFrom: Date | null;
  inScopeTo: Date | null;
}

/**
 * Which sites are in scope for a period spanning [periodStart, periodEnd].
 * A site with no inScopeFrom/To is in scope for every period (the common
 * case). A site divested mid-year (inScopeTo inside this period or
 * earlier) still resolves for the period that contains its divestment
 * date and drops out of every period entirely after it.
 */
export function resolveSites<T extends ScopableSite>(sites: readonly T[], periodStart: Date, periodEnd: Date): T[] {
  return sites.filter((s) => {
    const startedInTimeForPeriod = !s.inScopeFrom || s.inScopeFrom <= periodEnd;
    const stillInScopeAtPeriodStart = !s.inScopeTo || s.inScopeTo >= periodStart;
    return startedInTimeForPeriod && stillInScopeAtPeriodStart;
  });
}
