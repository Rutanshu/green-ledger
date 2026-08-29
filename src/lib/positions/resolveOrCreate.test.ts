import { describe, expect, it, vi } from "vitest";
import { resolveOrCreatePosition, type QuestionLike } from "./resolveOrCreate";

interface UpsertArgs {
  where: unknown;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

function fakeTx() {
  const upsert = vi.fn(async (args: UpsertArgs) => ({ id: "pos-1" }));
  return { tx: { position: { upsert } }, upsert };
}

const question: QuestionLike = {
  code: "diesel_qty",
  label: "How much diesel?",
  inputType: "NUMBER_WITH_UNIT",
  unitDimension: "VOLUME",
  allowedUnits: ["L", "M3"],
  visibleIf: { site_has_asset: { fuelOrMaterialCode: "diesel" } },
};

describe("resolveOrCreatePosition", () => {
  it("creates a Position with visibleIf copied from the Question", async () => {
    const { tx, upsert } = fakeTx();
    await resolveOrCreatePosition(tx, "org-1", question);
    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId_positionCode: { organizationId: "org-1", positionCode: "diesel_qty" } });
    expect(args.create).toMatchObject({
      organizationId: "org-1",
      positionCode: "diesel_qty",
      labelKey: "How much diesel?",
      type: "FLOW",
      dimension: "VOLUME",
      allowedUnits: ["L", "M3"],
      visibleIf: question.visibleIf,
    });
  });

  it("maps INDICATOR input type to type INDICATOR, everything else to FLOW", async () => {
    const { tx, upsert } = fakeTx();
    await resolveOrCreatePosition(tx, "org-1", { ...question, inputType: "INDICATOR" });
    expect(upsert.mock.calls[0][0].create.type).toBe("INDICATOR");

    await resolveOrCreatePosition(tx, "org-1", { ...question, inputType: "BOOLEAN" });
    expect(upsert.mock.calls[1][0].create.type).toBe("FLOW");
  });

  it("defaults a missing visibleIf to null rather than undefined", async () => {
    const { tx, upsert } = fakeTx();
    await resolveOrCreatePosition(tx, "org-1", { ...question, visibleIf: undefined });
    expect(upsert.mock.calls[0][0].create.visibleIf).toBeNull();
    expect(upsert.mock.calls[0][0].update.visibleIf).toBeNull();
  });

  it("on conflict, only re-copies visibleIf — never re-writes label/dimension/units", async () => {
    const { tx, upsert } = fakeTx();
    await resolveOrCreatePosition(tx, "org-1", question);
    const args = upsert.mock.calls[0][0];
    expect(args.update).toEqual({ visibleIf: question.visibleIf });
    expect(Object.keys(args.update)).toEqual(["visibleIf"]);
  });

  it("is idempotent — calling twice with the same question issues the same upsert shape both times", async () => {
    const { tx, upsert } = fakeTx();
    await resolveOrCreatePosition(tx, "org-1", question);
    await resolveOrCreatePosition(tx, "org-1", question);
    expect(upsert.mock.calls[0][0]).toEqual(upsert.mock.calls[1][0]);
  });
});
