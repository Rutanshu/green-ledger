import { describe, expect, it } from "vitest";
import { assertPositionMutable, PositionImmutableFieldError } from "./index";

describe("assertPositionMutable", () => {
  it("allows a type change when no data exists yet", () => {
    expect(() =>
      assertPositionMutable({ type: "FLOW", dimension: "VOLUME" }, { type: "ASSET", dimension: "VOLUME" }, false),
    ).not.toThrow();
  });

  it("throws changing type when a PositionValue/PositionAssetValue exists", () => {
    expect(() =>
      assertPositionMutable({ type: "FLOW", dimension: "VOLUME" }, { type: "ASSET", dimension: "VOLUME" }, true),
    ).toThrow(PositionImmutableFieldError);
  });

  it("throws changing dimension when data exists, even if type is unchanged", () => {
    expect(() =>
      assertPositionMutable({ type: "FLOW", dimension: "VOLUME" }, { type: "FLOW", dimension: "ENERGY" }, true),
    ).toThrow(PositionImmutableFieldError);
  });

  it("allows changing dimension when no data exists", () => {
    expect(() =>
      assertPositionMutable({ type: "FLOW", dimension: "VOLUME" }, { type: "FLOW", dimension: "ENERGY" }, false),
    ).not.toThrow();
  });

  it("allows a no-op update (same type and dimension) even with data present", () => {
    expect(() =>
      assertPositionMutable({ type: "FLOW", dimension: "VOLUME" }, { type: "FLOW", dimension: "VOLUME" }, true),
    ).not.toThrow();
  });

  it("allows changing null dimension to a real one only when no data exists", () => {
    expect(() => assertPositionMutable({ type: "TEXT", dimension: null }, { type: "TEXT", dimension: "VOLUME" }, false)).not.toThrow();
    expect(() => assertPositionMutable({ type: "TEXT", dimension: null }, { type: "TEXT", dimension: "VOLUME" }, true)).toThrow(PositionImmutableFieldError);
  });
});
