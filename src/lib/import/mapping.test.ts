import { describe, expect, it } from "vitest";
import { applyMapping, identityMapping } from "./mapping";

describe("identityMapping", () => {
  it("maps headers that already match canonical names 1:1", () => {
    expect(identityMapping(["site_code", "value", "note"])).toEqual({ site_code: "site_code", value: "value" });
  });
});

describe("applyMapping", () => {
  it("translates a raw row through a saved column mapping", () => {
    const mapping = { "Site code": "site_code", "Diesel (litres)": "value" } as const;
    const row = { "Site code": "MI-AD-04", "Diesel (litres)": "3100", Notes: "ignored" };
    expect(applyMapping(row, mapping)).toEqual({ site_code: "MI-AD-04", value: "3100" });
  });

  it("ignores a mapped header that isn't present in this row", () => {
    const mapping = { "Site code": "site_code" } as const;
    expect(applyMapping({}, mapping)).toEqual({});
  });
});
