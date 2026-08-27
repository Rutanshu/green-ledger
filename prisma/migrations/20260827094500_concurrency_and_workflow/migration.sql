-- AlterTable
-- DEFAULT CURRENT_TIMESTAMP backfills existing rows; lib/concurrency's
-- assertFreshWrite is what actually enforces optimistic concurrency going
-- forward — this default only makes the NOT NULL column addition safe.
ALTER TABLE "answers" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "questionnaire_assignments" ADD COLUMN     "submitted_by_id" TEXT;
