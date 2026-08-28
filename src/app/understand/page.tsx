import Link from "next/link";
import { RegTimeline } from "../login/RegTimeline";
import { ReadinessQuestionnaire } from "./ReadinessQuestionnaire";

const PROCESS_STEPS = [
  { n: 1, title: "Set up your company", body: "Base year, consolidation approach, fiscal calendar — the decisions every later number depends on." },
  { n: 2, title: "Identify what applies to you", body: "Not every company answers every question. The platform only asks what's relevant to your facilities." },
  { n: 3, title: "Add your facilities", body: "Each site, and what's inside it — boilers, vehicles, chillers, servers." },
  { n: 4, title: "Collect data", body: "Plain-language questions, one at a time — a fuel bill, a meter reading, an invoice." },
  { n: 5, title: "Review and approve", body: "A different person checks the numbers before they're used in anything — four eyes, always." },
  { n: 6, title: "Calculate", body: "Every answer is matched to a published emission factor and converted with full traceability." },
  { n: 7, title: "Report", body: "A disclosure an assurer can recompute by hand — every figure traces back to its source." },
  { n: 8, title: "Track improvements", body: "Year over year, the same structure — so progress is comparable, not just reported." },
] as const;

const OMNIBUS_CARDS = [
  {
    title: "What changed",
    body: "Omnibus I raised the CSRD thresholds sharply — from roughly 50,000 companies EU-wide in scope down to about 5,000. It also delayed the second and third reporting waves by two years, and a simplified ESRS standard is expected to lighten what's actually disclosed.",
  },
  {
    title: "Who's affected",
    body: "Companies over 1,000 employees and €450m turnover stay in scope directly. Smaller companies can still be pulled in indirectly — as a subsidiary of an in-scope group, or as a major supplier an in-scope customer asks for data.",
  },
  {
    title: "What to prepare",
    body: "Even outside direct scope, the direction of travel is the same: structured, auditable, GHG Protocol–based emissions data. Getting the collection process right now costs less than doing it under deadline pressure later.",
  },
  {
    title: "What's still unconfirmed",
    body: "The simplified ESRS standard hasn't been finalised. Thresholds have already moved twice in two years. Treat specific numbers as the current best understanding, not a fixed target.",
  },
] as const;

const RESPONSIBILITIES = [
  { title: "Pick a reporting period", body: "A fiscal year, consistently applied — the frame every later number sits inside." },
  { title: "Set your boundaries", body: "Which entities, which ownership share, counted which way (operational control, financial control, or equity share)." },
  { title: "List your facilities", body: "Every site that does something — burns fuel, buys electricity, generates waste." },
  { title: "Identify your emission sources", body: "What's actually happening at each site: a boiler, a fleet, a refrigerant top-up, a purchased-electricity bill." },
  { title: "Assign responsible people", body: "Who owns the data at each site, who reviews it, who approves it — named, not assumed." },
  { title: "Collect the data", body: "Real invoices, real meter readings — not estimates dressed up as measurements." },
  { title: "Check data quality", body: "Flag what's estimated versus measured. An assurer will ask." },
  { title: "Approve before it's final", body: "A different person from whoever entered it — four-eyes, every time." },
  { title: "Produce the report", body: "The disclosure itself — Scope 1/2/3, by facility, by category, with methodology attached." },
  { title: "Keep the audit trail", body: "Every change, every approval, every correction — who, when, why." },
] as const;

const STRUCTURE = [
  { title: "Company", body: "The legal entity or group reporting — its base year, consolidation approach, and fiscal calendar." },
  { title: "Reporting Period", body: "A fiscal year. Locked once approved; corrections after that go through a restatement, not a silent edit." },
  { title: "Facilities", body: "Every site — an office, a plant, a warehouse, a data centre — each with its own emission sources." },
  { title: "Emission Sources", body: "What's actually happening at a site: a boiler burning gas, a fleet of vans, a chiller topped up with refrigerant." },
  { title: "Data Entries", body: "The real numbers — a fuel bill, a meter reading — entered against a source, for a period." },
  { title: "Review", body: "A second person checks the entry before it counts toward anything." },
  { title: "Approval", body: "Formal sign-off. Four-eyes enforced — whoever entered it can't be the one who approves it." },
  { title: "Reports", body: "The output: Scope 1/2/3 broken down by facility and category, methodology attached, every figure traceable." },
] as const;

