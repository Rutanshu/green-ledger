import Link from "next/link";

const PILLARS = [
  { n: "01", title: "Enter it once", body: "A fuel bill, a meter reading — walked through one step at a time, not a spreadsheet to fill in blind." },
  { n: "02", title: "Trace it back", body: "Every figure keeps its factor, its unit conversion, and its warming-potential value. Nothing is a black box." },
  { n: "03", title: "Report it straight", body: "Scope 1, 2, and 3, by facility and by category — an assurer can recompute it by hand." },
] as const;

const AUDIENCES = [
  { role: "New to this", body: "Start with what GHG reporting actually involves and where you likely stand.", href: "/understand", cta: "Understand your reporting" },
  { role: "Know the basics", body: "Go deep on Scope 1, 2, and 3 — all fifteen Scope 3 categories, explained with real examples.", href: "/understand/scopes", cta: "Explore Scope 1, 2 & 3" },
  { role: "Ready to report", body: "Sign in and start entering data — guided, one item at a time.", href: "/login", cta: "Sign in" },
] as const;

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 pt-8 text-[15px] font-semibold sm:px-10">
        <div className="flex items-center gap-2">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">G</span>
          Green Ledger
        </div>
        <div className="flex items-center gap-2">
          <Link href="/understand" className="hidden rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-ink2 hover:bg-track sm:inline-block">
            Understand your reporting
          </Link>
          <Link href="/login" className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium hover:bg-track">
            Sign in
          </Link>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:px-10 lg:pt-24">
        <div className="rise mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">GHG accounting software</p>
          <h1 className="mt-4 text-balance text-[clamp(32px,5.5vw,54px)] font-semibold leading-[1.05] tracking-tight text-ink">
            Every emissions number, traced back to source.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink2">
            Green Ledger turns a site&rsquo;s fuel bills, electricity meters, and waste manifests into a GHG
            Protocol emissions figure — and keeps the factor, the unit conversion, and the warming-potential value
            behind every number, so an auditor can recompute it by hand rather than take it on faith.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/understand" className="rounded-lg bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
              Understand your sustainability reporting
            </Link>
            <Link href="/login" className="rounded-lg border border-border bg-surface px-5 py-2.5 text-[14px] font-medium hover:bg-track">
              Sign in
            </Link>
          </div>
        </div>

        {/* ---------- three pillars ---------- */}
        <div className="rise mt-16 grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ animationDelay: "80ms" }}>
          {PILLARS.map((p) => (
            <div key={p.n} className="glass rounded-2xl p-5">
              <div className="font-mono text-[11px] font-semibold text-accent">{p.n}</div>
              <div className="mt-1.5 text-[14.5px] font-semibold text-ink">{p.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{p.body}</p>
            </div>
          ))}
        </div>

        {/* ---------- where do you start ---------- */}
        <div className="mt-20">
          <h2 className="text-center text-[13px] font-semibold uppercase tracking-wide text-muted">Where do you want to start?</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <Link key={a.role} href={a.href} className="glass-strong group flex flex-col rounded-2xl p-6 transition-transform hover:-translate-y-1">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-accent-sky">{a.role}</div>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink2">{a.body}</p>
                <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  {a.cta}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
