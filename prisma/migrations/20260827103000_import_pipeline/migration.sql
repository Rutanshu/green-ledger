-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "reporting_period_id" TEXT;

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "site_code" TEXT,
    "question_code" TEXT,
    "value" TEXT,
    "unit" TEXT,
    "data_quality" TEXT,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "before_value" DECIMAL(20,6),
    "before_unit" "UnitCode",
    "before_data_quality" "DataQuality",
    "answer_id" TEXT,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_rows_import_batch_id_status_idx" ON "import_rows"("import_batch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_profiles_organization_id_name_key" ON "mapping_profiles"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_profiles" ADD CONSTRAINT "mapping_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Real RLS on mapping_profiles, same pattern as every other strict table.
-- import_rows has no organization_id of its own — scoped transitively
-- through import_batch_id, same pattern as factor_assignments through
-- impact_profile_id — so it gets no policy of its own and must only ever
-- be queried through its parent ImportBatch relation.
ALTER TABLE "mapping_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mapping_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mapping_profiles" USING (organization_id = current_setting('app.org_id', true));
