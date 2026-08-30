import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Label } from "@/components/Label";
import { AnswerRow } from "./AnswerRow";
import { evaluateIndicators, EVAL_REASON_LABEL } from "./indicators";
import { RestatementForm } from "./RestatementForm";
import { AssignmentWorkflow } from "./AssignmentWorkflow";
import { RuleViolationsPanel } from "./RuleViolationsPanel";
import { CollapsibleSite } from "./CollapsibleSite";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";

export const dynamic = "force-dynamic";

export default async function DataCollectionPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const org = membership.org;
  const canEdit = can(membership.role, "submit_answers");
  const canApprove = can(membership.role, "manage_questionnaire");
  const db = orgScopedClient(org.id);
  const labelOverrides = await getOrgLabelOverrides(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      assignments: {
        include: {
          template: { include: { sections: { include: { questions: true } } } },
          period: true,
        },
      },
    },
  });

  // Step 2.2 Phase C: values now live in PositionValue, keyed by (site,
  // period), not on the assignment — one batched fetch for every site
  // rendered on this page, looked up per question by matching position
  // code below.
  const positionValues = await db.positionValue.findMany({
    where: { siteId: { in: sites.map((s) => s.id) } },
    include: { position: true, activityRecords: { include: { emissionRecords: true } } },
  });
  const valueByKey = new Map(positionValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]));

  // Custom fields: org-wide defs (each either "floating" — offered on
  // every position — or scoped to one), joined here by position code
  // since Question and Position share the same code space. Existing
  // values keyed the same way positionValues are above.
  const [allPositions, customFieldDefs, customFieldValues] = await Promise.all([
    db.position.findMany({ select: { id: true, positionCode: true } }),
    db.customFieldDefinition.findMany({ orderBy: { sortOrder: "asc" } }),
    db.customFieldValue.findMany({ where: { siteId: { in: sites.map((s) => s.id) } } }),
  ]);
  const positionIdByCode = new Map(allPositions.map((p) => [p.positionCode, p.id]));
  const customFieldValueByKey = new Map(
    customFieldValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.customFieldDefinitionId}`, v]),
  );

  const ruleViolations = await db.ruleViolation.findMany({
    where: { assignmentId: { in: sites.flatMap((s) => s.assignments.map((a) => a.id)) } },
    include: { rule: true },
    orderBy: { createdAt: "asc" },
  });
  const violationsByAssignment = new Map<string, typeof ruleViolations>();
  for (const v of ruleViolations) {
    if (!v.assignmentId) continue;
    violationsByAssignment.set(v.assignmentId, [...(violationsByAssignment.get(v.assignmentId) ?? []), v]);
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Data Collection</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {canEdit ? (
          "Live — edit a value and save. Your progress updates the moment you save, no need to refresh."
        ) : (
          "Read-only for your role — you can see every answer, but editing is off."
        )}
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {sites.map((site) => {
          // A facility now holds up to 17 assignments — one per scope
          // template — instead of one omnibus assignment. The outer card
          // rolls that up into a single summary line; each assignment gets
          // its own nested card with its own question table and its own
          // submit/approve controls.
          const assignments = site.assignments;
          const approvedCount = assignments.filter((a) => a.status === "APPROVED" || a.status === "LOCKED").length;
          const avgCompleteness =
            assignments.length === 0 ? 0 : assignments.reduce((sum, a) => sum + Number(a.completenessPct), 0) / assignments.length;

          return (
            <CollapsibleSite
              key={site.id}
              name={site.name}
              code={site.code}
              status={
                assignments.length > 0 && (
                  <>
                    {approvedCount} of {assignments.length} scopes approved · {Math.round(avgCompleteness)}% avg. complete
                  </>
                )
              }
            >
              {assignments.length === 0 ? (
                <p className="p-4 text-[13px] text-muted">No assignment for this site.</p>
              ) : (
                <div className="flex flex-col gap-2.5 p-3">
                  {assignments.map((assignment) => {
                    const allQuestions = assignment.template.sections.flatMap((s) => s.questions);
                    const valueByQuestionCode = (code: string) => valueByKey.get(`${site.id}:${assignment.reportingPeriodId}:${code}`);
                    const numericQuestions = allQuestions.filter((q) => q.allowedUnits.length > 0);
                    const indicatorQuestions = allQuestions.filter((q) => q.inputType === "INDICATOR");
                    const otherQuestions = allQuestions.filter((q) => q.allowedUnits.length === 0 && q.inputType !== "INDICATOR");
                    const indicatorResults = evaluateIndicators(allQuestions, valueByQuestionCode, site);

                    return (
                      <CollapsibleSite
                        key={assignment.id}
                        compact
                        name={assignment.template.name}
                        status={
                          <>
                            <Label entityKind="STATUS" code={assignment.status} overrides={labelOverrides} /> ·{" "}
                            {assignment.completenessPct.toString()}% complete
                          </>
                        }
                        workflow={
                          <AssignmentWorkflow
                            assignmentId={assignment.id}
                            status={assignment.status}
                            completenessPct={Number(assignment.completenessPct)}
                            canSubmit={canEdit}
                            canApprove={canApprove}
                            isOwnSubmission={assignment.submittedById === membership.user.id}
                          />
                        }
                      >
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                              <th className="px-4 py-2">Question</th>
                              <th className="px-4 py-2">Emissions</th>
                              <th className="px-4 py-2">Answer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {numericQuestions.map((q) => {
                              const v = valueByQuestionCode(q.code);
                              const emissionRecords = v?.activityRecords.flatMap((ar) => ar.emissionRecords) ?? [];
                              const totalKg = emissionRecords.reduce((sum, r) => sum + Number(r.emissionsKgCo2e), 0);
                              const positionId = positionIdByCode.get(q.code);
                              const applicableCustomFields = customFieldDefs
                                .filter((f) => f.positionId === null || f.positionId === positionId)
                                .map((f) => {
                                  const existingValue = customFieldValueByKey.get(`${site.id}:${assignment.reportingPeriodId}:${f.id}`);
                                  return {
                                    id: f.id,
                                    label: f.label,
                                    fieldType: f.fieldType,
                                    options: (f.options as { code: string; label: string }[] | null) ?? [],
                                    isRequired: f.isRequired,
                                    existingValue: existingValue?.valueText ?? existingValue?.valueNumeric?.toString() ?? existingValue?.valueDate?.toISOString().slice(0, 10) ?? "",
                                  };
                                });
                              return (
                                <AnswerRow
                                  key={q.id}
                                  assignmentId={assignment.id}
                                  questionId={q.id}
                                  code={q.code}
                                  allowedUnits={q.allowedUnits}
                                  existing={v ? { value: v.valueNumeric?.toString() ?? "", unit: v.unit ?? "", quality: v.dataQuality ?? "ESTIMATED", updatedAt: v.updatedAt.toISOString(), comment: v.comment ?? "" } : null}
                                  existingEmissionsKg={emissionRecords.length > 0 ? totalKg.toString() : null}
                                  canEdit={canEdit}
                                  labelOverrides={labelOverrides}
                                  customFields={applicableCustomFields}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                        {indicatorQuestions.length > 0 && (
                          <table className="w-full border-t border-grid text-[13px]">
                            <thead>
                              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                                <th className="px-4 py-2">Indicator (computed)</th>
                                <th className="px-4 py-2">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {indicatorQuestions.map((q) => {
                                const result = indicatorResults.get(q.code);
                                return (
                                  <tr key={q.id} className="border-t border-grid/60">
                                    <td className="px-4 py-2 align-top">
                                      <div className="font-medium">{formatQuestionLabel(q.label, assignment.period.label)}</div>
                                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted">
                                        <span className="font-mono">{q.code}</span>
                                        {q.computedDimension && <span>· {q.computedDimension}</span>}
                                      </div>
                                      {q.formula && (
                                        <div className="mt-1 rounded bg-track px-2 py-1 font-mono text-[11px] text-ink2">{q.formula}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 align-top">
                                      {!result ? (
                                        <span className="text-xs text-muted">not evaluated</span>
                                      ) : result.reason ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                          {EVAL_REASON_LABEL[result.reason] ?? result.reason}
                                          {result.position ? ` (${result.position})` : ""}
                                        </span>
                                      ) : (
                                        <span className="font-mono">{result.value.toDecimalPlaces(6).toString()}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        {otherQuestions.length > 0 && (
                          <div className="border-t border-grid p-4 text-xs text-muted">
                            {otherQuestions.length} boolean/conditional question(s) not editable in this demo (
                            {otherQuestions.map((q) => q.code).join(", ")}).
                          </div>
                        )}
                        <RuleViolationsPanel
                          violations={(violationsByAssignment.get(assignment.id) ?? []).map((v) => ({
                            id: v.id,
                            ruleName: v.rule.name,
                            message: v.message,
                            questionCode: v.questionCode,
                            status: v.status,
                            acknowledgementComment: v.acknowledgementComment,
                          }))}
                        />
                        {canEdit && (assignment.period.status === "LOCKED" || assignment.period.status === "ASSURED") && (
                          <div className="border-t border-grid p-4">
                            <p className="text-xs text-ink2">
                              {assignment.period.label} is {assignment.period.status.toLowerCase()} — direct edits are refused. Request a
                              restatement instead; it applies only once a different person approves it.
                            </p>
                            <RestatementForm
                              assignmentId={assignment.id}
                              questions={numericQuestions.map((q) => ({ id: q.id, code: q.code, allowedUnits: q.allowedUnits }))}
                            />
                          </div>
                        )}
                      </CollapsibleSite>
                    );
                  })}
                </div>
              )}
            </CollapsibleSite>
          );
        })}
      </div>
    </>
  );
}
