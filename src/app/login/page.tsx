import { quickLogin } from "./actions";
import { SignInForm } from "./SignInForm";
import { RegTimeline } from "./RegTimeline";
import { ROLE_LABEL, type Role } from "@/lib/auth/permissions";

const DEMO_ACCOUNTS: Array<{ role: Role; email: string; can: string }> = [
  { role: "SUPER_ADMIN", email: "super.admin@greenledger.demo", can: "Everything, including Organisation and Users & roles" },
  { role: "DATA_MANAGER", email: "data.manager@greenledger.demo", can: "Sites, Factor Lab, Builder, Tasks, Data Collection" },
  { role: "DATA_INPUTTER", email: "data.inputter@greenledger.demo", can: "Data Collection only" },
  { role: "READ_ONLY", email: "read.only@greenledger.demo", can: "View everywhere, no edits" },
];
const DEMO_PASSWORD = "Demo2026!";

const PILLARS = [
  {
    label: "GHG Protocol",
    title: "The accounting standard",
    body: "Scope 1 (what you burn), Scope 2 (what you buy — reported on both a location and a market basis), Scope 3 (everything in the chain around you). Every figure this product produces traces back to one of these.",
  },
  {
    label: "ESG",
    title: "The business context",
    body: "Environmental, Social, Governance — the lens investors, lenders, and customers increasingly evaluate a company through. Emissions data is usually the first hard number an ESG disclosure needs to stand up.",
  },
  {
    label: "CSRD",
    title: "The regulatory driver",
    body: "The EU's Corporate Sustainability Reporting Directive is why this stopped being optional for the companies still in scope — audited, structured, comparable disclosure under the ESRS standards.",
  },
] as const;

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-6 pt-8 text-[15px] font-semibold sm:px-10">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">
          G
        </span>
        Green Ledger
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 py-12 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:py-16">
        {/* ---------- editorial column ---------- */}
        <div className="rise">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
            GHG accounting software
          </p>
          <h1 className="mt-3 max-w-xl text-balance font-sans text-[clamp(28px,4vw,42px)] font-semibold leading-[1.1] tracking-tight text-ink">
            Every emissions number, traced back to source.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink2">
            Green Ledger turns a site's fuel bills, electricity meters, and waste manifests into a GHG Protocol
            emissions figure — and keeps the factor, the unit conversion, and the GWP value behind every number, so
            an auditor can recompute it by hand rather than take it on faith.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.label} className="glass rounded-2xl p-4">
                <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-accent-sky">
                  {p.label}
                </div>
                <div className="mt-1.5 text-[13.5px] font-semibold text-ink">{p.title}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink2">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="text-sm font-semibold text-ink">Why the rules keep moving</h2>
            <p className="mt-1 max-w-md text-[13px] text-ink2">
              CSRD's scope has changed twice in the last year. The direction — mandatory, audited, GHG Protocol–based
              disclosure — hasn't.
            </p>
            <div className="mt-6">
              <RegTimeline />
            </div>
            <p className="mt-6 max-w-md text-xs text-muted">
              Current as of the EU's Omnibus I reform, in force 18 March 2026. Not legal advice — thresholds and
              dates are still moving; confirm against your own counsel.
            </p>
          </div>
        </div>

        {/* ---------- auth column ---------- */}
        <div className="rise lg:sticky lg:top-16" style={{ animationDelay: "80ms" }}>
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-base font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-xs text-ink2">Real accounts, real passwords — use any of the four below.</p>
            <div className="mt-4">
              <SignInForm />
            </div>
          </div>

          <div className="glass mt-4 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-ink">Demo accounts — one per role</h3>
            <p className="mt-1 text-xs text-ink2">
              Same password for all four: <code className="rounded bg-track px-1.5 py-0.5 font-mono">{DEMO_PASSWORD}</code>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.role} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-plane/40 p-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink">{ROLE_LABEL[a.role]}</div>
                    <div className="truncate font-mono text-[11px] text-ink2">{a.email}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{a.can}</div>
                  </div>
                  <form action={quickLogin.bind(null, a.role)}>
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-track"
                    >
                      Continue
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>

          <div className="glass mt-4 rounded-2xl p-4 text-xs text-ink2">
            <span className="font-semibold text-ink">Heads up:</span> these four accounts are shared demo logins, not
            personal ones — anyone with this link can sign in as any of them. Real per-person accounts (invite flow,
            your own password) aren&rsquo;t built yet.
          </div>
        </div>
      </main>
    </div>
  );
}
