import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCurrentOrg } from "@/lib/demo-org";
import { orgScopedClient } from "@/lib/db/tenant";
import { CONSOLIDATION_LABEL } from "@/lib/org/consolidationLabel";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: 1, title: "What you have", body: "Your sites, and what's inside them — boilers, generators, chillers, vehicles, IT.", tag: "Sites → Assets" },
  { n: 2, title: "What we ask", body: "A plain-language questionnaire. Only the questions that apply to that site appear.", tag: "Data Collection" },
  { n: 3, title: "How it's counted", body: "Each question is mapped to a published emission factor. That mapping is yours to control.", tag: "Factor Lab" },
  { n: 4, title: "What comes out", body: "Dashboards, disclosures, and an audit pack an assurer can recompute in Excel.", tag: "Reports" },
];

async function getChecklistData() {
  const org = await getCurrentOrg();
  if (!org) return null;
  const db = orgScopedClient(org.id);

  const [siteCount, assetCount, labelCount, factorSetCount, templates, memberCount, startedAssignments, totalAssignments] = await Promise.all([
    db.site.count(),
    db.siteAsset.count(),
    db.labelOverride.count(),
    db.emissionFactorSet.count(),
    // Up to 17 published templates now (one per scope) — findMany, not
    // findFirst, or this would silently check only whichever one template
    // Prisma returns first and miss a broken binding sitting in any other.
    db.questionnaireTemplate.findMany({
      where: { status: "PUBLISHED" },
      include: { sections: { include: { questions: { include: { binding: true } } } } },
    }),
    db.membership.count(),
    db.questionnaireAssignment.count({ where: { status: { not: "NOT_STARTED" } } }),
    db.questionnaireAssignment.count(),
  ]);

  const bindings = templates.flatMap((t) => t.sections).flatMap((s) => s.questions).map((q) => q.binding).filter((b) => b !== null);
  const broken = bindings.filter((b) => b!.health === "BROKEN" || b!.health === "AMBIGUOUS").length;

  return { org, siteCount, assetCount, labelCount, factorSetCount, templates, broken, memberCount, startedAssignments, totalAssignments };
}

function Check({ done, partial }: { done?: boolean; partial?: boolean }) {
  if (done) return <span className="text-good">✓</span>;
  if (partial) return <span className="text-warn">◐</span>;
  return <span className="text-muted">○</span>;
}

export default async function HowItWorksPage() {
  const data = await getChecklistData();

  return (
    <>
      <h1 className="text-xl font-semibold">How Green Ledger works</h1>
      <p className="mt-1 text-[13px] text-ink2">Four things happen, in order. Everything in the product is one of them.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-[11px] glass p-4">
            <div className="text-xs font-semibold text-muted">{s.n}</div>
            <div className="mt-1 font-semibold">{s.title}</div>
            <p className="mt-1 text-[13px] text-ink2">{s.body}</p>
            <div className="mt-2 text-xs font-medium text-accent">{s.tag}</div>
          </div>
        ))}
      </div>

      {data && (
        <>
          <h2 className="mb-2.5 mt-8 text-[14.5px] font-semibold">This demo org's setup</h2>
          <div className="divide-y divide-grid rounded-[11px] glass">
            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Organisation basics</div>
                <p className="text-[13px] text-ink2">
                  Base year {data.org.baseYear}. {CONSOLIDATION_LABEL[data.org.consolidationApproach] ?? data.org.consolidationApproach}.
                </p>
              </div>
              <Link href="/organisation" className="self-center text-[13px] font-medium text-accent hover:underline">
                Review
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Product vocabulary in your language</div>
                <p className="text-[13px] text-ink2">{data.labelCount} labels customised so far — the codes underneath never change.</p>
              </div>
              <Link href="/labels" className="self-center text-[13px] font-medium text-accent hover:underline">
                Open Labels
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Sites</div>
                <p className="text-[13px] text-ink2">{data.siteCount} sites added.</p>
              </div>
              <Link href="/sites" className="self-center text-[13px] font-medium text-accent hover:underline">
                View sites
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Assets per site</div>
                <p className="text-[13px] text-ink2">
                  {data.assetCount} assets across sites — one site deliberately has none, to prove it still reaches 100% instead of getting stuck.
                </p>
              </div>
              <Link href="/sites" className="self-center text-[13px] font-medium text-accent hover:underline">
                View assets
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Emission factors loaded</div>
                <p className="text-[13px] text-ink2">{data.factorSetCount} factor sets active.</p>
              </div>
              <Link href="/factor-lab" className="self-center text-[13px] font-medium text-accent hover:underline">
                Factor Lab
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check partial={data.broken > 0} done={data.broken === 0} />
              <div className="flex-1">
                <div className="font-medium">Questionnaire built</div>
                <p className="text-[13px] text-ink2">
                  {data.templates.length > 0 ? `${data.templates.length} scope templates published.` : "No templates published."}{" "}
                  {data.broken > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-crit">
                      <AlertTriangle className="h-3.5 w-3.5" /> {data.broken} broken bindings
                    </span>
                  )}
                </p>
              </div>
              <Link href="/builder" className="self-center text-[13px] font-medium text-accent hover:underline">
                Open Builder
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check done />
              <div className="flex-1">
                <div className="font-medium">Assign and invite your teams</div>
                <p className="text-[13px] text-ink2">
                  {data.memberCount} accounts signed in, one per role. Inviting a new person isn&apos;t built yet — see Users
                  &amp; roles.
                </p>
              </div>
              <Link href="/users" className="self-center text-[13px] font-medium text-accent hover:underline">
                Users &amp; roles
              </Link>
            </div>

            <div className="flex items-start gap-3 p-4">
              <Check partial={data.startedAssignments > 0 && data.startedAssignments < data.totalAssignments} done={data.totalAssignments > 0 && data.startedAssignments === data.totalAssignments} />
              <div className="flex-1">
                <div className="font-medium">Collect, review, approve</div>
                <p className="text-[13px] text-ink2">
                  {data.startedAssignments} of {data.totalAssignments} site submissions started. Enter data, a different
                  person reviews and approves, then the period locks.
                </p>
              </div>
              <Link href="/data-collection" className="self-center text-[13px] font-medium text-accent hover:underline">
                Data Collection
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
