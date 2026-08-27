-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "comment" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

