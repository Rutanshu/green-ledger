import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { AnswerRow } from "./AnswerRow";

export const dynamic = "force-dynamic";

export default async function DataCollectionPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const org = membership.org;
  const canEdit = can(membership.role, "submit_answers");
  const db = orgScopedClient(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      assignments: {
        include: {
          answers: { include: { question: true, activityRecords: { include: { emissionRecords: true } } } },
          template: { include: { sections: { include: { questions: true } } } },
        },
      },
    },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Data Collection</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {canEdit ? (
          <>
            Live — edit a value and save. Completeness recalculates immediately via the same{" "}
            <code className="font-mono">computeCompleteness()</code> used everywhere else.
          </>
        ) : (
          "Read-only for your role — you can see every answer, but editing is off."
        )}
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {sites.map((site) => {
          const assignment = site.assignments[0];
          const allQuestions = assignment?.template.sections.flatMap((s) => s.questions) ?? [];
          const answersByQuestion = new Map(assignment?.answers.map((a) => [a.questionId, a]) ?? []);
          const numericQuestions = allQuestions.filter((q) => q.allowedUnits.length > 0);
          const otherQuestions = allQuestions.filter((q) => q.allowedUnits.length === 0);

          return (
            <div key={site.id} className="rounded-[11px] glass">
              <div className="border-b border-grid p-4">
                <div className="font-semibold">
                  {site.name} <span className="font-normal text-muted">({site.code})</span>
                </div>
                {assignment && (
                  <div className="mt-0.5 text-[13px] text-ink2">
                    {assignment.status.replaceAll("_", " ")} · {assignment.completenessPct.toString()}% complete
                  </div>
                )}
              </div>
              {allQuestions.length === 0 ? (
                <p className="p-4 text-[13px] text-muted">No assignment for this site.</p>
              ) : (
                <>
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
                        const a = answersByQuestion.get(q.id);
                        const emissionRecords = a?.activityRecords.flatMap((ar) => ar.emissionRecords) ?? [];
                        const totalKg = emissionRecords.reduce((sum, r) => sum + Number(r.emissionsKgCo2e), 0);
                        return (
                          <AnswerRow
                            key={q.id}
                            assignmentId={assignment!.id}
                            questionId={q.id}
                            code={q.code}
                            allowedUnits={q.allowedUnits}
                            existing={a ? { value: a.valueNumeric?.toString() ?? "", unit: a.unit ?? "", quality: a.dataQuality ?? "ESTIMATED" } : null}
                            existingEmissionsKg={emissionRecords.length > 0 ? totalKg.toString() : null}
                            canEdit={canEdit}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                  {otherQuestions.length > 0 && (
                    <div className="border-t border-grid p-4 text-xs text-muted">
                      {otherQuestions.length} boolean/conditional question(s) not editable in this demo (
                      {otherQuestions.map((q) => q.code).join(", ")}).
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
