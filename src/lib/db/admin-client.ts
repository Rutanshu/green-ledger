/**
 * The owner-role connection (DIRECT_URL) — bypasses RLS, has DDL rights.
 * For admin scripts only: seeding, migrations tooling, test setup/teardown
 * that needs to read or write across orgs without a session to scope it.
 * Never import this from app request code — that's what rawPrisma
 * (app_user, RLS-restricted) and orgScopedClient() are for.
 */
import { PrismaClient } from '../../generated/prisma';

const globalForAdmin = globalThis as unknown as { adminPrisma?: PrismaClient };

export const adminPrisma =
  globalForAdmin.adminPrisma ?? new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

if (process.env.NODE_ENV !== 'production') {
  globalForAdmin.adminPrisma = adminPrisma;
}
