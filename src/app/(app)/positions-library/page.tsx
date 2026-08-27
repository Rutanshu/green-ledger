import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { Denied } from "../_components/Denied";
import { PositionForm } from "./PositionForm";
import { deletePosition } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  FLOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ASSET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  INDICATOR: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  TEXT: "bg-track text-ink2",
  QUESTION: "bg-track text-ink2",
  OVERVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default async function PositionsLibraryPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canEdit = can(membership.role, "manage_questionnaire");
  if (!canEdit) return <Denied role={membership.role} />;
  const db = orgScopedClient(membership.org.id);

  const positions = await db.position.findMany({
    include: {
      _count: { select: { values: true, assetValues: true, sectionItems: true } },
    },
    orderBy: { positionCode: "asc" },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Position library</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        The global pool every questionnaire is assembled from. A position lives here once, independent of any
        template — add it to as many sections as you like from Builder; it stays one storage slot.
      </p>

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
                  <td className="px-4 py-2.5">{p.labelKey}</td>
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
    </>
  );
}
