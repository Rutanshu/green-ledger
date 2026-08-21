"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { checkBindingHealth } from "@/lib/factors";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export async function retestBinding(bindingId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return;
  if (!can(membership.role, "manage_factors")) return; // UI already hides this control for other roles
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const binding = await db.factorBinding.findFirst({
    where: { id: bindingId, question: { section: { template: { organizationId: org.id } } } },
  });
  if (!binding) return;

  const [factorSets, site] = await Promise.all([
    db.emissionFactorSet.findMany({ include: { factors: true } }),
    db.site.findFirst({ orderBy: { code: "asc" } }),
  ]);
  if (!site) return;

  const candidates = buildFactorCandidates(factorSets);

  const bases: Array<"LOCATION_BASED" | "MARKET_BASED" | undefined> =
    binding.outputBasis === "DUAL" ? ["LOCATION_BASED", "MARKET_BASED"] : [undefined];

  const rank = { OK: 0, FALLBACK_REGION: 1, AMBIGUOUS: 2, BROKEN: 3 } as const;
  let worst: { health: keyof typeof rank; message: string | null } = { health: "OK", message: null };
  for (const basis of bases) {
    const result = checkBindingHealth(candidates, {
      activityType: binding.activityType,
      method: binding.method,
      fuelOrMaterialCode: binding.fuelOrMaterialCode,
      basis,
      regionStrategy: binding.regionStrategy,
      fixedRegion: binding.fixedRegion,
      siteCountry: site.country,
      siteGridRegion: site.gridRegion,
      on: new Date(),
    });
    if (rank[result.health] > rank[worst.health]) worst = result;
  }

  await db.factorBinding.update({
    where: { id: bindingId },
    data: { health: worst.health, healthMessage: worst.message, healthCheckedAt: new Date() },
  });
  await withOrgTransaction(org.id, (tx) =>
    recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "UPDATE",
      entityType: "FactorBinding",
      entityId: bindingId,
      after: { health: worst.health, message: worst.message },
    }),
  );

  revalidatePath("/factor-lab");
  revalidatePath("/");
}
