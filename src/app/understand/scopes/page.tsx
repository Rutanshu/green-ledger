import Link from "next/link";
import { ScopeExplorer } from "./ScopeExplorer";

export default function ScopesPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 pt-8 text-[15px] font-semibold sm:px-10">
        <Link href="/home" className="flex items-center gap-2">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-xs font-bold text-white">G</span>
          Green Ledger
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/understand" className="rounded-lg border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium hover:bg-track">
            ← Understand your reporting
          </Link>
          <Link href="/login" className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-10 lg:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Scope 1, 2, and 3 — in detail</p>
        <h1 className="mt-3 max-w-2xl text-balance text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-tight text-ink">
          Every scope, every category, explained.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink2">
          The GHG Protocol splits emissions into three scopes — and Scope 3 into fifteen categories. Here&rsquo;s what
          each one actually means, with real examples, not just the label.
        </p>

        <div className="mt-10">
          <ScopeExplorer />
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-grid pt-10 text-center">
          <Link href="/understand#checklist" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
            What a company needs to do
          </Link>
          <Link href="/understand#readiness" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
            Check your readiness
          </Link>
          <Link href="/login" className="rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white">
            Log in to start reporting
          </Link>
        </div>
      </main>
    </div>
  );
}
