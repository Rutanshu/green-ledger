import { describe, expect, it } from "vitest";
import { computeSitePath, MAX_SITE_DEPTH, resolveSites, SiteCycleError, SiteDepthExceededError } from "./index";

describe("computeSitePath", () => {
  it("a root site has path [self], depth 0", () => {
    expect(computeSitePath("a", null)).toEqual({ path: ["a"], depth: 0 });
  });
  it("a child appends to the parent's path", () => {
    expect(computeSitePath("b", { id: "a", path: ["a"] })).toEqual({ path: ["a", "b"], depth: 1 });
  });
  it("a six-level-deep roll-up is a single path array, computed without recursion", () => {
    let parent: { id: string; path: readonly string[] } | null = null;
    const ids = ["l1", "l2", "l3", "l4", "l5"];
    for (const id of ids) {
      const { path } = computeSitePath(id, parent);
      parent = { id, path };
    }
    const result = computeSitePath("l6", parent);
    expect(result.path).toEqual(["l1", "l2", "l3", "l4", "l5", "l6"]);
    expect(result.depth).toBe(5);
  });
  it("throws SiteDepthExceededError past MAX_SITE_DEPTH", () => {
    let parent: { id: string; path: readonly string[] } | null = null;
    for (let i = 0; i < MAX_SITE_DEPTH; i++) {
      const id = `l${i}`;
      const { path } = computeSitePath(id, parent);
      parent = { id, path };
    }
    expect(() => computeSitePath("too-deep", parent)).toThrow(SiteDepthExceededError);
  });
  it("throws SiteCycleError if the new site's own id is already in the parent's path", () => {
    expect(() => computeSitePath("a", { id: "b", path: ["a", "b"] })).toThrow(SiteCycleError);
  });
});

describe("resolveSites", () => {
  const period2025 = { start: new Date("2025-01-01"), end: new Date("2025-12-31") };
  const period2026 = { start: new Date("2026-01-01"), end: new Date("2026-12-31") };

  it("a site with no scope dates is in scope for every period", () => {
    const sites = [{ id: "a", inScopeFrom: null, inScopeTo: null }];
    expect(resolveSites(sites, period2025.start, period2025.end)).toHaveLength(1);
    expect(resolveSites(sites, period2026.start, period2026.end)).toHaveLength(1);
  });

  it("a site divested mid-2025 appears in the 2025 period and not 2026", () => {
    const sites = [{ id: "a", inScopeFrom: null, inScopeTo: new Date("2025-06-30") }];
    expect(resolveSites(sites, period2025.start, period2025.end)).toHaveLength(1);
    expect(resolveSites(sites, period2026.start, period2026.end)).toHaveLength(0);
  });

  it("a site acquired mid-2026 does not appear in 2025 but appears in 2026", () => {
    const sites = [{ id: "a", inScopeFrom: new Date("2026-04-01"), inScopeTo: null }];
    expect(resolveSites(sites, period2025.start, period2025.end)).toHaveLength(0);
    expect(resolveSites(sites, period2026.start, period2026.end)).toHaveLength(1);
  });
});
