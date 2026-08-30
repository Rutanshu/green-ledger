"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface SiteTotal {
  siteId: string;
  siteName: string;
  kgCo2e: string;
}
export interface FiguresSnapshot {
  totalKgCo2e: string;
  totalTonnes: string;
  byScope: Record<string, string>;
  byScope3Category: Record<string, string>;
  bySite: SiteTotal[];
  byScopeAndSite?: { SCOPE_1: SiteTotal[]; SCOPE_2: SiteTotal[]; SCOPE_3: SiteTotal[] };
}

const SCOPE_LABEL: Record<string, string> = { SCOPE_1: "Scope 1", SCOPE_2: "Scope 2", SCOPE_3: "Scope 3" };
const SCOPE_COLOR: Record<string, string> = {
  SCOPE_1: "var(--chart-scope-1)",
  SCOPE_2: "var(--chart-scope-2)",
  SCOPE_3: "var(--chart-scope-3)",
};
const tonnes = (kg: string | number) => Number(kg) / 1000;

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[11px] glass p-4">
      <div className="text-[13px] font-semibold">{title}</div>
      {subtitle && <div className="text-[11.5px] text-muted">{subtitle}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      fontSize: 12.5,
      color: "var(--ink)",
    },
    labelStyle: { color: "var(--ink2)" },
    formatter: (value: unknown) => [`${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e`, ""],
  };
}

/** A single-series bar chart of facility totals for one scope — bars carry
 * the scope's color, everything else (axes, grid, text) stays in text
 * tokens per the dataviz skill: "text never wears the data color." */
function ScopeBarChart({ scope, rows }: { scope: string; rows: SiteTotal[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-muted">No {SCOPE_LABEL[scope]} answers yet.</p>;
  }
  const data = rows.map((r) => ({ name: r.siteName, tCO2e: tonnes(r.kgCo2e) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" strokeDasharray="0" />
        <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} axisLine={{ stroke: "var(--grid)" }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: "var(--ink2)", fontSize: 12 }}
          axisLine={{ stroke: "var(--grid)" }}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle()} cursor={{ fill: "var(--track)" }} />
        <Bar dataKey="tCO2e" fill={SCOPE_COLOR[scope]} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportCharts({ figures }: { figures: FiguresSnapshot }) {
  const pieData = (["SCOPE_1", "SCOPE_2", "SCOPE_3"] as const)
    .map((scope) => ({ scope, name: SCOPE_LABEL[scope], value: tonnes(figures.byScope[scope] ?? "0") }))
    .filter((d) => d.value > 0);

  // Every Scope 3 category 3.1–3.15 gets a bar, zero-filled — a category
  // with real activity but nothing answered yet reads as "0", not as
  // absent, which is the honest signal for a mostly-unanswered scope.
  const scope3Data = Array.from({ length: 15 }, (_, i) => i + 1).map((cat) => ({
    name: `3.${cat}`,
    tCO2e: tonnes(figures.byScope3Category[String(cat)] ?? "0"),
  }));
  const hasScope3 = scope3Data.some((d) => d.tCO2e > 0);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="rounded-[11px] glass p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total emissions</div>
        <div className="mt-1 text-[32px] font-semibold tracking-tight">
          {figures.totalTonnes} <span className="text-[14px] font-medium text-ink2">tCO2e</span>
        </div>
      </div>

      <ChartCard title="Emissions by scope">
        {pieData.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-muted">No calculated emissions yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={92} paddingAngle={2} strokeWidth={2} stroke="var(--surface)">
                {pieData.map((d) => (
                  <Cell key={d.scope} fill={SCOPE_COLOR[d.scope]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle()} />
              <Legend
                verticalAlign="bottom"
                height={28}
                formatter={(value) => <span style={{ color: "var(--ink2)", fontSize: 12.5 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title="Scope 1 by facility" subtitle="Direct emissions">
          <ScopeBarChart scope="SCOPE_1" rows={figures.byScopeAndSite?.SCOPE_1 ?? []} />
        </ChartCard>
        <ChartCard title="Scope 2 by facility" subtitle="Purchased energy">
          <ScopeBarChart scope="SCOPE_2" rows={figures.byScopeAndSite?.SCOPE_2 ?? []} />
        </ChartCard>
        <ChartCard title="Scope 3 by facility" subtitle="Value chain">
          <ScopeBarChart scope="SCOPE_3" rows={figures.byScopeAndSite?.SCOPE_3 ?? []} />
        </ChartCard>
      </div>

      <ChartCard title="Scope 3 by category" subtitle="3.1 – 3.15">
        {!hasScope3 ? (
          <p className="py-6 text-center text-[12.5px] text-muted">No Scope 3 answers yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scope3Data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barCategoryGap={6}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10.5 }} axisLine={{ stroke: "var(--grid)" }} tickLine={false} interval={0} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} axisLine={{ stroke: "var(--grid)" }} tickLine={false} />
              <Tooltip {...tooltipStyle()} cursor={{ fill: "var(--track)" }} />
              <Bar dataKey="tCO2e" fill={SCOPE_COLOR.SCOPE_3} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
