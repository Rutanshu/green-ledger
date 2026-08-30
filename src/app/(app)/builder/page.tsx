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
    include: { sections: { include: { questions: true, items: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  // Since the split into 17 per-scope templates, each template's own
  // section(s) already carry a real scope — group by that instead of
  // one flat creation-order list. A template with no sections yet (just
  // created, or the pre-split "Standard Operations" row now emptied by
  // the split) has nothing to derive a scope from, so it sits under
  // "Other" rather than being guessed at.
  const groupOf = (t: (typeof templates)[number]): string => {
    const scope = t.sections[0]?.scope;
    if (scope === "SCOPE_1") return "Scope 1";
    if (scope === "SCOPE_2") return "Scope 2";
    if (scope === "SCOPE_3") return "Scope 3";
    return "Other";
  };
  const sortKey = (t: (typeof templates)[number]): string => {
    const s = t.sections[0];
    if (!s) return "zzz";
    const cat = s.scope3Category != null ? String(s.scope3Category).padStart(2, "0") : "00";
    return `${s.scope}.${cat}`;
  };
  const groupOrder = ["Scope 1", "Scope 2", "Scope 3", "Other"];
  const grouped = new Map<string, typeof templates>();
  for (const t of [...templates].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
    const g = groupOf(t);
    grouped.set(g, [...(grouped.get(g) ?? []), t]);
  }

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
      <div className="flex flex-col gap-6">
        {groupOrder
          .filter((g) => grouped.has(g))
          .map((group) => (
            <div key={group}>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{group}</h3>
              <div className="flex flex-col gap-3">
                {grouped.get(group)!.map((t) => {
                  const questionCount = t.sections.reduce((n, s) => n + s.questions.length + s.items.length, 0);
                  return (
                    <Link
                      key={t.id}
                      href={`/builder/${t.id}`}
                      className="glass flex flex-col gap-2.5 rounded-[11px] p-4 hover:bg-track"
                    >
                      <div className="flex items-center justify-between gap-4">
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
                      </div>
                      {t.sections.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.sections.map((s) => {
                            const n = s.questions.length + s.items.length;
                            return (
                              <span key={s.id} className="whitespace-nowrap rounded-full bg-track px-2 py-0.5 text-[11px] text-ink2">
                                {s.title} <span className="text-muted">({n})</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
