-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "feature_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_organization_id_feature_code_key" ON "entitlements"("organization_id", "feature_code");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Real RLS, same as every other strict table (see _org_scoping_rls).
ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entitlements" USING (organization_id = current_setting('app.org_id', true));
