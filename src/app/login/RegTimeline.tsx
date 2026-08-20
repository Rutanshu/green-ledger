const EVENTS = [
  {
    year: "2022",
    title: "CSRD adopted",
    body: "The EU's Corporate Sustainability Reporting Directive replaces the older NFRD, bringing detailed sustainability disclosure — including GHG emissions — into scope for large companies.",
  },
  {
    year: "Apr 2025",
    title: "“Stop-the-clock”",
    body: "Reporting for the second and third waves of companies is pushed back two years, to FY2027 and FY2028, while the Commission reworks the rules.",
  },
  {
    year: "Mar 2026",
    title: "Omnibus I narrows scope",
    body: "Enters into force 18 March 2026. Coverage tightens to companies over 1,000 employees and €450m turnover — roughly 5,000 companies EU-wide, down from about 50,000.",
  },
  {
    year: "FY2027",
    title: "Simplified ESRS apply",
    body: "A simplified reporting standard is expected before Q4 2026, applying from FY2027 with optional early adoption for FY2026.",
  },
] as const;

export function RegTimeline() {
  return (
    <ol className="relative flex flex-col gap-6 border-l border-border pl-6">
      {EVENTS.map((e) => (
        <li key={e.year} className="relative">
          <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-plane" />
          <div className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">{e.year}</div>
          <div className="mt-0.5 text-sm font-semibold text-ink">{e.title}</div>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink2">{e.body}</p>
        </li>
      ))}
    </ol>
  );
}
