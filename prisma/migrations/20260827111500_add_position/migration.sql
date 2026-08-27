-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('ASSET', 'FLOW', 'INDICATOR', 'OVERVIEW', 'QUESTION', 'TEXT');

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "position_code" TEXT NOT NULL,
    "label_key" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "dimension" "UnitDimension",
    "allowed_units" "UnitCode"[],
    "default_unit" "UnitCode",
    "parent_id" TEXT,
    "owner_id" TEXT,
    "help_text_key" TEXT,
    "visible_if" JSONB,
    "formula_ast" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_values" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "line" INTEGER NOT NULL DEFAULT 1,
    "value_numeric" DECIMAL(20,6),
    "value_text" TEXT,
    "value_json" JSONB,
    "unit" "UnitCode",
    "data_quality" "DataQuality",
    "is_not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "na_reason" TEXT,
    "status" "AnswerStatus" NOT NULL DEFAULT 'UNANSWERED',
    "answered_by_id" TEXT,
    "answered_at" TIMESTAMP(3),
    "document_ids" TEXT[],
    "comment" TEXT,
    "prior_period_value" DECIMAL(20,6),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_asset_values" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "value_numeric" DECIMAL(20,6),
    "value_text" TEXT,
    "value_json" JSONB,
    "unit" "UnitCode",
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_asset_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "positions_organization_id_type_idx" ON "positions"("organization_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "positions_organization_id_position_code_key" ON "positions"("organization_id", "position_code");

-- CreateIndex
CREATE UNIQUE INDEX "position_values_unique_line" ON "position_values"("position_id", "site_id", "reporting_period_id", "line");

-- CreateIndex
CREATE INDEX "position_asset_values_position_id_site_id_valid_from_idx" ON "position_asset_values"("position_id", "site_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "position_asset_values_position_id_site_id_valid_from_key" ON "position_asset_values"("position_id", "site_id", "valid_from");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_values" ADD CONSTRAINT "position_values_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_values" ADD CONSTRAINT "position_values_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_values" ADD CONSTRAINT "position_values_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_asset_values" ADD CONSTRAINT "position_asset_values_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_asset_values" ADD CONSTRAINT "position_asset_values_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Real RLS on positions (has organization_id directly), same pattern as
-- every other strict table. position_values/position_asset_values have no
-- organization_id of their own — scoped transitively through position_id,
-- same convention as factor_assignments/import_rows elsewhere in this
-- schema — so they get no policy of their own.
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "positions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "positions" USING (organization_id = current_setting('app.org_id', true));
