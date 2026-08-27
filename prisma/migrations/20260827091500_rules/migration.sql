-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('HARD_LIMIT', 'PLAUSIBILITY_BAND', 'MANDATORY_COMMENT', 'MANDATORY_ATTACHMENT', 'MIN_DATA_QUALITY', 'CROSS_POSITION_CONSISTENCY', 'COMPLETENESS');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('BLOCK', 'WARN');

-- CreateEnum
CREATE TYPE "RuleViolationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_violations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "assignment_id" TEXT,
    "question_code" TEXT,
    "message" TEXT NOT NULL,
    "status" "RuleViolationStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledged_by_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgement_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rules_organization_id_is_active_idx" ON "rules"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "rule_violations_organization_id_status_idx" ON "rule_violations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "rule_violations_rule_id_idx" ON "rule_violations"("rule_id");

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_violations" ADD CONSTRAINT "rule_violations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_violations" ADD CONSTRAINT "rule_violations_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Real RLS on both, same pattern as every other strict table.
ALTER TABLE "rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rules" USING (organization_id = current_setting('app.org_id', true));

ALTER TABLE "rule_violations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_violations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rule_violations" USING (organization_id = current_setting('app.org_id', true));
