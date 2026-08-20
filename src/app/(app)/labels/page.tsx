import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = orgScopedClient(org.id);

  const overrides = await db.labelOverride.findMany({ orderBy: [{ entityKind: "asc" }, { code: "asc" }] });

  return (
    <>
      <h1 className="text-xl font-semibold">Labels</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        Renaming a code here can never change a number — every calculation still uses the code underneath.
      </p>

      <div className="mt-5 overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Entity</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Scope</th>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Visible</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-2.5 text-ink2">{o.entityKind.replaceAll("_", " ").toLowerCase()}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink2">{o.code}</td>
                <td className="px-4 py-2.5 text-ink2">{o.scopeKey}</td>
                <td className="px-4 py-2.5 font-medium">{o.label}</td>
                <td className="px-4 py-2.5">{o.isHidden ? <span className="text-muted">hidden</span> : "shown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
