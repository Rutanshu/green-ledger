import type { ReactNode } from "react";

export function PlatformHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[19px] font-semibold text-white">{title}</h1>
      <p className="mt-1 text-[13px] text-[#9aa39d]">{body}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>{children}</div>;
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <div className="font-mono text-[10.5px] uppercase tracking-wide text-[#9aa39d]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold text-white">{value}</div>
      {note && <div className="mt-0.5 text-[11.5px] text-[#7a837e]">{note}</div>}
    </Card>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/10 text-left font-mono text-[10.5px] uppercase tracking-wide text-[#9aa39d]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "bg-[#4fae8c]/15 text-[#6ecda8] border-[#4fae8c]/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-white/10 text-[#c7cbc4] border-white/10";
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-medium ${toneClass}`}>{children}</span>;
}
