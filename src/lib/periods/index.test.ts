import { describe, expect, it } from "vitest";
import { assertPeriodWritable, isPeriodWritable, IllegalPeriodTransitionError, PeriodLockedError, transitionPeriod } from "./index";

describe("transitionPeriod", () => {
  it("allows DRAFT -> IN_REVIEW", () => {
    expect(transitionPeriod("DRAFT", "IN_REVIEW")).toBe("IN_REVIEW");
  });
  it("allows IN_REVIEW -> LOCKED", () => {
    expect(transitionPeriod("IN_REVIEW", "LOCKED")).toBe("LOCKED");
  });
  it("allows IN_REVIEW -> DRAFT (reopened before locking)", () => {
    expect(transitionPeriod("IN_REVIEW", "DRAFT")).toBe("DRAFT");
  });
  it("allows LOCKED -> ASSURED", () => {
    expect(transitionPeriod("LOCKED", "ASSURED")).toBe("ASSURED");
  });
  it("throws on DRAFT -> LOCKED (skipping review)", () => {
    expect(() => transitionPeriod("DRAFT", "LOCKED")).toThrow(IllegalPeriodTransitionError);
  });
  it("throws on LOCKED -> DRAFT (locked periods never reopen)", () => {
    expect(() => transitionPeriod("LOCKED", "DRAFT")).toThrow(IllegalPeriodTransitionError);
  });
  it("throws on ASSURED -> anything (terminal state)", () => {
    expect(() => transitionPeriod("ASSURED", "LOCKED")).toThrow(IllegalPeriodTransitionError);
  });
});

describe("isPeriodWritable / assertPeriodWritable", () => {
  it("DRAFT and IN_REVIEW are writable", () => {
    expect(isPeriodWritable("DRAFT")).toBe(true);
    expect(isPeriodWritable("IN_REVIEW")).toBe(true);
  });
  it("LOCKED and ASSURED are not writable", () => {
    expect(isPeriodWritable("LOCKED")).toBe(false);
    expect(isPeriodWritable("ASSURED")).toBe(false);
  });
  it("assertPeriodWritable throws PeriodLockedError on a locked period", () => {
    expect(() => assertPeriodWritable({ label: "FY2026", status: "LOCKED" })).toThrow(PeriodLockedError);
  });
  it("assertPeriodWritable throws PeriodLockedError on an assured period", () => {
    expect(() => assertPeriodWritable({ label: "FY2025", status: "ASSURED" })).toThrow(PeriodLockedError);
  });
  it("assertPeriodWritable is silent on a draft period", () => {
    expect(() => assertPeriodWritable({ label: "FY2026", status: "DRAFT" })).not.toThrow();
  });
});
