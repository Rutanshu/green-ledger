-- AlterEnum
ALTER TYPE "InputType" ADD VALUE 'INDICATOR';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "computed_dimension" TEXT,
ADD COLUMN     "formula" TEXT;
