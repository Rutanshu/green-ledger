"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { computeCompleteness, type VisibilityRule } from "@/lib/visibility";
import type { UnitCode } from "@/lib/units";

const AnswerInput = z.object({
  assignmentId: z.string().min(1),
  questionId: z.string().min(1),
  value: z.coerce.number({ error: "Enter a number." }).finite().nonnegative("Quantity cannot be negative."),
  unit: z.string().min(1, "Choose a unit."),
  dataQuality: z.enum(["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"], { error: "Choose a data quality." }),
});

export type SubmitAnswerState = { ok: boolean; error?: string } | null;

export async function submitAnswer(_prev: SubmitAnswerState, formData: FormData): Promise<SubmitAnswerState> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "Not signed in." };

  const parsed = AnswerInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { assignmentId, questionId, value, unit, dataQuality } = parsed.data;

  const db = orgScopedClient(org.id);

  // Fail check: the question must exist, belong to this org (via its
  // template), and actually allow the submitted unit — a Zod string check
  // alone can't know the per-question allowed set.
  const question = await db.question.findFirst({
    where: { id: questionId, section: { template: { organizationId: org.id } } },
  });
  if (!question) return { ok: false, error: "Question not found." };
  if (question.allowedUnits.length > 0 && !question.allowedUnits.includes(unit as UnitCode)) {
    return { ok: false, error: `Unit must be one of: ${question.allowedUnits.join(", ")}.` };
  }

  // QuestionnaireAssignment has no organizationId column of its own — it's
  // scoped transitively through its site, so orgScopedClient can't enforce
  // this one automatically (see the note in lib/db/tenant.ts). Express the
  // boundary explicitly here instead of trusting an unscoped id lookup,
  // otherwise a caller could write an answer into another org's assignment
  // just by knowing its id.
  const assignment = await db.questionnaireAssignment.findFirst({
    where: { id: assignmentId, site: { organizationId: org.id } },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  const period = await db.reportingPeriod.findFirst({ where: { id: assignment.reportingPeriodId } });
  if (period?.status === "LOCKED" || period?.status === "ASSURED") {
    return { ok: false, error: `Period ${period.label} is ${period.status.toLowerCase()} — edits are refused.` };
  }

  await db.answer.upsert({
    where: { assignmentId_questionId: { assignmentId, questionId } },
    create: {
      assignmentId,
      questionId,
      valueNumeric: value,
      unit: unit as never,
      dataQuality: dataQuality as never,
      status: "ANSWERED",
      answeredAt: new Date(),
    },
    update: {
      valueNumeric: value,
      unit: unit as never,
      dataQuality: dataQuality as never,
      status: "ANSWERED",
      answeredAt: new Date(),
    },
  });

  await recomputeCompleteness(org.id, assignmentId);
  revalidatePath("/data-collection");
  revalidatePath("/");
  return { ok: true };
}

async function recomputeCompleteness(orgId: string, assignmentId: string) {
  const db = orgScopedClient(orgId);
  const assignment = await db.questionnaireAssignment.findFirst({
    where: { id: assignmentId, site: { organizationId: orgId } },
    include: {
      answers: true,
      site: { include: { assets: true } },
      period: true,
      template: { include: { sections: { include: { questions: true } } } },
    },
  });
  if (!assignment) return;

  const questions = assignment.template.sections.flatMap((s) => s.questions);
  const satisfied = new Set(assignment.answers.map((a) => a.questionId));

  const completeness = computeCompleteness(
    {
      questions: questions.map((q) => ({
        code: q.id,
        isRequired: q.isRequired,
        visibleIf: q.visibleIf as VisibilityRule | null,
      })),
      satisfied,
    },
    {
      siteType: assignment.site.siteType,
      siteCountry: assignment.site.country,
      assets: assignment.site.assets.map((a) => ({
        category: a.category,
        assetTypeCode: a.assetTypeCode,
        fuelOrMaterialCode: a.fuelOrMaterialCode,
        status: a.status,
        commissionedOn: a.commissionedOn,
        decommissionedOn: a.decommissionedOn,
      })),
      answers: {},
      periodStart: assignment.period.startsOn,
      periodEnd: assignment.period.endsOn,
    },
  );

  const status =
    completeness.pct === 0 ? "NOT_STARTED" : completeness.pct === 100 ? "IN_REVIEW" : "IN_PROGRESS";

  await db.questionnaireAssignment.update({
    where: { id: assignmentId },
    data: { completenessPct: completeness.pct, status: assignment.status === "APPROVED" ? "APPROVED" : status },
  });
}
