import Link from "next/link";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";
import { evaluateVisibility, type VisibilityRule, type VisibilityAsset } from "@/lib/visibility";
import { Denied } from "../_components/Denied";

export const dynamic = "force-dynamic";

// Release is an assignment-level action (submitAssignment), not a
// per-answer one — every ANSWERED value on a site is "released" together,
// the moment the assignment leaves NOT_STARTED/IN_PROGRESS. So a
// question's real-world status is its own PositionValue.status crossed
// with whether its parent assignment has been sent for review yet.
type QuestionStatus = "UNANSWERED" | "DRAFT" | "ANSWERED_UNRELEASED" | "RELEASED" | "FLAGGED" | "APPROVED";

const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  UNANSWERED: "Not answered",
  DRAFT: "Draft",
  ANSWERED_UNRELEASED: "Answered — not yet released",
  RELEASED: "Released — awaiting review",
  FLAGGED: "Sent back",
  APPROVED: "Approved & locked",
};
const QUESTION_STATUS_STYLE: Record<QuestionStatus, string> = {
  UNANSWERED: "bg-track text-muted",
  DRAFT: "bg-track text-ink2",
  ANSWERED_UNRELEASED: "bg-track text-ink2",
  RELEASED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  FLAGGED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};
const QUESTION_STATUS_ORDER: QuestionStatus[] = ["UNANSWERED", "DRAFT", "ANSWERED_UNRELEASED", "RELEASED", "FLAGGED", "APPROVED"];

function deriveQuestionStatus(valueStatus: string | undefined, assignmentStatus: string | undefined): QuestionStatus {
  if (valueStatus === "APPROVED") return "APPROVED";
  if (valueStatus === "FLAGGED") return "FLAGGED";
  if (valueStatus === "DRAFT") return "DRAFT";
  if (valueStatus === "ANSWERED") {
    return assignmentStatus === "NOT_STARTED" || assignmentStatus === "IN_PROGRESS" ? "ANSWERED_UNRELEASED" : "RELEASED";
  }
  return "UNANSWERED";
}

export default async function ProgressPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "view")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      assets: true,
      assignments: {
        include: { template: { include: { sections: { include: { questions: true } } } }, period: true },
      },
    },
  });

  const positionValues = await db.positionValue.findMany({
    where: { siteId: { in: sites.map((s) => s.id) } },
    include: { position: true },
  });
  const valueByKey = new Map(
    positionValues.map((v) => [`${v.siteId}:${v.reportingPeriodId}:${v.position.positionCode}`, v]),
  );

  const rows = sites.map((site) => {
    const assignment = site.assignments[0];
    // Filtered by visible_if, not just isRequired — a site with no forklift
    // was showing "LPG for forklift" as missing forever. See CLAUDE.md rule
    // 10: one visibility function, and this page had stopped using it.
    const assets: VisibilityAsset[] = site.assets.map((a) => ({
      category: a.category,
      assetTypeCode: a.assetTypeCode,
      fuelOrMaterialCode: a.fuelOrMaterialCode,
      status: a.status,
      commissionedOn: a.commissionedOn,
      decommissionedOn: a.decommissionedOn,
    }));
    const questions = assignment
      ? assignment.template.sections
          .flatMap((s) => s.questions)
          .filter((q) => q.isRequired && q.allowedUnits.length > 0)
          .filter((q) =>
            evaluateVisibility(q.visibleIf as VisibilityRule | null, {
              siteType: site.siteType,
              siteCountry: site.country,
              assets,
              answers: {},
              periodStart: assignment.period.startsOn,
              periodEnd: assignment.period.endsOn,
            }),
          )
      : [];
    const statusByQuestion = questions.map((q) => {
      const v = valueByKey.get(`${site.id}:${assignment?.reportingPeriodId}:${q.code}`);
      return { question: q, status: deriveQuestionStatus(v?.status, assignment?.status) };
    });
    const answered = statusByQuestion.filter(({ status }) => status === "ANSWERED_UNRELEASED" || status === "RELEASED" || status === "APPROVED");
    const outstanding = statusByQuestion.filter(({ status }) => status === "UNANSWERED" || status === "DRAFT").map((s) => s.question);
    const statusCounts = statusByQuestion.reduce(
      (acc, { status }) => ({ ...acc, [status]: (acc[status] ?? 0) + 1 }),
      {} as Partial<Record<QuestionStatus, number>>,
    );
    return { site, assignment, total: questions.length, answered: answered.length, outstanding, statusCounts };
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Reporting Progress</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Where each facility stands, and exactly what's still missing.</p>

      <div className="mt-5 flex flex-col gap-3">
        {rows.map(({ site, assignment, total, answered, outstanding, statusCounts }) => (
          <div key={site.id} className="glass rounded-[11px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  {site.name} <span className="font-normal text-muted">({site.code})</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink2">
                  {assignment ? `${assignment.period.label} · ${answered} of ${total} required items answered` : "No assignment yet"}
                </div>
              </div>
              {assignment && (
                <div className="flex items-center gap-2">
                  <div className="h-[7px] w-32 overflow-hidden rounded-full bg-track">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${total === 0 ? 100 : Math.round((answered / total) * 100)}%` }} />
                  </div>
                  <Link href="/review" className="text-[12.5px] font-medium text-accent hover:underline">
                    Review
                  </Link>
                </div>
              )}
            </div>
            {assignment && total > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {QUESTION_STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
                  <span key={s} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${QUESTION_STATUS_STYLE[s]}`}>
                    {QUESTION_STATUS_LABEL[s]} · {statusCounts[s]}
                  </span>
                ))}
              </div>
            )}
            {outstanding.length > 0 && (
              <div className="mt-2 text-[12.5px] text-muted">
                Still needed: {outstanding.map((q) => formatQuestionLabel(q.label, assignment!.period.label)).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
