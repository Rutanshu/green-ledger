"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { rawPrisma } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { calculateEmissions, calculateDualBasis, type CalcInput, type CalcResult } from "@/lib/calc";
import { buildFactorCandidates } from "@/lib/db/factor-candidates";
import { projectAnswer } from "@/lib/project";
import { parseCsvRows, csvHeaders, identityMapping, applyMapping, validateRow, type ColumnMapping, type ValidationContext } from "@/lib/import";
import type { UnitCode } from "@/lib/units";
import type { FuelPropertyRecord } from "@/lib/units/fuelProperty";

type ActionState = { ok: boolean; error?: string; batchId?: string } | null;

export async function stageImport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't import data.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file." };
  const reportingPeriodId = String(formData.get("reportingPeriodId") ?? "");
  const mappingProfileId = String(formData.get("mappingProfileId") ?? "");

  const period = await db.reportingPeriod.findFirst({ where: { id: reportingPeriodId } });
  if (!period) return { ok: false, error: "Choose a reporting period." };

  const text = await file.text();
  const headers = csvHeaders(text);
  if (headers.length === 0) return { ok: false, error: "The file is empty." };

  let mapping: ColumnMapping = identityMapping(headers);
  if (mappingProfileId) {
    const profile = await db.mappingProfile.findFirst({ where: { id: mappingProfileId } });
    if (profile) mapping = profile.columnMapping as ColumnMapping;
  }

  // db (orgScopedClient), not rawPrisma — Question is only transitively
  // org-scoped (see lib/db/tenant.ts), so it needs a connection that has
  // actually set app.org_id for RLS on questionnaire_templates to let this
  // join see anything at all. A bare rawPrisma call here would silently
  // return zero questions, not an error — exactly the kind of bug this
  // comment exists to stop someone from reintroducing.
  const [sites, questions] = await Promise.all([
    db.site.findMany({ select: { code: true } }),
    db.question.findMany({
      where: { section: { template: { organizationId: org.id } } },
      select: { code: true, allowedUnits: true },
    }),
  ]);
  const ctx: ValidationContext = {
    siteCodes: new Set(sites.map((s) => s.code)),
    questions: new Map(questions.map((q) => [q.code, { allowedUnits: q.allowedUnits }])),
    periodWritable: period.status === "DRAFT" || period.status === "IN_REVIEW",
    periodLabel: period.label,
  };

  const seenLineKeys = new Set<string>();
  const stagedRows: {
    rowNumber: number;
    rawData: Record<string, string>;
    siteCode: string | null;
    questionCode: string | null;
    value: string | null;
    unit: string | null;
    dataQuality: string | null;
    status: "ACCEPTED" | "REJECTED";
    errorMessage: string | null;
  }[] = [];

  for (const { lineNumber: rowNumber, cells } of parseCsvRows(text)) {
    const mapped = applyMapping(cells, mapping);
    const result = validateRow(rowNumber, mapped, ctx, seenLineKeys);
    stagedRows.push(
      result.ok
        ? { rowNumber, rawData: cells, siteCode: result.row.siteCode, questionCode: result.row.questionCode, value: result.row.value, unit: result.row.unit, dataQuality: result.row.dataQuality, status: "ACCEPTED", errorMessage: null }
        : { rowNumber, rawData: cells, siteCode: mapped.site_code ?? null, questionCode: mapped.question_code ?? null, value: mapped.value ?? null, unit: mapped.unit ?? null, dataQuality: mapped.data_quality ?? null, status: "REJECTED", errorMessage: result.reason },
    );
  }
  if (stagedRows.length === 0) return { ok: false, error: "No data rows found." };

  const sha256 = crypto.createHash("sha256").update(text).digest("hex");
  const rowsAccepted = stagedRows.filter((r) => r.status === "ACCEPTED").length;

  const escapedOrgId = org.id.replace(/'/g, "''");
  const batch = await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);
    const created = await tx.importBatch.create({
      data: {
        organizationId: org.id,
        filename: file.name,
        sha256,
        rowCount: stagedRows.length,
        rowsAccepted,
        rowsRejected: stagedRows.length - rowsAccepted,
        status: "DRY_RUN",
        uploadedById: membership.user.id,
        reportingPeriodId,
        rows: { create: stagedRows.map((r) => ({ ...r, rawData: r.rawData as never })) },
      },
    });
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: membership.user.id,
      action: "CREATE",
      entityType: "ImportBatch",
      entityId: created.id,
      after: { filename: created.filename, rowCount: created.rowCount, rowsAccepted: created.rowsAccepted, rowsRejected: created.rowsRejected },
    });
    return created;
  });

  revalidatePath("/import");
  return { ok: true, batchId: batch.id };
}

