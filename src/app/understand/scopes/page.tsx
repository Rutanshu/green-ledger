import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ScopeExplorer } from "./ScopeExplorer";

export default function ScopesPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-10 lg:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Scope 1, 2, and 3 — in detail</p>
        <h1 className="mt-3 max-w-2xl text-balance text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-tight text-ink">
          Every scope, every category, explained.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink2">
          The GHG Protocol splits emissions into three scopes — and Scope 3 into fifteen categories. Here&rsquo;s what
          each one actually means, with real examples, not just the label. Prefer a dedicated page per scope?{" "}
          <Link href="/understand/topics" className="font-semibold text-accent hover:underline">
            See them individually →
          </Link>
        </p>

        <div className="mt-10">
          <ScopeExplorer />
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-grid pt-10 text-center">
          <Link href="/understand/topics/whats-next" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
            What's next after Scope 1, 2 & 3
          </Link>
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

      <Footer />
    </div>
  );
}
