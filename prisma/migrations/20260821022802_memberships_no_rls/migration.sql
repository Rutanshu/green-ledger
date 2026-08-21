-- memberships cannot carry the same org-scoped RLS policy as every other
-- tenant table: login and session resolution (getCurrentMembership, in
-- src/lib/demo-org.ts) must look up "which org(s) does this user belong
-- to" BEFORE any app.org_id context exists — that lookup IS how org
-- context gets established in the first place. RLS keyed off app.org_id
-- makes that query return zero rows unconditionally, which silently
-- breaks every login once the app runs as a role without BYPASSRLS.
--
-- Verified directly: with FORCE RLS still on and no app.org_id set, a
-- direct connection as app_user saw 0 membership rows. Confirmed via test
-- before this migration existed — this isn't a hypothetical.
--
-- Membership stays protected by layer 1 (the orgScopedClient Prisma
-- extension, which still includes it in STRICT_ORG_MODELS) for anything
-- that goes through the scoped client. This migration only removes the
-- independent, RLS-based second layer for this one table.
DROP POLICY IF EXISTS tenant_isolation ON memberships;
ALTER TABLE memberships NO FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
