/**
 * One-off data migration: Question/Answer -> Position/PositionValue.
 * BUILD_PLAN Step 2.2, Phase A.4 of the approved rearchitecture plan.
 *
 * NOT wired into CI or `db:migrate` — run manually via `npx tsx
 * prisma/migrate-questions-to-positions.ts`. Additive only: never touches
 * Question/Answer, only reads them to populate the new Position/
 * PositionValue/PositionAssetValue tables (Phase A adds those tables but
 * nothing in the live app reads them yet).
 *
 * One Position per distinct (organizationId, Question.code). A code that
 * appears with a different inputType/unitDimension across two templates in
 * the same org is a genuine conflict — reported, not guessed at, and that
 * code's Position/PositionValues are skipped entirely.
 */
import { adminPrisma } from "../src/lib/db/admin-client";
import { parseFormula, FormulaSyntaxError } from "../src/lib/formula";

async function main() {
  const questions = await adminPrisma.question.findMany({
    include: { section: { include: { template: true } } },
  });

  type QuestionKey = string; // `${organizationId}:${code}`
  const byKey = new Map<QuestionKey, typeof questions>();
  for (const q of questions) {
    const orgId = q.section.template.organizationId;
    const key = `${orgId}:${q.code}`;
    byKey.set(key, [...(byKey.get(key) ?? []), q]);
  }

  const conflicts: string[] = [];
  const positionIdByQuestionId = new Map<string, string>();
  let createdPositions = 0;

  for (const [key, group] of byKey) {
    const [orgId, code] = key.split(":");
    const first = group[0];
    const differs = group.some((q) => q.inputType !== first.inputType || q.unitDimension !== first.unitDimension);
    if (differs) {
      conflicts.push(`${code} (org ${orgId}): differing inputType/unitDimension across templates — skipped, resolve by hand.`);
      continue;
    }

    const type = first.inputType === "INDICATOR" ? "INDICATOR" : "FLOW";
    let formulaAst: unknown = null;
    if (first.inputType === "INDICATOR" && first.formula) {
      try {
        formulaAst = parseFormula(first.formula);
      } catch (e) {
        if (e instanceof FormulaSyntaxError) {
          conflicts.push(`${code} (org ${orgId}): formula failed to re-parse (${e.message}) — Position created with null formulaAst, needs manual fix.`);
        } else {
          throw e;
        }
      }
    }

    const position = await adminPrisma.position.upsert({
      where: { organizationId_positionCode: { organizationId: orgId, positionCode: code } },
      create: {
        organizationId: orgId,
        positionCode: code,
        labelKey: first.label,
        type,
        dimension: first.unitDimension,
        allowedUnits: first.allowedUnits,
        formulaAst: formulaAst === null ? undefined : (formulaAst as never),
        tags: [],
      },
      update: {},
    });
    createdPositions++;
    for (const q of group) positionIdByQuestionId.set(q.id, position.id);
  }

  const answers = await adminPrisma.answer.findMany({ include: { assignment: true } });
  let createdValues = 0;
  let skippedNoPosition = 0;
  for (const a of answers) {
    const positionId = positionIdByQuestionId.get(a.questionId);
    if (!positionId) {
      skippedNoPosition++;
      continue;
    }
    await adminPrisma.positionValue.upsert({
      where: {
        positionId_siteId_reportingPeriodId_line: {
          positionId,
          siteId: a.assignment.siteId,
          reportingPeriodId: a.assignment.reportingPeriodId,
          line: 1,
        },
      },
      create: {
        positionId,
        siteId: a.assignment.siteId,
        reportingPeriodId: a.assignment.reportingPeriodId,
        line: 1,
        valueNumeric: a.valueNumeric,
        valueText: a.valueText,
        valueJson: a.valueJson ?? undefined,
        unit: a.unit,
        dataQuality: a.dataQuality,
        isNotApplicable: a.isNotApplicable,
        naReason: a.naReason,
        status: a.status,
        answeredById: a.answeredById,
        answeredAt: a.answeredAt,
        documentIds: a.documentIds,
        comment: a.comment,
        priorPeriodValue: a.priorPeriodValue,
      },
      update: {},
    });
    createdValues++;
  }

  const [positionCount, valueCount, questionCount, answerCount] = await Promise.all([
    adminPrisma.position.count(),
    adminPrisma.positionValue.count(),
    adminPrisma.question.count(),
    adminPrisma.answer.count(),
  ]);

  console.log(`Questions: ${questionCount} -> Positions: ${positionCount} (${createdPositions} upserted this run)`);
  console.log(`Answers: ${answerCount} -> PositionValues: ${valueCount} (${createdValues} upserted, ${skippedNoPosition} skipped — no Position, see conflicts)`);
  if (conflicts.length > 0) {
    console.log(`\n${conflicts.length} conflict(s) — resolve by hand, re-run after:`);
    for (const c of conflicts) console.log(`  - ${c}`);
  } else {
    console.log("\nNo conflicts.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => adminPrisma.$disconnect());