export default function UnderstandPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 pt-8 text-[15px] font-semibold sm:px-10">
        <Link href="/home" className="flex items-center gap-2">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">G</span>
          Green Ledger
        </Link>
        <Link href="/login" className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium hover:bg-track">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:py-16">
        {/* ---------- A: what this is ---------- */}
        <section id="basics" className="rise">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Understand your sustainability reporting</p>
          <h1 className="mt-3 max-w-xl text-balance text-[clamp(28px,4vw,42px)] font-semibold leading-[1.1] tracking-tight text-ink">
            What GHG reporting actually involves, before you start.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink2">
            Green Ledger turns a site's fuel bills, electricity meters, and waste manifests into a GHG Protocol
            emissions figure — with the factor, the unit conversion, and the warming-potential value behind every
            number kept, so an auditor can recompute it by hand.
          </p>

          <Link
            href="/understand/scopes"
            className="glass-strong mt-8 flex items-center justify-between gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <div>
              <div className="text-[13.5px] font-semibold text-ink">Want the detail behind Scope 1, 2, and 3?</div>
              <p className="mt-0.5 text-[12.5px] text-ink2">All fifteen Scope 3 categories, explained with real examples.</p>
            </div>
            <span className="whitespace-nowrap text-[13px] font-semibold text-accent">Explore scopes →</span>
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROCESS_STEPS.map((s) => (
              <div key={s.n} className="glass rounded-xl p-3.5">
                <div className="font-mono text-[11px] font-semibold text-accent">{s.n}</div>
                <div className="mt-1 text-[13px] font-semibold text-ink">{s.title}</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink2">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- B: Omnibus deep-dive ---------- */}
        <section id="omnibus" className="mt-16">
          <h2 className="text-xl font-semibold text-ink">Go deeper into the Omnibus Package</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-ink2">
            CSRD's scope has changed twice in the last year. The direction — mandatory, audited, GHG Protocol–based
            disclosure — hasn't.
          </p>
          <div className="mt-6">
            <RegTimeline />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {OMNIBUS_CARDS.map((c) => (
              <div key={c.title} className="glass rounded-xl p-4">
                <div className="text-[13.5px] font-semibold text-ink">{c.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-md text-xs text-muted">
            Current as of the EU&rsquo;s Omnibus I reform, in force 18 March 2026. Not legal advice — thresholds and
            dates are still moving; confirm against your own counsel.
          </p>
        </section>

        {/* ---------- B2: readiness questionnaire ---------- */}
        <section id="readiness" className="mt-16">
          <h2 className="text-xl font-semibold text-ink">Check your readiness</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-ink2">
            Nine questions, no sign-in needed. A plain-language read on where you likely stand — not a legal
            determination.
          </p>
          <div className="mt-6">
            <ReadinessQuestionnaire />
          </div>
        </section>

        {/* ---------- C: responsibilities checklist ---------- */}
        <section id="checklist" className="mt-16">
          <h2 className="text-xl font-semibold text-ink">What a company needs to do</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-ink2">Ten things, in the order they usually happen.</p>
          <ol className="mt-6 flex flex-col gap-2.5">
            {RESPONSIBILITIES.map((r, i) => (
              <li key={r.title} className="glass flex gap-3 rounded-xl p-3.5">
                <span className="font-mono text-[11px] font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{r.title}</div>
                  <p className="mt-0.5 text-[12.5px] text-ink2">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- D: platform structure ---------- */}
        <section id="structure" className="mt-16">
          <h2 className="text-xl font-semibold text-ink">How the platform is structured</h2>
          <p className="mt-1.5 max-w-lg text-[14px] text-ink2">
            This isn&rsquo;t a hypothetical model — it&rsquo;s the actual chain your data moves through.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {STRUCTURE.map((s, i) => (
              <details key={s.title} className="glass group rounded-xl p-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-semibold text-ink">
                  <span>
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-muted group-open:rotate-90">→</span>
                </summary>
                <p className="mt-2 text-[12.5px] text-ink2">{s.body}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- E: end actions ---------- */}
        <section className="mt-16 border-t border-grid pt-10 text-center">
          <h2 className="text-lg font-semibold text-ink">Where next?</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a href="#basics" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
              Learn the basics
            </a>
            <a href="#readiness" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
              Check your readiness
            </a>
            <Link href="/login" className="rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white">
              Log in to start reporting
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
