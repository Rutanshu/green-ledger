"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { checkBindingHealth, type CandidateFactor } from "@/lib/factors";

export async function retestBinding(bindingId: string) {
  const org = await getCurrentOrg();
  if (!org) return;
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

  const candidates: CandidateFactor[] = factorSets.flatMap((set) =>
    set.factors.map((f) => ({
      id: f.id,
      scope: f.scope,
      scope3Category: f.scope3Category,
      activityType: f.activityType,
      method: f.method,
      fuelOrMaterialCode: f.fuelOrMaterialCode,
      region: f.region,
      gas: f.gas,
      basis: f.basis,
      value: f.value.toString(),
      unitNumerator: f.unitNumerator,
      unitDenominator: f.unitDenominator,
      validFrom: f.validFrom,
      validTo: f.validTo,
      sourceCitation: f.sourceCitation,
      factorSetName: set.name,
      factorSetVersion: set.version,
    })),
  );

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

  revalidatePath("/factor-lab");
  revalidatePath("/");
}