/**
 * Writes every ACCEPTED row's PositionValue, reusing the same pure
 * lib/calc functions submitAnswer/restatement use. before* is captured
 * here (not at stage time) so revertImport restores exactly what
 * commitImport actually overwrote.
 */
export async function commitImport(batchId: string): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't commit an import.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const batch = await db.importBatch.findFirst({ where: { id: batchId }, include: { rows: { where: { status: "ACCEPTED" } } } });
  if (!batch) return { ok: false, error: "Import batch not found." };
  if (batch.status !== "DRY_RUN") return { ok: false, error: `Batch is ${batch.status.toLowerCase()}, not staged.` };

  const period = await db.reportingPeriod.findFirst({ where: { id: batch.reportingPeriodId ?? undefined } });
  if (!period) return { ok: false, error: "Reporting period no longer exists." };

  // Scoped to fuels the rows in THIS batch actually bind to — see
  // data-collection/actions.ts for why an unfiltered fetch doesn't scale.
  const batchQuestionCodes = [...new Set(batch.rows.map((r) => r.questionCode).filter((c): c is string => !!c))];
  const batchBoundQuestions = await db.question.findMany({
    where: { code: { in: batchQuestionCodes }, section: { template: { organizationId: org.id } } },
    include: { binding: true },
  });
  const batchFuelCodes = [...new Set(batchBoundQuestions.map((q) => q.binding?.fuelOrMaterialCode).filter((c): c is string => !!c))];

  const [factorSets, gwpRows, sites] = await Promise.all([
    db.emissionFactorSet.findMany({ include: { factors: { where: { fuelOrMaterialCode: { in: batchFuelCodes } } } } }),
    rawPrisma.gwpSet.findMany({ where: { name: org.defaultGwpSetId ?? "AR6" } }),
    db.site.findMany({ include: { assignments: { where: { reportingPeriodId: batch.reportingPeriodId ?? undefined } } } }),
  ]);
  const candidates = buildFactorCandidates(factorSets);
  const gwpValues = Object.fromEntries(gwpRows.map((g) => [g.gas, g.gwp100.toString()]));
  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  const escapedOrgId = org.id.replace(/'/g, "''");
  let committed = 0;
  let failed = 0;

  await rawPrisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);

      for (const row of batch.rows) {
        const site = row.siteCode ? siteByCode.get(row.siteCode) : undefined;
        const assignment = site?.assignments[0];
        const question = row.questionCode
          ? await tx.question.findFirst({ where: { code: row.questionCode, section: { template: { organizationId: org.id } } }, include: { binding: true } })
          : null;
        if (!site || !assignment || !question || !row.value || !row.unit) {
          failed++;
          await tx.importRow.update({ where: { id: row.id }, data: { status: "REJECTED", errorMessage: "No matching assignment for this site/period at commit time." } });
          continue;
        }

        // Step 2.2 Phase C: same lazy resolve-or-create as submitAnswer.
        const position = await tx.position.upsert({
          where: { organizationId_positionCode: { organizationId: org.id, positionCode: question.code } },
          create: {
            organizationId: org.id,
            positionCode: question.code,
            labelKey: question.label,
            type: question.inputType === "INDICATOR" ? "INDICATOR" : "FLOW",
            dimension: question.unitDimension,
            allowedUnits: question.allowedUnits,
          },
          update: {},
        });
        const positionValueKey = {
          positionId_siteId_reportingPeriodId_line: { positionId: position.id, siteId: site.id, reportingPeriodId: assignment.reportingPeriodId, line: 1 },
        } as const;
        const beforePositionValue = await tx.positionValue.findUnique({ where: positionValueKey });
        const positionValue = await tx.positionValue.upsert({
          where: positionValueKey,
          create: { positionId: position.id, siteId: site.id, reportingPeriodId: assignment.reportingPeriodId, line: 1, valueNumeric: row.value, unit: row.unit as never, dataQuality: row.dataQuality as never, status: "ANSWERED", answeredAt: new Date() },
          update: { valueNumeric: row.value, unit: row.unit as never, dataQuality: row.dataQuality as never, status: "ANSWERED", answeredAt: new Date() },
        });
        await tx.importRow.update({
          where: { id: row.id },
          data: {
            positionValueId: positionValue.id,
            beforeValue: beforePositionValue?.valueNumeric ?? null,
            beforeUnit: beforePositionValue?.unit ?? null,
            beforeDataQuality: beforePositionValue?.dataQuality ?? null,
          },
        });
        await recordAudit(tx, {
          organizationId: org.id,
          actorUserId: membership.user.id,
          action: "IMPORT",
          entityType: "PositionValue",
          entityId: positionValue.id,
          before: beforePositionValue,
          after: positionValue,
        });

        const binding = question.binding;
        if (binding) {
          const fuelPropertyRows = await tx.fuelProperty.findMany({ where: { fuelCode: binding.fuelOrMaterialCode } });
          const fuelProperties: FuelPropertyRecord[] = fuelPropertyRows.map((p) => ({
            fuelCode: p.fuelCode, property: p.property, value: p.value.toString(),
            fromUnit: p.fromUnit as UnitCode, toUnit: p.toUnit as UnitCode, source: p.source, validFrom: p.validFrom, validTo: p.validTo,
          }));
          const projected = projectAnswer({
            answer: { valueNumeric: row.value, unit: row.unit as UnitCode, dataQuality: row.dataQuality as never },
            binding,
            periodStart: period.startsOn,
            periodEnd: period.endsOn,
          });
          const beforeActivity = await tx.activityRecord.findFirst({ where: { positionValueId: positionValue.id } });
          const activityData = {
            organizationId: org.id, siteId: site.id, reportingPeriodId: assignment.reportingPeriodId,
            positionValueId: positionValue.id, importBatchId: batchId, ...projected, status: "SUBMITTED" as const,
          };
          const activityRecord = beforeActivity
            ? await tx.activityRecord.update({ where: { id: beforeActivity.id }, data: activityData })
            : await tx.activityRecord.create({ data: activityData });

          const calcInput: Omit<CalcInput, "query"> & { query: Omit<CalcInput["query"], "on"> } = {
            activity: { quantity: projected.quantity, unit: projected.unit, activityStart: projected.activityStart, activityEnd: projected.activityEnd },
            candidates, fuelProperties,
            query: {
              activityType: binding.activityType, method: binding.method, fuelOrMaterialCode: binding.fuelOrMaterialCode,
              regionStrategy: binding.regionStrategy, fixedRegion: binding.fixedRegion, siteCountry: site.country, siteGridRegion: site.gridRegion,
            },
            gwpValues, gwpSetName: org.defaultGwpSetId ?? "AR6", consolidationShare: "1", multiplier: binding.multiplier.toString(),
          };
          let emissionResults: CalcResult[] = [];
          try {
            emissionResults = binding.outputBasis === "DUAL"
              ? [...calculateDualBasis(calcInput).locationBased, ...calculateDualBasis(calcInput).marketBased]
              : calculateEmissions(calcInput);
          } catch {
            emissionResults = [];
          }
          await tx.emissionRecord.deleteMany({ where: { activityRecordId: activityRecord.id } });
          if (emissionResults.length > 0) {
            await tx.emissionRecord.createMany({
              data: emissionResults.map((r) => ({
                activityRecordId: activityRecord.id, basis: r.basis, gas: r.gas as never,
                quantityNormalised: r.quantityNormalised.toString(), unitNormalised: r.unitNormalised as never,
                unitConversionFactor: r.unitConversionFactor.toString(), unitBridgedVia: r.unitBridgedVia,
                factorId: r.factorId, factorValue: r.factorValue.toString(),
                factorUnitNumerator: r.factorUnitNumerator as never, factorUnitDenominator: r.factorUnitDenominator as never,
                factorSource: r.factorSource, factorVersion: r.factorVersion, factorValidFrom: r.factorValidFrom, factorValidTo: r.factorValidTo,
                gwpValue: r.gwpValue.toString(), gwpSet: r.gwpSet, consolidationShare: r.consolidationShare.toString(),
                daysCovered: r.daysCovered, daysTotal: r.daysTotal, emissionsKgCo2e: r.emissionsKgCo2e.toString(), calcEngineVersion: r.calcEngineVersion,
              })),
            });
          }
        }
        committed++;
      }

      const updated = await tx.importBatch.update({
        where: { id: batchId },
        data: { status: "COMMITTED", rowsAccepted: committed, rowsRejected: batch.rowCount - committed },
      });
      await recordAudit(tx, {
        organizationId: org.id, actorUserId: membership.user.id, action: "IMPORT",
        entityType: "ImportBatch", entityId: batchId, after: updated,
      });
    },
    { timeout: 30000, maxWait: 10000 },
  );

  revalidatePath("/import");
  revalidatePath("/data-collection");
  return { ok: true, batchId };
}

