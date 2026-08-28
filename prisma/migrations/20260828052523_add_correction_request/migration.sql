-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "position_value_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correction_requests_organization_id_status_idx" ON "correction_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "correction_requests_position_value_id_status_idx" ON "correction_requests"("position_value_id", "status");

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_position_value_id_fkey" FOREIGN KEY ("position_value_id") REFERENCES "position_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;
