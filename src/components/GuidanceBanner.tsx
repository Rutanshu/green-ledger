/**
 * Design spec (Sphera walkthrough, Part II §3): a tinted block above the
 * fields explaining the method — authored content attached to the
 * question, not hardcoded copy (CLAUDE.md rule 12). Question.helpText
 * already exists; this just gives it the visual weight the spec calls for
 * instead of a plain line of body text easy to skim past.
 */
export function GuidanceBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-accent-sky/25 bg-accent-sky/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-ink2">
      <span aria-hidden="true" className="mt-px shrink-0 text-accent-sky">
        ⓘ
      </span>
      <span>{children}</span>
    </div>
  );
}
