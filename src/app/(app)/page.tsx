import Link from "next/link";
import { getCurrentMembership, getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient, withOrgTransaction } from "@/lib/db/tenant";
import { toTonnes } from "@/lib/calc";
import { DataUserHome } from "./_shells/DataUserHome";
import Decimal from "decimal.js";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const db = orgScopedClient(org.id);
  const [sites, templates, emissionRecords] = await Promise.all([
    db.site.findMany({
      // Excludes the pre-split "Standard Operations" template (ARCHIVED,
      // kept only for history) from the roll-up below.
      include: { assignments: { where: { template: { status: { not: "ARCHIVED" } } } } },
      orderBy: { code: "asc" },
    }),
    // Up to 17 published templates now (one per scope) — findMany, not
    // findFirst, or this would silently check only whichever one template
    // Prisma returns first and miss a broken binding sitting in any other.
    db.questionnaireTemplate.findMany({
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
      tx.emissionRecord.findMany({
        where: { activityRecord: { organizationId: org.id } },
        select: { emissionsKgCo2e: true, activityRecord: { select: { siteId: true } } },
      }),
    ),
  ]);

  const bindings = templates
    .flatMap((t) => t.sections)
    .flatMap((s) => s.questions)
    .map((q) => q.binding)
    .filter((b): b is NonNullable<typeof b> => b !== null);
  // BROKEN/AMBIGUOUS mean no usable factor — a real, blocking problem.
  // FALLBACK_REGION still calculates, just from a less specific factor —
  // worth surfacing, not the same severity. Counting both as one
  // undifferentiated "issue" made a dashboard with zero broken bindings
  // read as if every single one needed urgent attention.
  const broken = bindings.filter((b) => b.health === "BROKEN" || b.health === "AMBIGUOUS").length;
  const usingFallback = bindings.filter((b) => b.health === "FALLBACK_REGION").length;

  // "Reporting" and completeness now roll up across a site's own up-to-17
  // assignments, not just assignments[0].
  const reporting = sites.filter((s) => s.assignments.some((a) => a.status !== "NOT_STARTED"));
  const allAssignments = sites.flatMap((s) => s.assignments);
  const avgCompleteness =
    allAssignments.length === 0 ? 0 : allAssignments.reduce((sum, a) => sum + Number(a.completenessPct), 0) / allAssignments.length;

  // Each site's own emissions (excluding any sub-facilities), then a
  // roll-up per site: a site's path is root-to-self inclusive of its own
  // id, so "sum every site whose path contains this site's id" is exactly
  // "this site plus every descendant" — same containment check reports/
  // actions.ts uses for its own descendant roll-up, just computed here
  // in memory since the org's whole site list is already loaded.
  const ownKgBySite = new Map<string, number>();
  for (const rec of emissionRecords) {
    const siteId = rec.activityRecord.siteId;
    ownKgBySite.set(siteId, (ownKgBySite.get(siteId) ?? 0) + Number(rec.emissionsKgCo2e));
  }
  const rolledUpKgBySite = new Map<string, number>();
  for (const site of sites) {
    let total = 0;
    for (const other of sites) {
      if (other.path.includes(site.id)) total += ownKgBySite.get(other.id) ?? 0;
    }
    rolledUpKgBySite.set(site.id, total);
  }
  const totalEmissionsKg = [...ownKgBySite.values()].reduce((a, b) => a + b, 0);

  // Tree order: a child's path is the parent's path plus its own id, so
  // sorting by the joined path puts every parent immediately before its
  // own children — same convention as the Facilities page.
  const sortedSites = [...sites].sort((a, b) => a.path.join(",").localeCompare(b.path.join(",")));

  return {
    org,
    sites: sortedSites,
    bindingCount: bindings.length,
    broken,
    usingFallback,
    reporting: reporting.length,
    avgCompleteness,
    emissionRecordCount: emissionRecords.length,
    emissionsTonnes: toTonnes(new Decimal(totalEmissionsKg)),
    ownKgBySite,
    rolledUpKgBySite,
  };
}