/**
 * Only for a COMMITTED batch. Restores each row's PositionValue to its
 * before-commit value (or deletes it, if the row created a new value
 * rather than overwriting one — beforeValue null means exactly that, since
 * a real PositionValue is never written with a null value by any path in
 * this app). Deletes the calc lineage this batch created.
 */
export async function revertImport(batchId: string): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) {
    return { ok: false, error: `Your role (${ROLE_LABEL[membership.role]}) can't revert an import.` };
  }
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const batch = await db.importBatch.findFirst({ where: { id: batchId }, include: { rows: { where: { positionValueId: { not: null } } } } });
  if (!batch) return { ok: false, error: "Import batch not found." };
  if (batch.status !== "COMMITTED") return { ok: false, error: `Batch is ${batch.status.toLowerCase()}, not committed.` };

  const escapedOrgId = org.id.replace(/'/g, "''");
  await rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.org_id = '${escapedOrgId}'`);

    await tx.emissionRecord.deleteMany({ where: { activityRecord: { importBatchId: batchId } } });
    await tx.activityRecord.deleteMany({ where: { importBatchId: batchId } });

    for (const row of batch.rows) {
      if (!row.positionValueId) continue;
      if (row.beforeValue === null) {
        await tx.positionValue.delete({ where: { id: row.positionValueId } }).catch(() => null);
      } else {
        await tx.positionValue.update({
          where: { id: row.positionValueId },
          data: { valueNumeric: row.beforeValue, unit: row.beforeUnit, dataQuality: row.beforeDataQuality },
        });
      }
    }

    const updated = await tx.importBatch.update({ where: { id: batchId }, data: { status: "REVERTED" } });
    await recordAudit(tx, {
      organizationId: org.id, actorUserId: membership.user.id, action: "DELETE",
      entityType: "ImportBatch", entityId: batchId, after: updated,
    });
  }, { timeout: 20000, maxWait: 10000 });

  revalidatePath("/import");
  revalidatePath("/data-collection");
  return { ok: true };
}

const MappingProfileInput = z.object({ name: z.string().min(1), columnMapping: z.string().min(1) });

export async function saveMappingProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Not signed in." };
  if (!can(membership.role, "submit_answers")) return { ok: false, error: "Not permitted." };
  const parsed = MappingProfileInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  let columnMapping: unknown;
  try {
    columnMapping = JSON.parse(parsed.data.columnMapping);
  } catch {
    return { ok: false, error: "Column mapping must be valid JSON." };
  }

  const db = orgScopedClient(membership.org.id);
  await db.mappingProfile.upsert({
    where: { organizationId_name: { organizationId: membership.org.id, name: parsed.data.name } },
    create: { organizationId: membership.org.id, name: parsed.data.name, columnMapping: columnMapping as never },
    update: { columnMapping: columnMapping as never },
  });

  revalidatePath("/import");
  return { ok: true };
}
