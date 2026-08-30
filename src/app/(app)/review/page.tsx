import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Label, labelText } from "@/components/Label";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";
import { CalculationBreakdown } from "@/components/CalculationBreakdown";
import { AssignmentWorkflow } from "../data-collection/AssignmentWorkflow";
import { RuleViolationsPanel } from "../data-collection/RuleViolationsPanel";
import { getPeriodReadinessAction } from "../periods/actions";
import { CorrectionRequestForm } from "./CorrectionRequestForm";
import { UnlockPositionValueForm } from "./UnlockPositionValueForm";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canApprove = can(membership.role, "manage_questionnaire");
  if (!canApprove) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);
  const labelOverrides = await getOrgLabelOverrides(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      // APPROVED stays visible here too — not for the approve action (AssignmentWorkflow
      // shows nothing once approved) but so a manager can unlock an individual locked
      // answer without having to hunt through Overview/Progress for it.
      assignments: {
        where: { status: { in: ["IN_REVIEW", "APPROVED"] } },
        include: { template: { include: { sections: { include: { questions: true } } } }, period: true },
      },
    },
  });
  const inReview = sites.filter((s) => s.assignments.length > 0);
  const waitingCount = inReview.filter((s) => s.assignments[0].status === "IN_REVIEW").length;
  const lockedCount = inReview.length - waitingCount;

  const positionValues = await db.positionValue.findMany({
    where: { siteId: { in: inReview.map((s) => s.id) } },
    include: { position: true, activityRecords: { include: { emissionRecords: true } } },
  });
  const valueByKey = new Map(
    positionValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]),
  );

  const openCorrections = await db.correctionRequest.findMany({
    where: { positionValueId: { in: positionValues.map((v) => v.id) }, status: "OPEN" },
  });
  const correctionByPositionValueId = new Map(openCorrections.map((c) => [c.positionValueId, c]));

  const assignmentIds = inReview.flatMap((s) => s.assignments.map((a) => a.id));
  const ruleViolations = await db.ruleViolation.findMany({
    where: { assignmentId: { in: assignmentIds } },
    include: { rule: true },
    orderBy: { createdAt: "asc" },
  });
  const violationsByAssignment = new Map<string, typeof ruleViolations>();
  for (const v of ruleViolations) {
    if (!v.assignmentId) continue;
    violationsByAssignment.set(v.assignmentId, [...(violationsByAssignment.get(v.assignmentId) ?? []), v]);
  }

  // A shortcut, not a duplicate control: locking is a whole-period action
  // (every facility, not just the ones on this page) gated on manage_org,
  // a level up from manage_questionnaire — Review Data can only tell you
  // it's ready and point at Periods, not lock it itself.
  const periodsById = new Map(inReview.map((s) => [s.assignments[0].period.id, s.assignments[0].period.label]));
  const readinessByPeriod = new Map(
    await Promise.all(
      [...periodsById.entries()].map(async ([periodId, label]) => {
        const readiness = await getPeriodReadinessAction(periodId);
        return [periodId, { label, readiness }] as const;
      }),
    ),
  );
  const readyToLock = [...readinessByPeriod.values()].filter((r) => r.readiness?.ready);

  return (
    <>
      <h1 className="text-xl font-semibold">Review Data</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {inReview.length === 0
          ? "Nothing waiting on you right now."
          : waitingCount === 0
            ? `${lockedCount} facilit${lockedCount === 1 ? "y" : "ies"} approved and locked.`
            : `${waitingCount} facilit${waitingCount === 1 ? "y" : "ies"} submitted, waiting on your review${lockedCount > 0 ? ` · ${lockedCount} approved and locked` : ""}.`}
      </p>

      {readyToLock.map((r) => (
        <Link
          key={r.label}
          href="/periods"
          className="mt-3 flex items-center gap-2.5 rounded-[11px] border border-good/30 bg-good/10 px-4 py-2.5 text-[13px] font-medium text-good hover:bg-good/15"
        >
          <LockKeyhole className="h-4 w-4 shrink-0" />
          Every facility for {r.label} is approved, with no open flags or broken bindings — ready to lock in Periods →
        </Link>
      ))}

      <div className="mt-5 flex flex-col gap-4">
        {inReview.map((site) => {
          const assignment = site.assignments[0];
          const questions = assignment.template.sections.flatMap((s) => s.questions).filter((q) => q.allowedUnits.length > 0);
          const isOwnSubmission = assignment.submittedById === membership.user.id;

          return (
            <div key={site.id} className="rounded-[11px] glass">
              <div className="flex items-start justify-between gap-3 border-b border-grid p-4">
                <div>
                  <div className="font-semibold">
                    {site.name} <span className="font-normal text-muted">({site.code})</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink2">
                    {assignment.period.label} · <Label entityKind="STATUS" code={assignment.status} overrides={labelOverrides} />
                  </div>
                </div>
                <AssignmentWorkflow
                  assignmentId={assignment.id}
                  status={assignment.status}
                  completenessPct={Number(assignment.completenessPct)}
                  canSubmit={false}
                  canApprove={canApprove}
                  isOwnSubmission={isOwnSubmission}
                />
              </div>

              <div className="divide-y divide-grid">
                {questions.map((q) => {
                  const v = valueByKey.get(`${site.id}:${assignment.reportingPeriodId}:${q.code}`);
                  if (!v || v.status === "UNANSWERED" || v.status === "DRAFT") return null;
                  const emissionRecords = v.activityRecords.flatMap((ar) => ar.emissionRecords);
                  const primary = emissionRecords[0];
                  const openCorrection = correctionByPositionValueId.get(v.id);

                  return (
                    <div key={q.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-medium">{formatQuestionLabel(q.label, assignment.period.label)}</div>
                          <div className="mt-0.5 text-[13px] text-ink2">
                            {v.valueNumeric?.toString()} {v.unit} · {labelText("DATA_QUALITY", v.dataQuality ?? "ESTIMATED", labelOverrides)}
                          </div>
                        </div>
                        {v.status === "APPROVED" ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              approved — locked
                            </span>
                            {canApprove && <UnlockPositionValueForm positionValueId={v.id} />}
                          </div>
                        ) : v.status === "FLAGGED" && openCorrection ? (
                          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            sent back: {openCorrection.note}
                          </span>
                        ) : (
                          <CorrectionRequestForm positionValueId={v.id} />
                        )}
                      </div>
                      {primary && (
                        <div className="mt-2.5">
                          <CalculationBreakdown
                            record={{
                              quantityNormalised: primary.quantityNormalised.toString(),
                              unitNormalised: primary.unitNormalised,
                              factorValue: primary.factorValue.toString(),
                              factorUnitNumerator: primary.factorUnitNumerator,
                              factorUnitDenominator: primary.factorUnitDenominator,
                              factorSource: primary.factorSource,
                              factorVersion: primary.factorVersion,
                              gwpValue: primary.gwpValue.toString(),
                              gwpSet: primary.gwpSet,
                              emissionsKgCo2e: primary.emissionsKgCo2e.toString(),
                              calcEngineVersion: primary.calcEngineVersion,
                              calculatedAt: primary.calculatedAt.toISOString(),
                            }}
                            labelOverrides={labelOverrides}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
            </div>
          );
        })}
      </div>
    </>
  );
}
