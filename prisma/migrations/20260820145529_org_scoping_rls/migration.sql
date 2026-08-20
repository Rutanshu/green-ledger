-- Layer 2 of tenant isolation (ARCHITECTURE.md "Multi-tenancy — belt and
-- braces"). Layer 1 is the org-scoping Prisma extension in
-- src/lib/db/tenant.ts, which sets `app.org_id` via SET LOCAL before every
-- query. This migration enables Postgres Row-Level Security keyed off that
-- setting, on every table that carries organization_id.
--
-- FORCE ROW LEVEL SECURITY matters here specifically: Postgres exempts a
-- table's OWNER from RLS by default, and on Neon's free tier the app
-- connects as that owning role (there's no separate low-privilege app role
-- yet). Without FORCE, these policies would silently do nothing.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'memberships', 'label_overrides', 'sites', 'site_assets', 'reporting_periods',
    'questionnaire_templates', 'documents', 'tasks', 'audit_events', 'targets',
    'reports', 'import_batches', 'activity_records',
    'vocabulary_entries', 'emission_factor_sets', 'fuel_properties'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Strict tables: every row must belong to the current org. If app.org_id is
-- unset, current_setting(..., true) returns NULL and the comparison is
-- false for every row — fails closed.
CREATE POLICY tenant_isolation ON memberships              USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON label_overrides           USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON sites                     USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON site_assets                USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON reporting_periods          USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON questionnaire_templates    USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON documents                  USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON tasks                      USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON audit_events                USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON targets                     USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON reports                     USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON import_batches               USING (organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON activity_records              USING (organization_id = current_setting('app.org_id', true));

-- Shared-or-org tables: a NULL organization_id is system-seeded reference
-- data (vocabulary, published factor sets) and stays visible to every org.
CREATE POLICY tenant_isolation ON vocabulary_entries    USING (organization_id IS NULL OR organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON emission_factor_sets  USING (organization_id IS NULL OR organization_id = current_setting('app.org_id', true));
CREATE POLICY tenant_isolation ON fuel_properties       USING (organization_id IS NULL OR organization_id = current_setting('app.org_id', true));

-- audit_events is append-only from the app's perspective (ARCHITECTURE.md
-- "Audit trail"). There is no separate low-privilege app role to REVOKE
-- UPDATE/DELETE from yet — tracked as follow-up work, not silently skipped.
