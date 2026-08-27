-- CreateEnum
CREATE TYPE "ImpactProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "impact_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ImpactProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "impact_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_assignments" (
    "id" TEXT NOT NULL,
    "impact_profile_id" TEXT NOT NULL,
    "question_code" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "scope3_category" INTEGER,
    "activity_type" "ActivityType" NOT NULL,
    "method" "CalcMethod" NOT NULL,
    "fuel_or_material_code" TEXT NOT NULL,
    "region_strategy" "RegionStrategy" NOT NULL DEFAULT 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL',
    "output_basis" "OutputBasis" NOT NULL DEFAULT 'SINGLE',

    CONSTRAINT "factor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impact_profiles_organization_id_status_idx" ON "impact_profiles"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "impact_profiles_organization_id_name_version_key" ON "impact_profiles"("organization_id", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "factor_assignments_impact_profile_id_question_code_key" ON "factor_assignments"("impact_profile_id", "question_code");

-- AddForeignKey
ALTER TABLE "impact_profiles" ADD CONSTRAINT "impact_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_assignments" ADD CONSTRAINT "factor_assignments_impact_profile_id_fkey" FOREIGN KEY ("impact_profile_id") REFERENCES "impact_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Real RLS on impact_profiles, same as every other strict table (see
-- _org_scoping_rls). factor_assignments has no organization_id of its own —
-- it's scoped transitively through impact_profile_id, exactly like
-- factor_bindings is scoped through question_id — so it gets no RLS policy
-- of its own and must only ever be queried through its parent relation.
ALTER TABLE "impact_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "impact_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "impact_profiles" USING (organization_id = current_setting('app.org_id', true));
