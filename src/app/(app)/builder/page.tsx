import Link from "next/link";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { SourcesTabs } from "../_components/SourcesTabs";
import { CreateTemplateForm } from "./CreateTemplateForm";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-track text-ink2",
  PUBLISHED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ARCHIVED: "bg-track text-muted",
};

export default async function BuilderPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canEdit = can(membership.role, "manage_questionnaire");
  const db = orgScopedClient(membership.org.id);

  const templates = await db.questionnaireTemplate.findMany({
    include: { sections: { include: { questions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <SourcesTabs />
      <h1 className="text-xl font-semibold">Builder</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {canEdit
          ? "Create a questionnaire, add sections and questions of any field type, bind each to an emission factor, then publish."
          : "Your role can view templates but not edit them."}
      </p>

      {canEdit && (
        <div className="mt-5 max-w-sm">
          <CreateTemplateForm />
        </div>
      )}

      <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">Templates ({templates.length})</h2>
      <div className="flex flex-col gap-3">
        {templates.map((t) => {
          const questionCount = t.sections.reduce((n, s) => n + s.questions.length, 0);
          return (
            <Link
              key={t.id}
              href={`/builder/${t.id}`}
              className="glass flex items-center justify-between gap-4 rounded-[11px] p-4 hover:bg-track"
            >
              <div>
                <div className="font-medium">
                  {t.name} <span className="font-normal text-muted">v{t.version}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink2">
                  {t.sections.length} sections · {questionCount} questions
                </div>
              </div>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                {t.status}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
