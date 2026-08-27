import { getCurrentMembership } from "@/lib/demo-org";
import { can } from "@/lib/auth/permissions";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { resolveLabel, type LabelEntityKind } from "@/lib/labels";
import { SYSTEM_DEFAULTS } from "@/lib/labels/systemDefaults";
import { LabelRow } from "./LabelRow";

export const dynamic = "force-dynamic";

// Kinds with real system defaults today — SITE_TYPE/ASSET_TYPE/FUEL_OR_MATERIAL
// source their defaults from org vocabulary (VocabularyEntry), not this
// static table, so they're not shown here yet. SECTION/QUESTION are
// per-object (bound by scopeKey to a specific template/question id), not a
// flat closed list, so a generic "codes for this kind" view doesn't apply.
const SHOWN_KINDS: LabelEntityKind[] = [
  "SCOPE", "SCOPE3_CATEGORY", "ACTIVITY_TYPE", "METHOD", "DATA_QUALITY",
  "ASSET_CATEGORY", "STATUS", "ROLE", "DOCUMENT_TYPE", "UNIT", "DENOMINATOR",
];

export default async function LabelsPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const canEdit = can(membership.role, "manage_org");
  const overrides = await getOrgLabelOverrides(membership.org.id);

  return (
    <>
      <h1 className="text-xl font-semibold">Labels</h1>
      <p className="mt-0.5 text-[13px] text-ink2">
        Renaming a code here can never change a number — every calculation still uses the code underneath. This is
        the actual, currently-displayed label for each code across the app, not just a list of stored overrides.
      </p>

      <div className="mt-5 flex flex-col gap-6">
        {SHOWN_KINDS.map((kind) => {
          const codes = Object.keys(SYSTEM_DEFAULTS[kind] ?? {});
          if (codes.length === 0) return null;
          return (
            <div key={kind}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                {kind.replaceAll("_", " ").toLowerCase()}
              </h2>
              <div className="overflow-x-auto rounded-[11px] glass">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Label</th>
                      <th className="px-4 py-2.5">Source</th>
                      {canEdit && <th className="px-4 py-2.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((code) => {
                      const resolved = resolveLabel(kind, code, overrides, SYSTEM_DEFAULTS[kind] ?? {});
                      return (
                        <LabelRow
                          key={code}
                          entityKind={kind}
                          code={code}
                          currentLabel={resolved.label}
                          currentShortLabel={resolved.shortLabel}
                          source={resolved.source}
                          canEdit={canEdit}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
