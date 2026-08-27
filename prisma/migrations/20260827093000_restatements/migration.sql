-- CreateEnum
CREATE TYPE "RestatementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "restatements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "status" "RestatementStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "restatements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restatements_organization_id_status_idx" ON "restatements"("organization_id", "status");

-- CreateIndex
CREATE INDEX "restatements_reporting_period_id_idx" ON "restatements"("reporting_period_id");

-- AddForeignKey
ALTER TABLE "restatements" ADD CONSTRAINT "restatements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restatements" ADD CONSTRAINT "restatements_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Real RLS, same pattern as every other strict table.
ALTER TABLE "restatements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restatements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "restatements" USING (organization_id = current_setting('app.org_id', true));
