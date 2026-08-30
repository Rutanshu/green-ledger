import Link from "next/link";

/**
 * Replaces the old ScopeSubNav (which filtered ONE template's sections
 * by a ?scope= query param, back when Scope 1/2/3.1–3.15 were all one
 * QuestionnaireTemplate row). Now that each of those is a real, separate
 * template, there's nothing left to filter within one page — this is a
 * sibling switcher instead: same tab row, each tab links to a different
 * template id.
 */
export interface SiblingTemplate {
  id: string;
  name: string;
  /** "1", "2", "3.1"…"3.15" — short tab label, or null for a template with no scope-taggable sections (a custom template, or the pre-split "Standard Operations" row). */
  scopeKey: string | null;
}

export function TemplateSwitcher({ templates, currentId }: { templates: SiblingTemplate[]; currentId: string }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-grid pb-2">
      {templates.map((t) => {
        const isActive = t.id === currentId;
        return (
          <Link
            key={t.id}
            href={`/builder/${t.id}`}
            title={t.name}
            className={`rounded-full px-2.5 py-1 text-[12.5px] font-medium ${
              isActive ? "bg-accent text-white" : "bg-track text-ink2 hover:text-ink"
            }`}
          >
            {t.scopeKey ?? t.name}
          </Link>
        );
      })}
    </div>
  );
}
