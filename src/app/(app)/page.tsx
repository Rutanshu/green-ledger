import Link from "next/link";
import { getCurrentMembership, getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { toTonnes } from "@/lib/calc";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Label } from "@/components/Label";
import { DataUserHome } from "./_shells/DataUserHome";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: "bg-track text-ink2",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  LOCKED: "bg-track text-ink",
};

async function getDashboardData() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const db = orgScopedClient(org.id);
  const [sites, template, emissionsAgg, labelOverrides] = await Promise.all([
    db.site.findMany({ include: { assignments: true }, orderBy: { code: "asc" } }),
    db.questionnaireTemplate.findFirst({
      where: { status: "PUBLISHED" },
      include: { sections: { include: { questions: { include: { binding: true } } } } },
    }),
    // EmissionRecord has no organization_id of its own — scoped via its
    // ActivityRecord, same pattern as the QuestionnaireAssignment checks.
    // ActivityRecord has real RLS now, so this join needs app.org_id set —
    // a bare rawPrisma call here silently sees nothing (found live: the
    // Dashboard read 0 records right after the app switched to the
    // RLS-restricted role, because this one query wasn't scoped).
    withOrgTransaction(org.id, (tx) =>
      tx.emissionRecord.aggregate({
        where: { activityRecord: { organizationId: org.id } },
        _sum: { emissionsKgCo2e: true },
        _count: true,
      }),
    ),
    // fetched once per page, not once per <Label> — see components/Label.tsx
    getOrgLabelOverrides(org.id),
  ]);

  const bindings = (template?.sections ?? [])
    .flatMap((s) => s.questions)
    .map((q) => q.binding)
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const issues = bindings.filter((b) => b.health !== "OK").length;

  const reporting = sites.filter((s) => s.assignments[0]?.status !== "NOT_STARTED" && s.assignments[0]);
  const avgCompleteness =
    sites.length === 0
      ? 0
      : sites.reduce((sum, s) => sum + Number(s.assignments[0]?.completenessPct ?? 0), 0) / sites.length;

  const emissionsKg = new Decimal(emissionsAgg._sum.emissionsKgCo2e?.toString() ?? 0);

  return {
    org,
    sites,
    bindingCount: bindings.length,
    issues,
    reporting: reporting.length,
    avgCompleteness,
    emissionRecordCount: emissionsAgg._count,
    emissionsTonnes: toTonnes(emissionsKg),
    labelOverrides,
  };
}

function Tile({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="rounded-[11px] glass p-4">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight">
        {value} {unit && <small className="text-sm font-medium text-ink2">{unit}</small>}
      </div>
      {note && <div className="text-xs text-ink2">{note}</div>}
    </div>
  );
}

export default async function Home() {
  const membership = await getCurrentMembership();
  // Read Only gets this same informational dashboard, not the task-
  // oriented Data User home — there's nothing for them to do, but
  // plenty to see: sites, completeness, and total emissions. Nothing
  // below this point is a write action, so it's already safe as-is.
  if (membership && membership.role === "DATA_INPUTTER") {
    return <DataUserHome membership={membership} />;
  }

  const data = await getDashboardData();

  if (!data) {
    return (
      <p className="text-sm text-ink2">
        No demo organisation found — run <code className="rounded bg-track px-1.5 py-0.5 font-mono text-xs">npm run db:seed</code>.
      </p>
    );
  }

  const { sites, bindingCount, issues, reporting, avgCompleteness, emissionRecordCount, emissionsTonnes, labelOverrides } = data;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-ink2">FY2026 progress across {sites.length} sites</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Sites reporting" value={`${reporting}`} unit={`of ${sites.length}`} />
        <Tile label="Avg. completeness" value={avgCompleteness.toFixed(0)} unit="%" />
        <Tile
          label="Binding issues"
          value={`${issues}`}
          unit={`of ${bindingCount} bound`}
          note={issues > 0 ? "needs attention in Factor Lab" : undefined}
        />
        {emissionRecordCount > 0 ? (
          <Tile label="Total emissions" value={emissionsTonnes} unit="tCO2e" note={`from ${emissionRecordCount} calculated records`} />
        ) : (
          <Tile label="Emissions calculated" value="0" unit="records" note="submit an answer in Data Collection" />
        )}
      </div>

      <h2 className="mb-2.5 mt-6 text-[14.5px] font-semibold">Progress by site</h2>
      <div className="overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Site</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">City</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Completeness</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const assignment = site.assignments[0];
              const pct = Number(assignment?.completenessPct ?? 0);
              return (
                <tr key={site.id} className="border-b border-grid last:border-0 hover:bg-track">
                  <td className="px-4 py-2.5">
                    <Link href="/sites" className="font-medium hover:underline">
                      {site.name}
                    </Link>{" "}
                    <span className="text-muted">({site.code})</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink2">{site.siteType.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-ink2">{site.city}</td>
                  <td className="px-4 py-2.5">
                    {assignment ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[assignment.status]}`}>
                        <Label entityKind="STATUS" code={assignment.status} overrides={labelOverrides} />
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-[7px] min-w-[52px] flex-1 overflow-hidden rounded-full bg-track">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-ink2">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
