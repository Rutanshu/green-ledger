/**
 * Turns EmissionFactorSet + EmissionFactor rows (Prisma shape) into the
 * plain CandidateFactor[] that lib/factors' pure functions expect. Not
 * pure itself — just a boundary adapter, kept in one place so the Factor
 * Lab health check and the real calculation run can never drift apart.
 */
import type { CandidateFactor } from '@/lib/factors';

interface FactorSetLike {
  name: string;
  version: string;
  factors: ReadonlyArray<{
    id: string;
    scope: string;
    scope3Category: number | null;
    activityType: string;
    method: string;
    fuelOrMaterialCode: string;
    region: string;
    gas: string;
    basis: string;
    value: { toString(): string };
    unitNumerator: string;
    unitDenominator: string;
    validFrom: Date;
    validTo: Date | null;
    sourceCitation: string;
  }>;
}

export function buildFactorCandidates(factorSets: readonly FactorSetLike[]): CandidateFactor[] {
  return factorSets.flatMap((set) =>
    set.factors.map((f) => ({
      id: f.id,
      scope: f.scope as CandidateFactor['scope'],
      scope3Category: f.scope3Category,
      activityType: f.activityType as CandidateFactor['activityType'],
      method: f.method as CandidateFactor['method'],
      fuelOrMaterialCode: f.fuelOrMaterialCode,
      region: f.region,
      gas: f.gas as CandidateFactor['gas'],
      basis: f.basis as CandidateFactor['basis'],
      value: f.value.toString(),
      unitNumerator: f.unitNumerator as CandidateFactor['unitNumerator'],
      unitDenominator: f.unitDenominator as CandidateFactor['unitDenominator'],
      validFrom: f.validFrom,
      validTo: f.validTo,
      sourceCitation: f.sourceCitation,
      factorSetName: set.name,
      factorSetVersion: set.version,
    })),
  );
}
