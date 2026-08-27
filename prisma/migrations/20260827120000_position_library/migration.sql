-- DropIndex
DROP INDEX "factor_assignments_impact_profile_id_question_code_key";

-- AlterTable
ALTER TABLE "factor_assignments" DROP COLUMN "question_code",
ADD COLUMN     "position_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "factor_bindings" ADD COLUMN     "position_id" TEXT,
ALTER COLUMN "question_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "questionnaire_section_items" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "questionnaire_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questionnaire_section_items_section_id_sort_order_idx" ON "questionnaire_section_items"("section_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_section_items_section_id_position_id_key" ON "questionnaire_section_items"("section_id", "position_id");

-- CreateIndex
CREATE UNIQUE INDEX "factor_assignments_impact_profile_id_position_code_key" ON "factor_assignments"("impact_profile_id", "position_code");

-- CreateIndex
CREATE UNIQUE INDEX "factor_bindings_position_id_key" ON "factor_bindings"("position_id");

-- AddForeignKey
ALTER TABLE "questionnaire_section_items" ADD CONSTRAINT "questionnaire_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "questionnaire_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_section_items" ADD CONSTRAINT "questionnaire_section_items_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factor_bindings" ADD CONSTRAINT "factor_bindings_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

