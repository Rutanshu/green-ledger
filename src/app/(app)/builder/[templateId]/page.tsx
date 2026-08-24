import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { SectionForm } from "../SectionForm";
import { QuestionForm } from "../QuestionForm";
import { BindingForm } from "../BindingForm";
import { deleteSection, deleteQuestion } from "../actions";
import { PublishButton } from "../PublishButton";

export const dynamic = "force-dynamic";

const HEALTH_STYLE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FALLBACK_REGION: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AMBIGUOUS: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  BROKEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-track text-ink2",
  PUBLISHED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ARCHIVED: "bg-track text-muted",
};

export default async function TemplateEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canEdit = can(membership.role, "manage_questionnaire");
  const db = orgScopedClient(membership.org.id);

  const template = await db.questionnaireTemplate.findFirst({
    where: { id: templateId },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" }, include: { binding: true } } },
      },
    },
  });
  if (!template) notFound();

  const questionCount = template.sections.reduce((n, s) => n + s.questions.length, 0);
  const boundCount = template.sections.flatMap((s) => s.questions).filter((q) => q.binding).length;

  return (
    <>
      <Link href="/builder" className="text-xs text-muted hover:text-ink2">← All templates</Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {template.name} <span className="font-normal text-muted">v{template.version}</span>
          </h1>
          <p className="mt-0.5 text-[13px] text-ink2">
            {template.sections.length} sections · {questionCount} questions · {boundCount} bound
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[template.status]}`}>{template.status}</span>
          {canEdit && template.status === "DRAFT" && <PublishButton templateId={template.id} />}
        </div>
      </div>

      {canEdit && (
        <div className="mt-5">
          <SectionForm templateId={template.id} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {template.sections.map((section) => (
          <div key={section.id} className="glass rounded-[11px]">
            <div className="flex items-start justify-between gap-3 border-b border-grid p-4">
              <div>
                <div className="font-semibold">{section.title}</div>
                <div className="mt-0.5 text-[13px] text-ink2">
                  {section.scope.replaceAll("_", " ")}
                  {section.scope3Category ? ` · category ${section.scope3Category}` : ""}
                </div>
              </div>
              {canEdit && (
                <form action={deleteSection.bind(null, section.id)}>
                  <button type="submit" className="text-xs text-muted hover:text-crit">Delete section</button>
                </form>
              )}
            </div>

            <div className="divide-y divide-grid">
              {section.questions.map((q) => (
                <div key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-medium">{q.label}</div>
                      {q.helpText && <div className="mt-0.5 text-xs text-ink2">{q.helpText}</div>}
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                        <span className="font-mono">{q.code}</span>
                        <span>· {q.inputType.replaceAll("_", " ").toLowerCase()}</span>
                        {q.inputType === "NUMBER_WITH_UNIT" && <span>· {q.allowedUnits.join("/")}</span>}
                        {q.isRequired && <span>· required</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {q.binding && (
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_STYLE[q.binding.health]}`}>
                          {q.binding.health.replaceAll("_", " ")}
                        </span>
                      )}
                      {canEdit && (
                        <form action={deleteQuestion.bind(null, q.id)}>
                          <button type="submit" className="text-xs text-muted hover:text-crit">Delete</button>
                        </form>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <BindingForm
                      questionId={q.id}
                      existing={
                        q.binding
                          ? {
                              scope: q.binding.scope,
                              scope3Category: q.binding.scope3Category,
                              activityType: q.binding.activityType,
                              method: q.binding.method,
                              fuelOrMaterialCode: q.binding.fuelOrMaterialCode,
                              regionStrategy: q.binding.regionStrategy,
                              outputBasis: q.binding.outputBasis,
                              health: q.binding.health,
                            }
                          : null
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="p-4 pt-0">
                <QuestionForm sectionId={section.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
