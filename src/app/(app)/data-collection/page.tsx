import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export default async function DataCollectionPage() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = orgScopedClient(org.id);

  const sites = await db.site.findMany({
    orderBy: { code: "asc" },
    include: {
      assignments: {
        include: {
          answers: { include: { question: true } },
          template: { include: { sections: { include: { questions: true } } } },
        },
      },
    },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Data Collection</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        What&apos;s been answered per site. These answers were written by the seed script directly — nobody has
        typed them through this screen, because the form itself (with <code className="font-mono">visible_if</code>{" "}
        filtering and autosave) isn&apos;t built yet. This is the read side only.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {sites.map((site) => {
          const assignment = site.assignments[0];
          const allQuestions = assignment?.template.sections.flatMap((s) => s.questions) ?? [];
          const answersByQuestion = new Map(assignment?.answers.map((a) => [a.questionId, a]) ?? []);

          return (
            <div key={site.id} className="rounded-[11px] border border-border bg-surface">
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
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="px-4 py-2">Question</th>
                      <th className="px-4 py-2">Answer</th>
                      <th className="px-4 py-2">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allQuestions.map((q) => {
                      const a = answersByQuestion.get(q.id);
                      return (
                        <tr key={q.id} className="border-t border-grid">
                          <td className="px-4 py-2 font-medium">{q.code}</td>
                          <td className="px-4 py-2 text-ink2">
                            {a ? `${a.valueNumeric?.toString() ?? a.valueText ?? "—"} ${a.unit ?? ""}` : (
                              <span className="text-muted">not answered</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-ink2">{a?.dataQuality ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
