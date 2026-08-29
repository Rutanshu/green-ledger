"use server";

import { getCurrentMembership } from "@/lib/demo-org";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { calculatePcafFinancedEmissions, PcafInputSchema, PcafZeroDenominatorError } from "@/lib/calc/pcaf";
import { calculateSbtiNearTermTarget, SbtiInputSchema } from "@/lib/calc/sbti";

async function requireCalculatorAccess(): Promise<{ ok: true } | { ok: false; error: string }> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "manage_questionnaire")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't use the calculators.` };
  }
  return { ok: true };
}

export type PcafState =
  | { ok: true; attributionFactor: string; financedEmissionsKgCo2e: string; denominatorUsed: string }
  | { ok: false; error: string }
  | null;

/**
 * v1: calculator only — no persistence. Every number here comes straight
 * from lib/calc/pcaf's pure function; this action is just the Zod
 * boundary and auth check around it (CLAUDE.md rule 1 — no arithmetic
 * happens in a component or action, only in lib/calc/).
 */
export async function runPcafCalculation(_prev: PcafState, formData: FormData): Promise<PcafState> {
  const auth = await requireCalculatorAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = Object.fromEntries(formData);
  const parsed = PcafInputSchema.safeParse({
    ...raw,
    dataQualityScore: raw.dataQualityScore ? Number(raw.dataQualityScore) : undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const result = calculatePcafFinancedEmissions(parsed.data);
    return {
      ok: true,
      attributionFactor: result.attributionFactor.toString(),
      financedEmissionsKgCo2e: result.financedEmissionsKgCo2e.toString(),
      denominatorUsed: result.denominatorUsed.toString(),
    };
  } catch (e) {
    if (e instanceof PcafZeroDenominatorError) return { ok: false, error: e.message };
    throw e;
  }
}

export type SbtiState =
  | {
      ok: true;
      yearsToTarget: number;
      reductionRatePerYear: string;
      totalReductionPct: string;
      targetYearEmissionsKgCo2e: string;
      meetsMinimumAmbition: boolean;
      minimumAmbitionRatePerYear: string;
      minimumAmbitionSource: string;
    }
  | { ok: false; error: string }
  | null;

export async function runSbtiCalculation(_prev: SbtiState, formData: FormData): Promise<SbtiState> {
  const auth = await requireCalculatorAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = Object.fromEntries(formData);
  const parsed = SbtiInputSchema.safeParse({
    baseYear: raw.baseYear ? Number(raw.baseYear) : undefined,
    baseYearEmissionsKgCo2e: raw.baseYearEmissionsKgCo2e,
    targetYear: raw.targetYear ? Number(raw.targetYear) : undefined,
    reductionRatePerYear: raw.reductionRatePerYear || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const result = calculateSbtiNearTermTarget(parsed.data);
  return {
    ok: true,
    yearsToTarget: result.yearsToTarget,
    reductionRatePerYear: result.reductionRatePerYear.toString(),
    totalReductionPct: result.totalReductionPct.toString(),
    targetYearEmissionsKgCo2e: result.targetYearEmissionsKgCo2e.toString(),
    meetsMinimumAmbition: result.meetsMinimumAmbition,
    minimumAmbitionRatePerYear: result.minimumAmbitionRatePerYear.toString(),
    minimumAmbitionSource: result.minimumAmbitionSource,
  };
}
