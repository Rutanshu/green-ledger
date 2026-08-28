import Link from "next/link";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/understand", label: "Understand your reporting" },
      { href: "/understand#readiness", label: "Check your readiness" },
      { href: "/understand#checklist", label: "What a company needs to do" },
      { href: "/understand#omnibus", label: "The Omnibus Package" },
    ],
  },
  {
    title: "Topics",
    links: [
      { href: "/understand/topics/scope-1", label: "Scope 1" },
      { href: "/understand/topics/scope-2", label: "Scope 2" },
      { href: "/understand/topics/scope-3", label: "Scope 3" },
      { href: "/understand/topics/whats-next", label: "What's next" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/home", label: "Home" },
      { href: "/login", label: "Sign in" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="grid h-[20px] w-[20px] place-items-center rounded-md bg-accent text-[10px] font-bold text-white">G</span>
              Green Ledger
            </div>
            <p className="mt-2.5 max-w-[22ch] text-[12px] leading-relaxed text-ink2">
              Every emissions number, traced back to source.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{col.title}</div>
              <ul className="mt-2.5 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[12.5px] text-ink2 hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-6 text-[11.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Green Ledger. A GHG accounting demo.</span>
          <span>Not legal advice — regulatory content confirmed against your own counsel.</span>
        </div>
      </div>
    </footer>
  );
}
