/**
 * GHG_TOOL_ARCHITECTURE.md §23: "a single can(tenant, featureCode) check
 * used by both the API and the UI. Features are codes, not booleans
 * scattered in code." "Soft limits warn, hard limits block, and both are
 * visible to the customer before they hit them."
 *
 * This is groundwork, not a live gate: with one demo org, nothing is
 * actually restricted today. An org with no Entitlement row for a feature
 * is unrestricted by design — restriction is opt-in (create a row), not
 * opt-out (every org starts locked down). This is the seam multi-plan
 * billing hooks into later, without touching call sites again.
 */
import { orgScopedClient } from "@/lib/db/tenant";

/** Feature codes are strings, not scattered booleans — add here as they're needed. */
export const FEATURES = {
  BUILDER: "builder",
  POSITIONS: "positions",
  FACTOR_LAB: "factor_lab",
} as const;

export type FeatureCode = (typeof FEATURES)[keyof typeof FEATURES] | (string & {});

export interface EntitlementCheck {
  allowed: boolean;
  /** Present only when a limit is configured and worth surfacing (e.g. "3 of 5 sites used"). */
  limit?: number | null;
}

/** The one check both API routes/server actions and UI gating should call. */
export async function can(orgId: string, featureCode: FeatureCode): Promise<EntitlementCheck> {
  const db = orgScopedClient(orgId);
  const entitlement = await db.entitlement.findFirst({ where: { featureCode } });
  if (!entitlement) return { allowed: true };
  return { allowed: entitlement.enabled, limit: entitlement.limitValue };
}

/**
 * For a metered limit (e.g. "sites"): is `currentCount` still under the
 * configured limit? No row or no limit set means unlimited.
 */
export async function isUnderLimit(orgId: string, featureCode: FeatureCode, currentCount: number): Promise<boolean> {
  const { allowed, limit } = await can(orgId, featureCode);
  if (!allowed) return false;
  if (limit == null) return true;
  return currentCount < limit;
}
