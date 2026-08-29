import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { CreateSiteForm } from "./CreateSiteForm";

export const dynamic = "force-dynamic";

const ASSET_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  STANDBY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DECOMMISSIONED: "bg-track text-ink2",
};

export default async function SitesPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const org = membership.org;
  const canManage = can(membership.role, "manage_sites");
  const db = orgScopedClient(org.id);

  const [sitesRaw, siteTypeEntries] = await Promise.all([
    db.site.findMany({
      include: { assets: { orderBy: { name: "asc" } }, parentSite: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    db.vocabularyEntry.findMany({ where: { kind: "SITE_TYPE" }, orderBy: { label: "asc" } }),
  ]);
  // Sorting by path (not code) puts a parent immediately before its own
  // children, since a child's path is the parent's path plus its own id —
  // the tree reads top-to-bottom without a separate recursive render.
  const sites = [...sitesRaw].sort((a, b) => a.path.join(",").localeCompare(b.path.join(",")));
  const siteTypes = siteTypeEntries.map((e) => ({ code: e.code, label: e.label }));
  const siteOptions = sites.map((s) => ({ id: s.id, name: s.name, code: s.code, depth: s.depth }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Facilities</h1>
          <p className="mt-0.5 text-[13px] text-ink2">{sites.length} facilities in this organisation.</p>
        </div>
        {canManage && <CreateSiteForm siteTypes={siteTypes} siteOptions={siteOptions} />}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {sites.map((site) => (
          <div key={site.id} className="rounded-[11px] glass" style={{ marginLeft: `${(site.depth ?? 0) * 24}px` }}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-grid p-4">
              <div>
                <div className="font-semibold">
                  {site.name} <span className="font-normal text-muted">({site.code})</span>
                </div>
                <div className="mt-0.5 text-[13px] text-ink2">
                  {site.siteType.replaceAll("_", " ").toLowerCase()} · {site.city}, {site.country} · grid{" "}
                  {site.gridRegion ?? "—"}
                  {site.parentSite && <> · part of {site.parentSite.name}</>}
                </div>
              </div>
              <div className="flex gap-4 text-[13px] text-ink2">
                {site.floorAreaM2 && <span>{Number(site.floorAreaM2).toLocaleString()} m²</span>}
                {site.headcountFte && <span>{Number(site.headcountFte).toLocaleString()} FTE</span>}
              </div>
            </div>

            {site.assets.length === 0 ? (
              <p className="p-4 text-[13px] text-muted">No assets — deliberately, to prove this site can still reach 100% completeness.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-4 py-2">Asset</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Fuel / material</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {site.assets.map((asset) => (
                    <tr key={asset.id} className="border-t border-grid">
                      <td className="px-4 py-2 font-medium">{asset.name}</td>
                      <td className="px-4 py-2 text-ink2">{asset.category.replaceAll("_", " ").toLowerCase()}</td>
                      <td className="px-4 py-2 text-ink2">{asset.fuelOrMaterialCode ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_STYLE[asset.status]}`}>
                          {asset.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
