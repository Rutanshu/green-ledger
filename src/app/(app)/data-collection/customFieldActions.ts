"use server";

import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";

/**
 * Saves whatever custom-field inputs are present in the same FormData an
 * answer was just submitted with. Deliberately a SEPARATE action from
 * submitAnswer (data-collection/actions.ts), not folded into its already
 * complex, heavily-tested transaction (calc pipeline, four-eyes, rules,
 * completeness) — CustomFieldValue is independent of the calculation
 * path entirely, so there's no reason to share a transaction with it.
 * Called from the client alongside submitAnswer (see AnswerRow.tsx).
 *
 * CustomFieldValue isn't in tenant.ts's STRICT_ORG_MODELS (same reason
 * PositionValue isn't — it's scoped transitively through position/site/
 * period, not a direct organizationId column), so this reads its own
 * ids from already org-scoped lookups first, same pattern submitAnswer
 * itself uses for positionValue.upsert.
 */
export async function saveCustomFieldValues(formData: FormData): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership) return;
  if (!can(membership.role, "submit_answers")) return;
  const org = membership.org;
  const db = orgScopedClient(org.id);

  const assignmentId = formData.get("assignmentId");
  const questionId = formData.get("questionId");
  if (typeof assignmentId !== "string" || typeof questionId !== "string") return;

  const [assignment, question] = await Promise.all([
    db.questionnaireAssignment.findFirst({ where: { id: assignmentId } }),
    db.question.findFirst({ where: { id: questionId } }),
  ]);
  if (!assignment || !question) return;

  const position = await db.position.findFirst({ where: { organizationId: org.id, positionCode: question.code } });
  if (!position) return;

  const definitions = await db.customFieldDefinition.findMany({
    where: { organizationId: org.id, OR: [{ positionId: position.id }, { positionId: null }] },
  });

  for (const def of definitions) {
    const raw = formData.get(`customField_${def.id}`);
    if (raw === null) continue;
    const text = raw.toString().trim();
    if (!text) continue; // blank = not answering this one right now, don't create an empty row

    const valueText = def.fieldType === "TEXT" || def.fieldType === "SELECT" ? text : null;
    const valueNumeric = def.fieldType === "NUMBER" ? text : null;
    const valueDate = def.fieldType === "DATE" ? new Date(text) : null;

    await db.customFieldValue.upsert({
      where: {
        customFieldDefinitionId_siteId_reportingPeriodId_line: {
          customFieldDefinitionId: def.id,
          siteId: assignment.siteId,
          reportingPeriodId: assignment.reportingPeriodId,
          line: 1,
        },
      },
      create: {
        customFieldDefinitionId: def.id,
        positionId: position.id,
        siteId: assignment.siteId,
        reportingPeriodId: assignment.reportingPeriodId,
        line: 1,
        valueText,
        valueNumeric: valueNumeric as never,
        valueDate,
      },
      update: { valueText, valueNumeric: valueNumeric as never, valueDate },
    });
  }
}
