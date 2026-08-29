/**
 * Question -> Position resolve-or-create. Phase B of the Position-
 * migration cleanup (see /Users/rutanshu/.claude/plans/imperative-
 * coalescing-hollerith.md). Previously duplicated near-identically in
 * data-collection/actions.ts, periods/actions.ts, and import/actions.ts
 * — same upsert, but only the standalone prisma/migrate-questions-to-
 * positions.ts script copied `visibleIf` onto the Position, so a
 * question answered through the app (rather than backfilled by the
 * script) could get a Position that's universally visible regardless of
 * the site-asset gating its source Question actually had. One helper,
 * used everywhere a Position needs to exist for a given Question.
 *
 * `update` intentionally only touches `visibleIf` on conflict, matching
 * the migration script's own behavior — every other field is set once,
 * at first creation, and never overwritten by this lazy path.
 */

interface PositionUpsertClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  position: { upsert: (args: any) => Promise<{ id: string }> };
}

export interface QuestionLike {
  code: string;
  label: string;
  inputType: string;
  unitDimension: string | null;
  allowedUnits: string[];
  visibleIf?: unknown;
}

export async function resolveOrCreatePosition(
  tx: PositionUpsertClient,
  organizationId: string,
  question: QuestionLike,
): Promise<{ id: string }> {
  const visibleIf = (question.visibleIf ?? null) as never;
  return tx.position.upsert({
    where: { organizationId_positionCode: { organizationId, positionCode: question.code } },
    create: {
      organizationId,
      positionCode: question.code,
      labelKey: question.label,
      type: question.inputType === "INDICATOR" ? "INDICATOR" : "FLOW",
      dimension: question.unitDimension,
      allowedUnits: question.allowedUnits,
      visibleIf,
    },
    update: { visibleIf },
  });
}
