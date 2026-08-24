-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('DATA_OWNER', 'REVIEWER', 'APPROVER', 'SITE_MANAGER', 'CATEGORY_OWNER', 'OTHER');

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "site_id" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_assignments" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_backup" BOOLEAN NOT NULL DEFAULT false,
    "started_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_on" TIMESTAMP(3),
    "reason" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "positions_organization_id_site_id_idx" ON "positions"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "position_assignments_position_id_ended_on_idx" ON "position_assignments"("position_id", "ended_on");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Layer 2 (see the _org_scoping_rls migration): positions has a direct
-- organization_id, so it gets real RLS like the other 15 strict tables.
-- position_assignments does NOT — it has no direct organization_id (only
-- position_id), same situation as FactorBinding's relation to Question.
-- It stays protected by layer 1 (explicit org-ownership joins in every
-- query, same pattern factor-lab/actions.ts already uses for FactorBinding)
-- rather than a naive equality policy that has no column to check.
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "positions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "positions" USING (organization_id = current_setting('app.org_id', true));
