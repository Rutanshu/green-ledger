import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { NEXT_TOPICS } from "../whatsNextContent";

export default function WhatsNextPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-10 lg:py-16">
        <Link href="/understand/topics" className="text-[13px] font-medium text-ink2 hover:text-ink hover:underline">
          ← All topics
        </Link>

        <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-wider text-accent">What's next</p>
        <h1 className="mt-3 max-w-2xl text-balance text-[clamp(28px,4vw,42px)] font-semibold leading-[1.1] tracking-tight text-ink">
          Beyond Scope 1, 2, and 3.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink2">
          Emissions accounting is the foundation, not the finish line. These are the topics showing up next in
          sustainability reporting — some already required for specific products, some still voluntary, all built on
          the same discipline: traceable data, defined boundaries, independent review.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NEXT_TOPICS.map((t, i) => (
            <div key={t.slug} className="glass-strong rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="rounded-full bg-track px-2 py-0.5 text-[10.5px] font-medium text-ink2">{t.tag}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold text-ink">{t.title}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink2">{t.body}</p>
              <div className="mt-3 border-t border-border/60 pt-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-accent-sky">Why it connects here</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{t.why}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface p-5 text-[13px] text-muted">
          None of these are built into Green Ledger today — Scope 1, 2, and 3 emissions accounting is. This page is
          here so the direction of travel is clear, not to claim a feature that doesn&rsquo;t exist yet.
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-grid pt-10 text-center">
          <Link href="/understand/topics/scope-3" className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[13.5px] font-medium hover:bg-track">
            Back to Scope 3
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
