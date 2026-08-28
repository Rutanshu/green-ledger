import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SCOPES } from "../scopes/content";
import { NEXT_TOPICS } from "./whatsNextContent";

export default function TopicsIndexPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-10 lg:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Topics</p>
        <h1 className="mt-3 max-w-2xl text-balance text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-tight text-ink">
          Every topic, one page each.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink2">
          The three scopes in the GHG Protocol, and what's coming after them — each with its own page you can link
          to directly.
        </p>

        <h2 className="mb-3 mt-10 text-[13px] font-semibold uppercase tracking-wide text-muted">The three scopes</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCOPES.map((s) => (
            <Link key={s.n} href={`/understand/topics/scope-${s.n}`} className="glass-strong group flex flex-col rounded-2xl p-5 transition-transform hover:-translate-y-1">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">{s.label}</div>
              <div className="mt-1.5 text-[14.5px] font-semibold text-ink">{s.short}</div>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-ink2">{s.intro}</p>
              <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                Read more
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="mb-3 mt-10 text-[13px] font-semibold uppercase tracking-wide text-muted">What's next</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/understand/topics/whats-next" className="glass-strong group col-span-full flex items-center justify-between gap-3 rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
            <div>
              <div className="text-[14.5px] font-semibold text-ink">Beyond emissions reporting</div>
              <p className="mt-1 text-[12.5px] text-ink2">
                Life Cycle Assessment, Digital Product Passports, Renewable Energy Certificates, CBAM, and more —
                {" "}
                {NEXT_TOPICS.length} topics on the horizon.
              </p>
            </div>
            <span className="whitespace-nowrap text-[13px] font-semibold text-accent">See all →</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
