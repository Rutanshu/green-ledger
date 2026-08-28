import { getCurrentMembership } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { can } from "@/lib/auth/permissions";
import { getOrgLabelOverrides } from "@/lib/labels/getOrgOverrides";
import { Label } from "@/components/Label";
import { HEALTH_LABEL } from "@/lib/factors";
import { SourcesTabs } from "../_components/SourcesTabs";
import { retestBinding } from "./actions";

export const dynamic = "force-dynamic";

const HEALTH_STYLE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FALLBACK_REGION: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AMBIGUOUS: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  BROKEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default async function FactorLabPage() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const org = membership.org;
  const canManage = can(membership.role, "manage_factors");
  const db = orgScopedClient(org.id);

  const [factorSets, template, labelOverrides] = await Promise.all([
    db.emissionFactorSet.findMany({
      include: { factors: { orderBy: { fuelOrMaterialCode: "asc" } } },
      orderBy: { publisher: "asc" },
    }),
    db.questionnaireTemplate.findFirst({
      where: { status: "PUBLISHED" },
      include: {
        sections: { include: { questions: { include: { binding: true } } } },
      },
    }),
    getOrgLabelOverrides(org.id),
  ]);

  const bindings = (template?.sections ?? [])
    .flatMap((s) => s.questions)
    .filter((q) => q.binding !== null)
    .map((q) => ({ question: q, binding: q.binding! }));

  return (
    <>
      <SourcesTabs />
      <h1 className="text-xl font-semibold">Factor Lab</h1>
      <p className="mt-0.5 text-[13px] text-ink2">Factor sets, and the health of every question's binding to them.</p>

      <h2 className="mb-2.5 mt-6 text-[14.5px] font-semibold">Bindings ({bindings.length})</h2>
      <div className="overflow-x-auto rounded-[11px] glass">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-grid text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Question</th>
              <th className="px-4 py-2.5">Activity</th>
              <th className="px-4 py-2.5">Fuel / material</th>
              <th className="px-4 py-2.5">Region strategy</th>
              <th className="px-4 py-2.5">Health</th>
              {canManage && <th className="px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {bindings.map(({ question, binding }) => (
              <tr key={binding.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-2.5 font-medium">{question.code}</td>
                <td className="px-4 py-2.5 text-ink2">
                  <Label entityKind="ACTIVITY_TYPE" code={binding.activityType} overrides={labelOverrides} showInfo />
                </td>
                <td className="px-4 py-2.5 text-ink2">{binding.fuelOrMaterialCode}</td>
                <td className="px-4 py-2.5 text-ink2">{binding.regionStrategy.replaceAll("_", " ").toLowerCase()}</td>
                <td className="px-4 py-2.5">
                  <span
                    title={binding.healthMessage ?? undefined}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_STYLE[binding.health]}`}
                  >
                    {HEALTH_LABEL[binding.health]}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5">
                    <form action={retestBinding.bind(null, binding.id)}>
                      <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs hover:bg-track">
                        Test binding
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">Factor sets</h2>
      <div className="flex flex-col gap-4">
        {factorSets.map((set) => (
          <div key={set.id} className="rounded-[11px] glass">
            <div className="border-b border-grid p-4">
              <div className="font-semibold">
                {set.publisher} — {set.name} <span className="font-normal text-muted">{set.version}</span>
              </div>
              <div className="mt-0.5 text-[13px] text-ink2">
                {set.regionScope} · {set.licence} · {set.factors.length} factors
              </div>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2">Fuel / material</th>
                  <th className="px-4 py-2">Activity</th>
                  <th className="px-4 py-2">Region</th>
                  <th className="px-4 py-2">Value</th>
                  <th className="px-4 py-2">Unit</th>
                </tr>
              </thead>
              <tbody>
                {set.factors.map((f) => (
                  <tr key={f.id} className="border-t border-grid">
                    <td className="px-4 py-2 font-medium">{f.fuelOrMaterialCode}</td>
                    <td className="px-4 py-2 text-ink2">
                      <Label entityKind="ACTIVITY_TYPE" code={f.activityType} overrides={labelOverrides} showInfo />
                    </td>
                    <td className="px-4 py-2 text-ink2">{f.region}</td>
                    <td className="px-4 py-2 text-ink2">{Number(f.value).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink2 font-mono text-xs">
                      {f.unitNumerator}/{f.unitDenominator}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
