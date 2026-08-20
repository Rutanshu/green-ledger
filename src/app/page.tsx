import { rawPrisma } from "@/lib/db/client";
import { orgScopedClient } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

const HEALTH_STYLE: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FALLBACK_REGION: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AMBIGUOUS: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  BROKEN: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  LOCKED: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
};

async function getDemoOrgData() {
  const org = await rawPrisma.organization.findFirst({
    where: { legalName: "Meridian Industries (Demo)" },
  });
  if (!org) return null;

  const db = orgScopedClient(org.id);

  const [sites, template] = await Promise.all([
    db.site.findMany({
      include: { assignments: true },
      orderBy: { code: "asc" },
    }),
    db.questionnaireTemplate.findFirst({
      where: { status: "PUBLISHED" },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { questions: { include: { binding: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ]);

  const bindings = (template?.sections ?? [])
    .flatMap((s) => s.questions)
    .map((q) => q.binding)
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const healthCounts = { OK: 0, FALLBACK_REGION: 0, AMBIGUOUS: 0, BROKEN: 0 } as Record<string, number>;
  for (const b of bindings) healthCounts[b.health] = (healthCounts[b.health] ?? 0) + 1;

  return { org, sites, bindingCount: bindings.length, healthCounts };
}

export default async function Home() {
  const data = await getDemoOrgData();

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center p-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          No demo organisation found — run <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">npm run db:seed</code>.
        </p>
      </main>
    );
  }

  const { org, sites, bindingCount, healthCounts } = data;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:px-10">
      <header className="mb-10">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Green Ledger — live demo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{org.legalName}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Base year {org.baseYear} · {org.consolidationApproach.replaceAll("_", " ").toLowerCase()} consolidation
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">Sites</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[.02] text-left dark:border-white/10 dark:bg-white/[.03]">
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">City</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Completeness</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const assignment = site.assignments[0];
                return (
                  <tr key={site.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2">
                      <span className="font-medium">{site.name}</span>{" "}
                      <span className="text-zinc-400">({site.code})</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {site.siteType.replaceAll("_", " ").toLowerCase()}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{site.city}</td>
                    <td className="px-4 py-2">
                      {assignment ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[assignment.status]}`}>
                          {assignment.status.replaceAll("_", " ")}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {assignment ? `${assignment.completenessPct.toString()}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Factor binding health ({bindingCount} questions bound)
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(healthCounts)
            .filter(([, count]) => count > 0)
            .map(([health, count]) => (
              <span key={health} className={`rounded-full px-3 py-1 text-xs font-medium ${HEALTH_STYLE[health]}`}>
                {count} {health.replaceAll("_", " ").toLowerCase()}
              </span>
            ))}
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Computed by <code className="font-mono">checkBindingHealth()</code> in <code className="font-mono">lib/factors</code> at seed time —
          not hardcoded. A question cannot be published with a broken or ambiguous binding.
        </p>
      </section>
    </main>
  );
}
