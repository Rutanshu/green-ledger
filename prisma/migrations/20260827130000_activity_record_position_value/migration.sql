-- AlterTable
ALTER TABLE "activity_records" ADD COLUMN     "position_value_id" TEXT;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_position_value_id_fkey" FOREIGN KEY ("position_value_id") REFERENCES "position_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

