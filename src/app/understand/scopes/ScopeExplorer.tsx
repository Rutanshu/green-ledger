"use client";

import { useState } from "react";
import { SCOPES } from "./content";

export function ScopeExplorer() {
  const [activeScope, setActiveScope] = useState(0);
  const [activeCategory, setActiveCategory] = useState(0);

  const scope = SCOPES[activeScope];

  return (
    <div>
      {/* ---------- scope tabs ---------- */}
      <div className="flex gap-2">
        {SCOPES.map((s, i) => (
          <button
            key={s.n}
            onClick={() => {
              setActiveScope(i);
              setActiveCategory(0);
            }}
            className={`flex-1 rounded-2xl border px-4 py-3 text-left transition-colors ${
              i === activeScope
                ? "border-accent bg-accent/10"
                : "border-border bg-surface/50 hover:bg-surface"
            }`}
          >
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-accent">{s.label}</div>
            <div className="mt-0.5 text-[13px] font-semibold text-ink">{s.short}</div>
          </button>
        ))}
      </div>

      {/* ---------- sliding track ---------- */}
      <div className="relative mt-6 overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${SCOPES.length * 100}%`, transform: `translateX(-${(100 / SCOPES.length) * activeScope}%)` }}
        >
          {SCOPES.map((s) => (
            <div key={s.n} style={{ width: `${100 / SCOPES.length}%` }} className="px-0.5">
              <div className="glass-strong rounded-2xl p-6">
                <h3 className="text-[19px] font-semibold text-ink">{s.label}</h3>
                <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink2">{s.intro}</p>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {s.points.map((p) => (
                    <div key={p.title} className="glass rounded-xl p-4">
                      <div className="text-[13.5px] font-semibold text-ink">{p.title}</div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{p.body}</p>
                    </div>
                  ))}
                </div>

                {s.categories && (() => {
                  const categories = s.categories!;
                  return (
                  <div className="mt-7 border-t border-border pt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                        The 15 categories — {activeCategory + 1} of {categories.length}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          aria-label="Previous category"
                          onClick={() => setActiveCategory((c) => (c - 1 + categories.length) % categories.length)}
                          className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface hover:bg-track"
                        >
                          ←
                        </button>
                        <button
                          aria-label="Next category"
                          onClick={() => setActiveCategory((c) => (c + 1) % categories.length)}
                          className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface hover:bg-track"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-4 overflow-hidden rounded-xl">
                      <div
                        className="flex transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{
                          width: `${categories.length * 100}%`,
                          transform: `translateX(-${(100 / categories.length) * activeCategory}%)`,
                        }}
                      >
                        {categories.map((c) => (
                          <div key={c.code} style={{ width: `${100 / categories.length}%` }} className="px-0.5">
                            <div className="glass rounded-xl p-5">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-[11px] font-semibold text-accent-sky">3.{c.n}</span>
                                <span className="text-[14.5px] font-semibold text-ink">{c.title}</span>
                              </div>
                              <p className="mt-2 text-[13px] leading-relaxed text-ink2">{c.body}</p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {c.examples.map((ex) => (
                                  <span key={ex} className="rounded-full bg-track px-2 py-0.5 text-[11px] text-ink2">
                                    {ex}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center gap-1.5">
                      {categories.map((c, i) => (
                        <button
                          key={c.code}
                          aria-label={`Go to category ${i + 1}`}
                          onClick={() => setActiveCategory(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === activeCategory ? "w-5 bg-accent" : "w-1.5 bg-border"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
