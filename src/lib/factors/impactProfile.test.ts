import { describe, expect, it } from "vitest";
import { activateProfile, diffProfiles, IllegalProfileTransitionError, supersedeProfile, type FactorAssignmentLike } from "./impactProfile";

function assignment(overrides: Partial<FactorAssignmentLike> = {}): FactorAssignmentLike {
  return {
    questionCode: "diesel_qty",
    scope: "SCOPE_1",
    scope3Category: null,
    activityType: "STATIONARY_COMBUSTION",
    method: "FUEL_BASED",
    fuelOrMaterialCode: "DIESEL",
    regionStrategy: "SITE_COUNTRY_THEN_GRID_THEN_GLOBAL",
    outputBasis: "SINGLE",
    ...overrides,
  };
}

describe("activateProfile / supersedeProfile", () => {
  it("DRAFT activates to ACTIVE", () => {
    expect(activateProfile("DRAFT")).toBe("ACTIVE");
  });
  it("throws activating an already-ACTIVE profile", () => {
    expect(() => activateProfile("ACTIVE")).toThrow(IllegalProfileTransitionError);
  });
  it("throws activating a SUPERSEDED profile", () => {
    expect(() => activateProfile("SUPERSEDED")).toThrow(IllegalProfileTransitionError);
  });
  it("ACTIVE supersedes to SUPERSEDED", () => {
    expect(supersedeProfile("ACTIVE")).toBe("SUPERSEDED");
  });
  it("throws superseding a DRAFT profile directly", () => {
    expect(() => supersedeProfile("DRAFT")).toThrow(IllegalProfileTransitionError);
  });
});

describe("diffProfiles", () => {
  it("an assignment present in both, unchanged, is neither added, removed, nor changed", () => {
    const a = [assignment()];
    const b = [assignment()];
    const diff = diffProfiles(a, b);
    expect(diff).toEqual({ added: [], removed: [], changed: [] });
  });

  it("an assignment only in b is added", () => {
    const diff = diffProfiles([], [assignment()]);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it("an assignment only in a is removed", () => {
    const diff = diffProfiles([assignment()], []);
    expect(diff.removed).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
  });

  it("an assignment with the same code but a different field is changed, not added+removed", () => {
    const before = assignment({ fuelOrMaterialCode: "DIESEL" });
    const after = assignment({ fuelOrMaterialCode: "BIODIESEL" });
    const diff = diffProfiles([before], [after]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toEqual([{ questionCode: "diesel_qty", before, after }]);
  });
});
