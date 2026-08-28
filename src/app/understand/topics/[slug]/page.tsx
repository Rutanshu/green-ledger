import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SCOPES } from "../../scopes/content";

export function generateStaticParams() {
  return SCOPES.map((s) => ({ slug: `scope-${s.n}` }));
}

export default async function ScopeTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scope = SCOPES.find((s) => `scope-${s.n}` === slug);
  if (!scope) notFound();

  const otherScopes = SCOPES.filter((s) => s.n !== scope.n);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-10 lg:py-16">
        <Link href="/understand/topics" className="text-[13px] font-medium text-ink2 hover:text-ink hover:underline">
          ← All topics
        </Link>

        <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-wider text-accent">{scope.label}</p>
        <h1 className="mt-3 max-w-xl text-balance text-[clamp(28px,4vw,42px)] font-semibold leading-[1.1] tracking-tight text-ink">
          {scope.short}
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink2">{scope.intro}</p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scope.points.map((p) => (
            <div key={p.title} className="glass rounded-2xl p-4">
              <div className="text-[13.5px] font-semibold text-ink">{p.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{p.body}</p>
            </div>
          ))}
        </div>

        {scope.categories && (
          <>
            <h2 className="mb-3 mt-10 text-[13px] font-semibold uppercase tracking-wide text-muted">
              The fifteen Scope 3 categories
            </h2>
            <div className="flex flex-col gap-2.5">
              {scope.categories.map((c) => (
                <div key={c.code} className="glass rounded-xl p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] font-semibold text-accent-sky">3.{c.n}</span>
                    <span className="text-[14px] font-semibold text-ink">{c.title}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{c.body}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {c.examples.map((ex) => (
                      <span key={ex} className="rounded-full bg-track px-2 py-0.5 text-[11px] text-ink2">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-12 border-t border-grid pt-8">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">Other scopes</div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {otherScopes.map((s) => (
              <Link
                key={s.n}
                href={`/understand/topics/scope-${s.n}`}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:bg-track"
              >
                {s.label}: {s.short} →
              </Link>
            ))}
            <Link
              href="/understand/topics/whats-next"
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:bg-track"
            >
              What's next →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
