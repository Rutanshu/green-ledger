/**
 * Row validation. BUILD_PLAN Step 3.5: "per row: unknown code, unit not
 * allowed, period closed or locked, duplicate line, type error — each
 * with row number and human-readable reason." Two of the spec's seven
 * checks are deliberately out of scope here: "rule failure" (would need
 * the full Rule/RuleViolation evaluation context per row, not just this
 * row's own fields — a heavier integration than this pass covers) and
 * "overwrite conflict" (importing is EXPECTED to overwrite an existing
 * answer — see ImportRow.before* in the schema — so there's no conflict
 * to detect; optimistic concurrency doesn't apply the same way to a
 * scheduled bulk load as to two people editing the same field live).
 *
 * PURE MODULE — no Prisma. The caller resolves site/question/period state
 * once and passes it in as plain data.
 */
import type { MappedRow } from "./mapping";

export interface ValidationContext {
  siteCodes: ReadonlySet<string>;
  questions: ReadonlyMap<string, { allowedUnits: readonly string[] }>;
  periodWritable: boolean;
  periodLabel: string;
}

export interface ValidRow {
  rowNumber: number;
  siteCode: string;
  questionCode: string;
  value: string;
  unit: string;
  dataQuality: string;
}

export type RowValidationResult = { ok: true; row: ValidRow } | { ok: false; rowNumber: number; reason: string };

const VALID_DATA_QUALITIES = new Set(["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"]);

export function validateRow(rowNumber: number, mapped: MappedRow, ctx: ValidationContext, seenLineKeys: Set<string>): RowValidationResult {
  const { site_code: siteCode, question_code: questionCode, value, unit, data_quality: dataQuality } = mapped;

  if (!siteCode) return { ok: false, rowNumber, reason: "missing site_code" };
  if (!questionCode) return { ok: false, rowNumber, reason: "missing question_code" };
  if (!value) return { ok: false, rowNumber, reason: "missing value" };
  if (!unit) return { ok: false, rowNumber, reason: "missing unit" };

  if (!ctx.periodWritable) return { ok: false, rowNumber, reason: `period ${ctx.periodLabel} is locked` };
  if (!ctx.siteCodes.has(siteCode)) return { ok: false, rowNumber, reason: `unknown site_code "${siteCode}"` };

  const question = ctx.questions.get(questionCode);
  if (!question) return { ok: false, rowNumber, reason: `unknown question_code "${questionCode}"` };
  if (!question.allowedUnits.includes(unit)) {
    return { ok: false, rowNumber, reason: `unit "${unit}" not allowed for ${questionCode} (allowed: ${question.allowedUnits.join(", ")})` };
  }

  if (!/^-?\d+(\.\d+)?$/.test(value)) return { ok: false, rowNumber, reason: `"${value}" is not a number` };
  if (Number(value) < 0) return { ok: false, rowNumber, reason: "value cannot be negative" };

  const resolvedQuality = dataQuality || "ESTIMATED";
  if (!VALID_DATA_QUALITIES.has(resolvedQuality)) {
    return { ok: false, rowNumber, reason: `data_quality "${resolvedQuality}" must be one of ${[...VALID_DATA_QUALITIES].join(", ")}` };
  }

  const lineKey = `${siteCode}:${questionCode}`;
  if (seenLineKeys.has(lineKey)) return { ok: false, rowNumber, reason: `duplicate line — ${lineKey} already appears earlier in this file` };
  seenLineKeys.add(lineKey);

  return { ok: true, row: { rowNumber, siteCode, questionCode, value, unit, dataQuality: resolvedQuality } };
}
