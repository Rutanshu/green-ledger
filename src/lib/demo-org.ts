/**
 * Stand-in for auth/session org resolution, which doesn't exist yet.
 * Every page that needs "the current org" calls this instead of querying
 * rawPrisma directly, so there's one place to swap in real session lookup.
 */
import { rawPrisma } from "@/lib/db/client";

export function getDemoOrg() {
  return rawPrisma.organization.findFirst({
    where: { legalName: "Meridian Industries (Demo)" },
  });
}
