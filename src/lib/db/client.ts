/**
 * The base Prisma client. Never import this directly from app code — use
 * `orgScopedClient()` from `./tenant` so every query is org-scoped. This
 * file exists only so there is exactly one PrismaClient per process (the
 * standard Next.js dev-mode hot-reload guard).
 */
import { PrismaClient } from '../../generated/prisma';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const rawPrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = rawPrisma;
}
