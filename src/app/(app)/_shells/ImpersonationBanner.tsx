import { getImpersonator } from "@/lib/session";
import { rawPrisma } from "@/lib/db/client";
import { getCurrentMembership } from "@/lib/demo-org";
import { endImpersonation } from "./impersonationActions";

export async function ImpersonationBanner() {
  const impersonator = await getImpersonator();
  if (!impersonator) return null;

  const [realUser, viewingAs] = await Promise.all([
    rawPrisma.user.findUnique({ where: { id: impersonator.userId } }),
    getCurrentMembership(),
  ]);

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-[13px] font-medium text-amber-950">
      <span>
        {realUser?.name ?? realUser?.email ?? "A Super Admin"} is viewing as {viewingAs?.user.name ?? viewingAs?.user.email} at{" "}
        {viewingAs?.org.legalName} — every action here is logged under both identities.
      </span>
      <form action={endImpersonation}>
        <button type="submit" className="rounded-md bg-amber-950 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900">
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
