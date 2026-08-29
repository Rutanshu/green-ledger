-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "depth" INTEGER,
ADD COLUMN     "path" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "sites_organization_id_parent_site_id_idx" ON "sites"("organization_id", "parent_site_id");

-- GIN index for the descendant roll-up query ("$1 = ANY(path)") — not
-- expressible via Prisma's schema DSL (no extendedIndexes preview
-- feature enabled), added by hand. Prisma's own diff on this migration
-- will see it as already applied since it only tracks columns/plain
-- indexes it generated, not this raw addition.
CREATE INDEX "sites_path_gin_idx" ON "sites" USING GIN ("path");
