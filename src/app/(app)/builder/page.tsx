import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = orgScopedClient(org.id);

  const template = await db.questionnaireTemplate.findFirst({
    where: { status: "PUBLISHED" },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { questions: { orderBy: { sortOrder: "asc" }, include: { binding: true } } },
      },
    },
  });

  if (!template) {
    return <p className="text-[13px] text-ink2">No published template found.</p>;
  }

  return (
    <>
      <h1 className="text-xl font-semibold">
        {template.name} <span className="font-normal text-muted">v{template.version} · {template.status}</span>
      </h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        {template.sections.length} sections, {template.sections.reduce((n, s) => n + s.questions.length, 0)} questions.
        Read-only — editing and publishing aren&apos;t wired up yet.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {template.sections.map((section) => (
          <div key={section.id} className="rounded-[11px] border border-border bg-surface">
            <div className="border-b border-grid p-4">
              <div className="font-semibold">{section.title}</div>
              <div className="mt-0.5 text-[13px] text-ink2">
                {section.scope.replaceAll("_", " ")}
                {section.scope3Category ? ` · category ${section.scope3Category}` : ""}
              </div>
            </div>
            <div className="divide-y divide-grid">
              {section.questions.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <div className="text-[13px] font-medium">{q.label}</div>
                    {q.helpText && <div className="mt-0.5 text-xs text-ink2">{q.helpText}</div>}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                      <span className="font-mono">{q.code}</span>
                      <span>· {q.inputType.replaceAll("_", " ").toLowerCase()}</span>
                      {q.isRequired && <span>· required</span>}
                      {q.visibleIf && <span>· conditional</span>}
                    </div>
                  </div>
                  {q.binding ? (
                    <span className="whitespace-nowrap rounded-full bg-track px-2 py-0.5 text-xs font-medium text-ink2">
                      bound → {q.binding.fuelOrMaterialCode}
                    </span>
                  ) : (
                    <span className="whitespace-nowrap text-xs text-muted">no factor binding</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
