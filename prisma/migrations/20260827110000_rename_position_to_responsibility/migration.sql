-- Hand-written RENAME, not the DROP+CREATE `prisma migrate diff` produces
-- (it can't detect renames) — this preserves every existing row. "Position"
-- now belongs to GHG_TOOL_ARCHITECTURE.md's atomic data field; this P53
-- "stable responsibility" concept needed a different name, not to be
-- rebuilt from scratch.

ALTER TYPE "PositionType" RENAME TO "ResponsibilityType";

ALTER TABLE "positions" RENAME TO "responsibilities";
ALTER TABLE "position_assignments" RENAME TO "responsibility_assignments";
ALTER TABLE "responsibility_assignments" RENAME COLUMN "position_id" TO "responsibility_id";

-- Constraints and indexes: Postgres does not rename these automatically
-- with the table, so each one is renamed explicitly to match what
-- `prisma migrate diff` would generate for a table created fresh under
-- the new name — keeps future `prisma migrate diff` runs clean (no phantom
-- diff from a stale constraint name).
ALTER TABLE "responsibilities" RENAME CONSTRAINT "positions_pkey" TO "responsibilities_pkey";
ALTER TABLE "responsibility_assignments" RENAME CONSTRAINT "position_assignments_pkey" TO "responsibility_assignments_pkey";

ALTER TABLE "responsibilities" RENAME CONSTRAINT "positions_organization_id_fkey" TO "responsibilities_organization_id_fkey";
ALTER TABLE "responsibilities" RENAME CONSTRAINT "positions_site_id_fkey" TO "responsibilities_site_id_fkey";
ALTER TABLE "responsibility_assignments" RENAME CONSTRAINT "position_assignments_position_id_fkey" TO "responsibility_assignments_responsibility_id_fkey";
ALTER TABLE "responsibility_assignments" RENAME CONSTRAINT "position_assignments_user_id_fkey" TO "responsibility_assignments_user_id_fkey";

ALTER INDEX "positions_organization_id_site_id_idx" RENAME TO "responsibilities_organization_id_site_id_idx";
ALTER INDEX "position_assignments_position_id_ended_on_idx" RENAME TO "responsibility_assignments_responsibility_id_ended_on_idx";

-- RLS policies are attached to the table by OID, not name, so the existing
-- `tenant_isolation` policy on the renamed table keeps working unchanged —
-- nothing to do here. Confirmed via \d+ responsibilities after this runs.
