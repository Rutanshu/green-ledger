/**
 * The single most important element on a calculated-value screen: every
 * computed number states when it was calculated. Every field rendered
 * here already exists on EmissionRecord (CLAUDE.md rule 2); this only
 * formats, never computes.
 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalculatedFooter({
  calculatedAt,
  engineVersion,
  detail,
}: {
  calculatedAt: string;
  engineVersion?: string;
  /** Shown as a native tooltip — quantity/factor/GWP trail, when the caller has it to hand. */
  detail?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted" title={detail}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">
        Calculated: {formatTimestamp(calculatedAt)}
      </span>
      {engineVersion && <span className="font-mono">· engine v{engineVersion}</span>}
    </div>
  );
}
