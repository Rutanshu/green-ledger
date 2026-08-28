import { rawPrisma } from "@/lib/db/client";
import { PlatformHeader } from "../_ui";
import { GwpEditRow } from "./GwpEditRow";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  const gwpSets = await rawPrisma.gwpSet.findMany({ orderBy: [{ name: "asc" }, { gas: "asc" }] });

  return (
    <>
      <PlatformHeader title="Platform Settings" body="Global reference data every company shares — changing it affects every company's future calculations." />

      <h2 className="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-[#9aa39d]">Warming-potential standards (GWP sets)</h2>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-left font-mono text-[10.5px] uppercase tracking-wide text-[#9aa39d]">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Gas</th>
              <th className="px-4 py-2.5">Default</th>
              <th className="px-4 py-2.5">GWP100</th>
            </tr>
          </thead>
          <tbody>
            {gwpSets.map((g) => (
              <GwpEditRow key={g.id} id={g.id} name={g.name} gas={g.gas} gwp100={g.gwp100.toString()} isDefault={g.isDefault} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-[#7a837e]">
        Changing a GWP100 value here only affects calculations run after the change — CLAUDE.md rule 3: factors are
        immutable once referenced, so nothing already calculated silently changes.
      </p>
    </>
  );
}