function Tile({
  label,
  value,
  unit,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: "crit" | "warn";
  href?: string;
}) {
  const valueColor = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ink";
  const body = (
    <>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold tracking-tight ${valueColor}`}>
        {value} {unit && <small className="text-sm font-medium text-ink2">{unit}</small>}
      </div>
      {note && <div className="text-xs text-ink2">{note}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-[11px] glass p-4 transition hover:border-accent">
        {body}
      </Link>
    );
  }
  return <div className="rounded-[11px] glass p-4">{body}</div>;
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

  const {
    sites,
    bindingCount,
    broken,
    usingFallback,
    reporting,
    avgCompleteness,
    emissionRecordCount,
    emissionsTonnes,
    ownKgBySite,
    rolledUpKgBySite,
  } = data;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mt-0.5 text-[13px] text-ink2">FY2026 progress across {sites.length} facilities</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Sites reporting" value={`${reporting}`} unit={`of ${sites.length}`} />
        <Tile label="Avg. completeness" value={avgCompleteness.toFixed(0)} unit="%" />
        <Tile
          label="Broken bindings"
          value={`${broken}`}
          unit={`of ${bindingCount} bound`}
          tone={broken > 0 ? "crit" : undefined}
          href={broken > 0 ? "/builder" : undefined}
          note={
            broken > 0
              ? "no factor found — fix in Data Collection Setup →"
              : usingFallback > 0
                ? `${usingFallback} using a general figure`
                : undefined
          }
        />
        {emissionRecordCount > 0 ? (
          <Tile label="Total emissions" value={emissionsTonnes} unit="tCO2e" note={`from ${emissionRecordCount} calculated records`} />
        ) : (
          <Tile label="Emissions calculated" value="0" unit="records" note="submit an answer in Data Collection" />
        )}
      </div>

      <h2 className="mb-2.5 mt-6 text-[14.5px] font-semibold">Facility hierarchy</h2>
      <div className="flex flex-col gap-2.5">
        {sites.map((site) => {
          const approvedCount = site.assignments.filter((a) => a.status === "APPROVED" || a.status === "LOCKED").length;
          const avgPct =
            site.assignments.length === 0 ? 0 : site.assignments.reduce((sum, a) => sum + Number(a.completenessPct), 0) / site.assignments.length;
          const ownKg = ownKgBySite.get(site.id) ?? 0;
          const rolledUpKg = rolledUpKgBySite.get(site.id) ?? 0;
          const hasSubFacilities = rolledUpKg !== ownKg;
          const subFacilityCount = sites.filter((s) => s.id !== site.id && s.path.includes(site.id)).length;

          return (
            <Link
              key={site.id}
              href={`/sites/${site.id}/breakdown`}
              className="rounded-[11px] glass p-4 transition hover:border-accent"
              style={{ marginLeft: `${(site.depth ?? 0) * 24}px` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap rounded-full bg-track px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink2">
                    Level {site.depth ?? 0}
                  </span>
                  <div>
                    <div className="font-medium">
                      {site.name} <span className="font-normal text-muted">({site.code})</span>
                    </div>
                    {site.assignments.length > 0 && (
                      <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink2">
                        <span className="rounded-full bg-track px-2 py-0.5 text-xs font-medium text-ink2">
                          {approvedCount} of {site.assignments.length} scopes approved
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-[6px] w-20 overflow-hidden rounded-full bg-track">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(avgPct)}%` }} />
                          </div>
                          <span>{Math.round(avgPct)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tracking-tight">
                    {(rolledUpKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} <small className="text-xs font-medium text-ink2">tCO2e</small>
                  </div>
                  {hasSubFacilities && (
                    <div className="text-[11.5px] text-muted">
                      incl. {subFacilityCount} sub-facilit{subFacilityCount === 1 ? "y" : "ies"} ({(ownKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} own)
                    </div>
                  )}
                  <div className="text-[11.5px] text-accent">View per-question breakdown →</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
