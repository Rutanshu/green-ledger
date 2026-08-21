-- Role enum swap. memberships is empty (no real user accounts have ever
-- existed), so this is a straight rename, not a data migration.
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'DATA_MANAGER', 'DATA_INPUTTER', 'READ_ONLY');
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE "Role" USING ('READ_ONLY'::"Role");
DROP TYPE "Role_old";

ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'READ_ONLY';

-- Real password auth.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
