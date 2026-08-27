/**
 * Impact Profile versioning. GHG_TOOL_ARCHITECTURE.md §4.5/§20, BUILD_PLAN
 * Step 2.3. An ImpactProfile is an immutable, versioned snapshot of every
 * question's factor binding at one moment — the audit trail sitting
 * alongside the live, editable FactorBinding rows (see lib/factors/index.ts
 * for the actual factor resolution those bindings drive).
 *
 * PURE MODULE — no Prisma, no fetch, no Date.now(). Callers pass in the
 * current state and get back the next state or a diff.
 */
export type ImpactProfileStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED";

export class IllegalProfileTransitionError extends Error {
  constructor(readonly from: ImpactProfileStatus, readonly to: ImpactProfileStatus) {
    super(`Illegal impact profile transition: ${from} -> ${to}`);
    this.name = "IllegalProfileTransitionError";
  }
}

/** DRAFT -> ACTIVE (a profile is activated once) -> SUPERSEDED (only by a later activation, never directly). */
export function activateProfile(status: ImpactProfileStatus): ImpactProfileStatus {
  if (status !== "DRAFT") throw new IllegalProfileTransitionError(status, "ACTIVE");
  return "ACTIVE";
}

export function supersedeProfile(status: ImpactProfileStatus): ImpactProfileStatus {
  if (status !== "ACTIVE") throw new IllegalProfileTransitionError(status, "SUPERSEDED");
  return "SUPERSEDED";
}

export interface FactorAssignmentLike {
  positionCode: string;
  scope: string;
  scope3Category: number | null;
  activityType: string;
  method: string;
  fuelOrMaterialCode: string;
  regionStrategy: string;
  outputBasis: string;
}

export interface ProfileDiff {
  added: FactorAssignmentLike[];
  removed: FactorAssignmentLike[];
  changed: Array<{ positionCode: string; before: FactorAssignmentLike; after: FactorAssignmentLike }>;
}

const ASSIGNMENT_FIELDS: readonly (keyof FactorAssignmentLike)[] = [
  "scope",
  "scope3Category",
  "activityType",
  "method",
  "fuelOrMaterialCode",
  "regionStrategy",
  "outputBasis",
];

function assignmentsEqual(a: FactorAssignmentLike, b: FactorAssignmentLike): boolean {
  return ASSIGNMENT_FIELDS.every((f) => a[f] === b[f]);
}

/** What changed between two profile snapshots, keyed by position code (stable across the underlying row being deleted and recreated). */
export function diffProfiles(a: readonly FactorAssignmentLike[], b: readonly FactorAssignmentLike[]): ProfileDiff {
  const beforeByCode = new Map(a.map((x) => [x.positionCode, x]));
  const afterByCode = new Map(b.map((x) => [x.positionCode, x]));

  const added: FactorAssignmentLike[] = [];
  const changed: ProfileDiff["changed"] = [];
  for (const [code, after] of afterByCode) {
    const before = beforeByCode.get(code);
    if (!before) {
      added.push(after);
    } else if (!assignmentsEqual(before, after)) {
      changed.push({ positionCode: code, before, after });
    }
  }
  const removed = [...beforeByCode.entries()].filter(([code]) => !afterByCode.has(code)).map(([, v]) => v);

  return { added, removed, changed };
}
