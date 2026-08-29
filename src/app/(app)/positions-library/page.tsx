import { Suspense } from "react";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { SourcesTabs } from "../_components/SourcesTabs";
import { ScopeSubNav } from "../builder/ScopeSubNav";
import { PositionForm } from "./PositionForm";
import { CustomFieldForm } from "./CustomFieldForm";
import { deletePosition, deleteCustomField } from "./actions";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  FLOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ASSET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  INDICATOR: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  TEXT: "bg-track text-ink2",
  QUESTION: "bg-track text-ink2",
  OVERVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default async function PositionsLibraryPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canEdit = can(membership.role, "manage_questionnaire");
  if (!canEdit) return <Denied role={membership.role} />;
  const db = orgScopedClient(membership.org.id);
  const { scope: scopeFilter } = await searchParams;

  const allPositions = await db.position.findMany({
    include: {
      _count: { select: { values: true, assetValues: true, sectionItems: true } },
      binding: { select: { scope: true, scope3Category: true } },
    },
    orderBy: { positionCode: "asc" },
  });

  // Position itself carries no scope field — it comes from the position's
  // (optional, 1:1) FactorBinding. A position with no binding yet has no
  // scope to filter by, so it only shows under "All".
  const positionScopeKey = (p: (typeof allPositions)[number]) =>
    !p.binding ? null : p.binding.scope === "SCOPE_3" && p.binding.scope3Category ? `3.${p.binding.scope3Category}` : p.binding.scope === "SCOPE_1" ? "1" : "2";
  const scopeCounts: Record<string, number> = {};
  for (const p of allPositions) {
    const key = positionScopeKey(p);
    if (key) scopeCounts[key] = (scopeCounts[key] ?? 0) + 1;
  }
  const positions = scopeFilter ? allPositions.filter((p) => positionScopeKey(p) === scopeFilter) : allPositions;

  const customFields = await db.customFieldDefinition.findMany({
    include: { position: { select: { positionCode: true } }, _count: { select: { values: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <SourcesTabs />
      <h1 className="text-xl font-semibold">Position library</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        The global pool every questionnaire is assembled from. A position lives here once, independent of any
        template — add it to as many sections as you like from Builder; it stays one storage slot.
      </p>

      <div className="mt-5">
        <Suspense fallback={null}>
          <ScopeSubNav counts={scopeCounts} />
        </Suspense>
      </div>

      <div className="mt-5">
        <PositionForm />
      </div>

      <div className="mt-5 overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">In sections</th>
              <th className="px-4 py-2.5">Values</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const dataCount = p._count.values + p._count.assetValues;
              const canDelete = dataCount === 0 && p._count.sectionItems === 0;
              return (
                <tr key={p.id} className="border-b border-grid last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.positionCode}</td>
                  <td className="px-4 py-2.5">{formatQuestionLabel(p.labelKey, "each period")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[p.type]}`}>{p.type}</span>
                    {p.dimension && <span className="ml-1.5 text-xs text-muted">· {p.dimension}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink2">{p._count.sectionItems}</td>
                  <td className="px-4 py-2.5 text-ink2">{dataCount}</td>
                  <td className="px-4 py-2.5">
                    {canDelete && (
                      <form action={deletePosition.bind(null, p.id)}>
                        <button type="submit" className="text-xs text-muted hover:text-crit">
                          Delete
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No positions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">Custom fields</h2>
      <p className="mt-0.5 text-[13px] text-ink2">
        Extra ad-hoc fields collected alongside a position's main value — a note, a reference number, a date. Attach
        one to a specific position, or leave it floating so it's offered everywhere.
      </p>

      <div className="mt-4">
        <CustomFieldForm positions={allPositions.map((p) => ({ id: p.id, positionCode: p.positionCode }))} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Scope</th>
              <th className="px-4 py-2.5">Values collected</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {customFields.map((f) => (
              <tr key={f.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-2.5 font-medium">
                  {f.label}
                  {f.isRequired && <span className="ml-1.5 text-xs text-muted">· required</span>}
                </td>
                <td className="px-4 py-2.5 text-ink2">{f.fieldType}</td>
                <td className="px-4 py-2.5 text-ink2">
                  {f.position ? (
                    <span className="font-mono text-xs">{f.position.positionCode}</span>
                  ) : (
                    <span className="rounded-full bg-track px-1.5 text-accent-sky">floating — every position</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink2">{f._count.values}</td>
                <td className="px-4 py-2.5">
                  {f._count.values === 0 && (
                    <form action={deleteCustomField.bind(null, f.id)}>
                      <button type="submit" className="text-xs text-muted hover:text-crit">
                        Delete
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {customFields.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No custom fields yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
