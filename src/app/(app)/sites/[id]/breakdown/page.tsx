import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Label } from "@/components/Label";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";
import { CalculationBreakdown } from "@/components/CalculationBreakdown";
import { Denied } from "../../../_components/Denied";

export const dynamic = "force-dynamic";

/**
 * Per-question emissions for one facility (CLAUDE.md rule 2 — every
 * number traceable back to the answer and factor that produced it).
 * Deliberately scoped to this one site, not its descendants: Overview's
 * roll-up tells you the bigger number, this page tells you exactly which
 * answer at exactly which facility produced each kilogram of it.
 */
export default async function SiteBreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (!can(membership.role, "view")) return <Denied role={membership.role} />;

  const org = membership.org;
  const db = orgScopedClient(org.id);
  const labelOverrides = await getOrgLabelOverrides(org.id);

  const site = await db.site.findFirst({
    where: { id },
    include: {
      parentSite: { select: { name: true } },
      // Excludes the pre-split "Standard Operations" template (ARCHIVED,
      // kept only for history) — nothing left in it to show.
      assignments: {
        where: { template: { status: { not: "ARCHIVED" } } },
        include: { template: { include: { sections: { include: { questions: true } } } }, period: true },
      },
    },
  });
  if (!site) notFound();

  const positionValues = await db.positionValue.findMany({
    where: { siteId: site.id, reportingPeriodId: { in: site.assignments.map((a) => a.reportingPeriodId) } },
    include: { position: true, activityRecords: { include: { emissionRecords: true } } },
  });
  const valueByKey = new Map(positionValues.map((v) => [`${v.reportingPeriodId}:${v.position.positionCode}`, v]));

  const totalKg = positionValues.reduce(
    (sum, v) => sum + v.activityRecords.flatMap((ar) => ar.emissionRecords).reduce((s, r) => s + Number(r.emissionsKgCo2e), 0),
    0,
  );

  return (
    <>
      <Link href="/" className="text-[13px] font-medium text-accent hover:underline">
        ← Overview
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {site.name} <span className="font-normal text-muted">({site.code})</span>
          </h1>
          <p className="mt-0.5 text-[13px] text-ink2">
            Level {site.depth ?? 0}
            {site.parentSite && <> · part of {site.parentSite.name}</>}
            {site.assignments[0] && <> · {site.assignments[0].period.label}</>}
          </p>
        </div>
        <div className="rounded-[11px] glass px-4 py-2.5 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total, this facility</div>
          <div className="text-[20px] font-semibold tracking-tight">{(totalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</div>
        </div>
      </div>

      {site.assignments.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted">No assignment for this facility yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {site.assignments.map((assignment) => {
            const questions = assignment.template.sections.flatMap((s) => s.questions).filter((q) => q.allowedUnits.length > 0);
            return (
              <div key={assignment.id} className="rounded-[11px] glass">
                <div className="border-b border-grid p-3 text-[13px] font-semibold">{assignment.template.name}</div>
                <div className="divide-y divide-grid">
                  {questions.map((q) => {
                    const v = valueByKey.get(`${assignment.reportingPeriodId}:${q.code}`);
                    const emissionRecords = v?.activityRecords.flatMap((ar) => ar.emissionRecords) ?? [];
                    const primary = emissionRecords[0];
                    return (
                      <div key={q.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-medium">{formatQuestionLabel(q.label, assignment.period.label)}</div>
                            <div className="mt-0.5 text-[13px] text-ink2">
                              {v && v.status !== "UNANSWERED" ? (
                                <>
                                  {v.valueNumeric?.toString()} {v.unit} ·{" "}
                                  <Label entityKind="STATUS" code={v.status === "APPROVED" ? "APPROVED" : v.status} overrides={labelOverrides} />
                                </>
                              ) : (
                                <span className="text-muted">not answered</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {primary && (
                          <div className="mt-2.5">
                            <CalculationBreakdown
                              record={{
                                quantityNormalised: primary.quantityNormalised.toString(),
                                unitNormalised: primary.unitNormalised,
                                factorValue: primary.factorValue.toString(),
                                factorUnitNumerator: primary.factorUnitNumerator,
                                factorUnitDenominator: primary.factorUnitDenominator,
                                factorSource: primary.factorSource,
                                factorVersion: primary.factorVersion,
                                gwpValue: primary.gwpValue.toString(),
                                gwpSet: primary.gwpSet,
                                emissionsKgCo2e: primary.emissionsKgCo2e.toString(),
                                calcEngineVersion: primary.calcEngineVersion,
                                calculatedAt: primary.calculatedAt.toISOString(),
                              }}
                              labelOverrides={labelOverrides}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
