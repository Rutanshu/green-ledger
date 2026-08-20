import { rawPrisma } from "@/lib/db/client";
import { getSessionOrgId } from "@/lib/session";

/** Looked up by name — used only by the "Try the demo" login action. */
export function findDemoOrg() {
  return rawPrisma.organization.findFirst({
    where: { legalName: "Meridian Industries (Demo)" },
  });
}

/** The org for the current session, or null if not signed in. */
export async function getCurrentOrg() {
  const orgId = await getSessionOrgId();
  if (!orgId) return null;
  return rawPrisma.organization.findUnique({ where: { id: orgId } });
}
