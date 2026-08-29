-- AlterTable
ALTER TABLE "position_values" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "unlock_reason" TEXT,
ADD COLUMN     "unlocked_at" TIMESTAMP(3),
ADD COLUMN     "unlocked_by_id" TEXT;
