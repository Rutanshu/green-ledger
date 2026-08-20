-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('SCOPE_1', 'SCOPE_2', 'SCOPE_3');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('STATIONARY_COMBUSTION', 'MOBILE_COMBUSTION', 'FUGITIVE', 'PROCESS', 'PURCHASED_ELECTRICITY', 'PURCHASED_HEAT', 'PURCHASED_STEAM', 'PURCHASED_COOLING', 'SPEND', 'DISTANCE', 'MASS', 'WASTE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalcMethod" AS ENUM ('FUEL_BASED', 'DISTANCE_BASED', 'SPEND_BASED', 'AVERAGE_DATA', 'SUPPLIER_SPECIFIC', 'WASTE_TYPE_SPECIFIC', 'MATERIAL_BASED', 'HYBRID');

-- CreateEnum
CREATE TYPE "Gas" AS ENUM ('CO2', 'CH4', 'N2O', 'HFC', 'PFC', 'SF6', 'NF3', 'CO2E_BLENDED');

-- CreateEnum
CREATE TYPE "EmissionBasis" AS ENUM ('LOCATION_BASED', 'MARKET_BASED', 'SINGLE');

-- CreateEnum
CREATE TYPE "DataQuality" AS ENUM ('MEASURED', 'CALCULATED', 'ESTIMATED', 'PROXY');

-- CreateEnum
CREATE TYPE "ConsolidationApproach" AS ENUM ('OPERATIONAL_CONTROL', 'FINANCIAL_CONTROL', 'EQUITY_SHARE');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'LOCKED', 'ASSURED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('UNANSWERED', 'DRAFT', 'ANSWERED', 'FLAGGED', 'APPROVED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BindingHealth" AS ENUM ('OK', 'FALLBACK_REGION', 'AMBIGUOUS', 'BROKEN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'CONTRIBUTOR', 'APPROVER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('STATIONARY_COMBUSTION', 'MOBILE_COMBUSTION', 'REFRIGERATION', 'PROCESS', 'ON_SITE_GENERATION', 'ELECTRICAL', 'WASTE_HANDLING', 'IT_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'STANDBY', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('NUMBER_WITH_UNIT', 'NUMBER', 'TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'DATE', 'DATE_RANGE', 'BOOLEAN', 'FILE', 'REPEATING_TABLE');

-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('VOLUME', 'MASS', 'ENERGY', 'DISTANCE', 'MASS_DISTANCE', 'PASSENGER_DISTANCE', 'CURRENCY', 'EMISSIONS', 'COUNT');

-- CreateEnum
CREATE TYPE "UnitCode" AS ENUM ('L', 'M3', 'GAL_US', 'GAL_UK', 'G', 'KG', 'TONNE', 'LB', 'KWH', 'MWH', 'GJ', 'MJ', 'THERM', 'MMBTU', 'KM', 'MI', 'NM', 'TONNE_KM', 'KG_KM', 'PASSENGER_KM', 'GBP', 'EUR', 'USD', 'INR', 'CAD', 'KG_CO2E', 'T_CO2E', 'KG_CO2', 'KG_CH4', 'KG_N2O', 'UNIT');

-- CreateEnum
CREATE TYPE "RegionStrategy" AS ENUM ('SITE_COUNTRY_THEN_GRID_THEN_GLOBAL', 'SITE_GRID_ONLY', 'FIXED_REGION', 'GLOBAL_ONLY');

-- CreateEnum
CREATE TYPE "FactorSetMode" AS ENUM ('PERIOD_DEFAULT', 'PINNED');

-- CreateEnum
CREATE TYPE "GwpSetMode" AS ENUM ('ORG_DEFAULT', 'PINNED');

-- CreateEnum
CREATE TYPE "OutputBasis" AS ENUM ('SINGLE', 'DUAL');

-- CreateEnum
CREATE TYPE "VocabularyKind" AS ENUM ('SITE_TYPE', 'ASSET_TYPE', 'ASSET_CATEGORY', 'DOCUMENT_TYPE', 'DENOMINATOR', 'FUEL_OR_MATERIAL');

-- CreateEnum
CREATE TYPE "LabelEntityKind" AS ENUM ('SCOPE', 'SCOPE3_CATEGORY', 'ACTIVITY_TYPE', 'METHOD', 'ASSET_TYPE', 'ASSET_CATEGORY', 'SITE_TYPE', 'FUEL_OR_MATERIAL', 'UNIT', 'DATA_QUALITY', 'STATUS', 'SECTION', 'QUESTION', 'DENOMINATOR', 'ROLE', 'DOCUMENT_TYPE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK', 'APPROVE', 'REJECT', 'RECALCULATE', 'EXPORT', 'LOGIN', 'IMPORT', 'RESTATE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'METER_READ', 'CONTRACT', 'EAC_CERTIFICATE', 'METHODOLOGY', 'ASSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('ABSOLUTE', 'INTENSITY');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('XLSX', 'PDF', 'JSON', 'CSV');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'DRY_RUN', 'COMMITTED', 'FAILED', 'REVERTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "consolidation_approach" "ConsolidationApproach" NOT NULL DEFAULT 'OPERATIONAL_CONTROL',
    "base_year" INTEGER,
    "base_year_rationale" TEXT,
    "default_gwp_set_id" TEXT,
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "is_sandbox" BOOLEAN NOT NULL DEFAULT false,
    "sandbox_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "kind" "VocabularyKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "parent_code" TEXT,
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_overrides" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_kind" "LabelEntityKind" NOT NULL,
    "code" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL DEFAULT 'org',
    "label" TEXT NOT NULL,
    "short_label" TEXT,
    "description" TEXT,
    "locale" TEXT NOT NULL DEFAULT '*',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legal_entity" TEXT,
    "cost_centre" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL,
    "grid_region" TEXT,
    "timezone" TEXT,
    "site_type" TEXT NOT NULL,
    "ownership" TEXT,
    "floor_area_m2" DECIMAL(20,6),
    "headcount_fte" DECIMAL(20,6),
    "annual_revenue" DECIMAL(20,2),
    "revenue_currency" "UnitCode",
    "denominators" JSONB,
    "parent_site_id" TEXT,
    "in_scope_from" DATE,
    "in_scope_to" DATE,
    "data_owner_id" TEXT,
    "approver_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_ownership_periods" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "consolidation_share" DECIMAL(9,6) NOT NULL DEFAULT 1,

    CONSTRAINT "site_ownership_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type_code" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "fuel_or_material_code" TEXT,
    "capacity" DECIMAL(20,6),
    "capacity_unit" "UnitCode",
    "capacity_note" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "refrigerant_charge_kg" DECIMAL(20,6),
    "sub_location" TEXT,
    "tag_or_serial" TEXT,
    "commissioned_on" DATE,
    "decommissioned_on" DATE,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "default_factor_set_id" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by_id" TEXT,
    "unlock_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factor_sets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "publisher" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "published_on" DATE,
    "region_scope" TEXT,
    "licence" TEXT,
    "source_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_factor_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "factor_set_id" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "scope3_category" INTEGER,
    "activity_type" "ActivityType" NOT NULL,
    "method" "CalcMethod" NOT NULL,
    "fuel_or_material_code" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'GLOBAL',
    "gas" "Gas" NOT NULL DEFAULT 'CO2E_BLENDED',
    "basis" "EmissionBasis" NOT NULL DEFAULT 'SINGLE',
    "value" DECIMAL(24,12) NOT NULL,
    "unit_numerator" "UnitCode" NOT NULL,
    "unit_denominator" "UnitCode" NOT NULL,
    "currency_year" INTEGER,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "source_citation" TEXT NOT NULL,
    "uncertainty_pct" DECIMAL(9,4),
    "superseded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gwp_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gas" "Gas" NOT NULL,
    "gwp_100" DECIMAL(20,6) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gwp_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_properties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "fuel_code" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "value" DECIMAL(24,12) NOT NULL,
    "from_unit" "UnitCode" NOT NULL,
    "to_unit" "UnitCode" NOT NULL,
    "source" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,

    CONSTRAINT "fuel_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "applies_to_site_types" TEXT[],
    "parent_version_id" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_sections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" "Scope" NOT NULL,
    "scope3_category" INTEGER,
    "activity_group" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible_if" JSONB,

    CONSTRAINT "questionnaire_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "help_text" TEXT,
    "input_type" "InputType" NOT NULL DEFAULT 'NUMBER_WITH_UNIT',
    "unit_dimension" "UnitDimension",
    "allowed_units" "UnitCode"[],
    "options" JSONB,
    "columns" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "allow_not_applicable" BOOLEAN NOT NULL DEFAULT true,
    "visible_if" JSONB,
    "prefill_from_prior_period" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "library_question_id" TEXT,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_bindings" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "scope3_category" INTEGER,
    "activity_type" "ActivityType" NOT NULL,
    "method" "CalcMethod" NOT NULL,
    "fuel_or_material_code" TEXT NOT NULL,
    "region_strategy" "RegionStrategy" NOT NULL DEFAULT 'SITE_COUNTRY_THEN_GRID_THEN_GLOBAL',
    "fixed_region" TEXT,
    "factor_set_mode" "FactorSetMode" NOT NULL DEFAULT 'PERIOD_DEFAULT',
    "pinned_factor_set_id" TEXT,
    "gwp_set_mode" "GwpSetMode" NOT NULL DEFAULT 'ORG_DEFAULT',
    "pinned_gwp_set_name" TEXT,
    "output_basis" "OutputBasis" NOT NULL DEFAULT 'SINGLE',
    "multiplier" DECIMAL(20,6) NOT NULL DEFAULT 1,
    "column_bindings" JSONB,
    "health" "BindingHealth" NOT NULL DEFAULT 'OK',
    "health_checked_at" TIMESTAMP(3),
    "health_message" TEXT,

    CONSTRAINT "factor_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_assignments" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "approver_id" TEXT,
    "due_on" DATE,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completeness_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "questionnaire_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
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
    "prior_period_value" DECIMAL(20,6),

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "site_asset_id" TEXT,
    "answer_id" TEXT,
    "scope" "Scope" NOT NULL,
    "scope3_category" INTEGER,
    "activity_type" "ActivityType" NOT NULL,
    "method" "CalcMethod" NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "unit" "UnitCode" NOT NULL,
    "activity_start" DATE NOT NULL,
    "activity_end" DATE NOT NULL,
    "fuel_or_material_code" TEXT NOT NULL,
    "supplier_name" TEXT,
    "supplier_id" TEXT,
    "data_quality" "DataQuality" NOT NULL DEFAULT 'ESTIMATED',
    "uncertainty_pct" DECIMAL(9,4),
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "source_document_ids" TEXT[],
    "import_batch_id" TEXT,
    "restates_id" TEXT,
    "restatement_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_records" (
    "id" TEXT NOT NULL,
    "activity_record_id" TEXT NOT NULL,
    "basis" "EmissionBasis" NOT NULL DEFAULT 'SINGLE',
    "gas" "Gas" NOT NULL DEFAULT 'CO2E_BLENDED',
    "quantity_normalised" DECIMAL(24,12) NOT NULL,
    "unit_normalised" "UnitCode" NOT NULL,
    "unit_conversion_factor" DECIMAL(24,12) NOT NULL,
    "factor_id" TEXT,
    "factor_value" DECIMAL(24,12) NOT NULL,
    "factor_unit_numerator" "UnitCode" NOT NULL,
    "factor_unit_denominator" "UnitCode" NOT NULL,
    "factor_source" TEXT NOT NULL,
    "factor_version" TEXT NOT NULL,
    "factor_valid_from" DATE NOT NULL,
    "factor_valid_to" DATE,
    "gwp_value" DECIMAL(20,6) NOT NULL,
    "gwp_set" TEXT NOT NULL,
    "consolidation_share" DECIMAL(9,6) NOT NULL,
    "days_covered" INTEGER NOT NULL DEFAULT 0,
    "days_total" INTEGER NOT NULL DEFAULT 0,
    "emissions_kg_co2e" DECIMAL(24,6) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calc_engine_version" TEXT NOT NULL,

    CONSTRAINT "emission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "entity_type" TEXT,
    "entity_id" TEXT,
    "uploaded_by_id" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_id" TEXT,
    "due_on" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" TEXT,
    "ip" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope_coverage" JSONB NOT NULL,
    "base_year" INTEGER NOT NULL,
    "base_year_emissions_kg" DECIMAL(24,6) NOT NULL,
    "target_year" INTEGER NOT NULL,
    "target_type" "TargetType" NOT NULL DEFAULT 'ABSOLUTE',
    "reduction_pct" DECIMAL(9,4) NOT NULL,
    "is_science_based" BOOLEAN NOT NULL DEFAULT false,
    "validated_by" TEXT,
    "methodology_note" TEXT,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'XLSX',
    "storage_key" TEXT,
    "sha256" TEXT,
    "figures_snapshot" JSONB NOT NULL,
    "labels_snapshot" JSONB,
    "factor_sets_used" JSONB NOT NULL,
    "calc_engine_version" TEXT NOT NULL,
    "generated_by_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "rows_accepted" INTEGER NOT NULL DEFAULT 0,
    "rows_rejected" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "error_report_key" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "organizations_is_sandbox_sandbox_expires_at_idx" ON "organizations"("is_sandbox", "sandbox_expires_at");

-- CreateIndex
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "vocabulary_entries_kind_is_active_idx" ON "vocabulary_entries"("kind", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_entries_organization_id_kind_code_key" ON "vocabulary_entries"("organization_id", "kind", "code");

-- CreateIndex
CREATE INDEX "label_overrides_organization_id_entity_kind_idx" ON "label_overrides"("organization_id", "entity_kind");

-- CreateIndex
CREATE UNIQUE INDEX "label_overrides_organization_id_entity_kind_code_scope_key__key" ON "label_overrides"("organization_id", "entity_kind", "code", "scope_key", "locale");

-- CreateIndex
CREATE INDEX "sites_organization_id_site_type_idx" ON "sites"("organization_id", "site_type");

-- CreateIndex
CREATE UNIQUE INDEX "sites_organization_id_code_key" ON "sites"("organization_id", "code");

-- CreateIndex
CREATE INDEX "site_ownership_periods_site_id_valid_from_idx" ON "site_ownership_periods"("site_id", "valid_from");

-- CreateIndex
CREATE INDEX "site_assets_site_id_category_idx" ON "site_assets"("site_id", "category");

-- CreateIndex
CREATE INDEX "site_assets_organization_id_asset_type_code_idx" ON "site_assets"("organization_id", "asset_type_code");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_periods_organization_id_label_key" ON "reporting_periods"("organization_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "emission_factor_sets_organization_id_publisher_name_version_key" ON "emission_factor_sets"("organization_id", "publisher", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_superseded_by_id_key" ON "emission_factors"("superseded_by_id");

-- CreateIndex
CREATE INDEX "emission_factors_activity_type_method_fuel_or_material_code_idx" ON "emission_factors"("activity_type", "method", "fuel_or_material_code", "region", "valid_from");

-- CreateIndex
CREATE INDEX "emission_factors_factor_set_id_idx" ON "emission_factors"("factor_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "gwp_sets_name_gas_key" ON "gwp_sets"("name", "gas");

-- CreateIndex
CREATE INDEX "fuel_properties_fuel_code_property_valid_from_idx" ON "fuel_properties"("fuel_code", "property", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_templates_organization_id_name_version_key" ON "questionnaire_templates"("organization_id", "name", "version");

-- CreateIndex
CREATE INDEX "questionnaire_sections_template_id_sort_order_idx" ON "questionnaire_sections"("template_id", "sort_order");

-- CreateIndex
CREATE INDEX "questions_section_id_sort_order_idx" ON "questions"("section_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "questions_section_id_code_key" ON "questions"("section_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "factor_bindings_question_id_key" ON "factor_bindings"("question_id");

-- CreateIndex
CREATE INDEX "factor_bindings_health_idx" ON "factor_bindings"("health");

-- CreateIndex
CREATE INDEX "questionnaire_assignments_reporting_period_id_status_idx" ON "questionnaire_assignments"("reporting_period_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_assignments_site_id_reporting_period_id_templ_key" ON "questionnaire_assignments"("site_id", "reporting_period_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_assignment_id_question_id_key" ON "answers"("assignment_id", "question_id");

-- CreateIndex
CREATE INDEX "activity_records_organization_id_reporting_period_id_scope_idx" ON "activity_records"("organization_id", "reporting_period_id", "scope");

-- CreateIndex
CREATE INDEX "activity_records_site_id_activity_start_idx" ON "activity_records"("site_id", "activity_start");

-- CreateIndex
CREATE INDEX "emission_records_activity_record_id_idx" ON "emission_records"("activity_record_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_entity_type_entity_id_idx" ON "documents"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_due_on_idx" ON "tasks"("organization_id", "status", "due_on");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_idx" ON "audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "reports_organization_id_reporting_period_id_idx" ON "reports"("organization_id", "reporting_period_id");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_status_idx" ON "import_batches"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_entries" ADD CONSTRAINT "vocabulary_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_overrides" ADD CONSTRAINT "label_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_parent_site_id_fkey" FOREIGN KEY ("parent_site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_ownership_periods" ADD CONSTRAINT "site_ownership_periods_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_default_factor_set_id_fkey" FOREIGN KEY ("default_factor_set_id") REFERENCES "emission_factor_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_factor_sets" ADD CONSTRAINT "emission_factor_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_factor_set_id_fkey" FOREIGN KEY ("factor_set_id") REFERENCES "emission_factor_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "emission_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_properties" ADD CONSTRAINT "fuel_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_templates" ADD CONSTRAINT "questionnaire_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_sections" ADD CONSTRAINT "questionnaire_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "questionnaire_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "questionnaire_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_bindings" ADD CONSTRAINT "factor_bindings_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_bindings" ADD CONSTRAINT "factor_bindings_pinned_factor_set_id_fkey" FOREIGN KEY ("pinned_factor_set_id") REFERENCES "emission_factor_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_assignments" ADD CONSTRAINT "questionnaire_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "questionnaire_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_assignments" ADD CONSTRAINT "questionnaire_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_assignments" ADD CONSTRAINT "questionnaire_assignments_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "questionnaire_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_site_asset_id_fkey" FOREIGN KEY ("site_asset_id") REFERENCES "site_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_records" ADD CONSTRAINT "emission_records_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "emission_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
