"use client";

import { useState, useActionState } from "react";
import { generateReport } from "./actions";

interface Period {
  id: string;
  label: string;
  status: string;
}
interface Site {
  id: string;
  name: string;
  code: string;
}

export function ReportWizardForm({ periods, sites }: { periods: Period[]; sites: Site[] }) {
  const [state, formAction, pending] = useActionState(generateReport, null);
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set(sites.map((s) => s.id)));
  const [format, setFormat] = useState<"JSON" | "CSV">("JSON");

  const toggleSite = (id: string) => {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needsAcknowledgement = state && !state.ok && state.needsAcknowledgement;

  return (
    <form action={formAction} className="mt-5 flex max-w-2xl flex-col gap-4 rounded-[11px] glass p-4">
      <label className="flex flex-col gap-1 text-[13px]">
        Reporting period
        <select
          name="reportingPeriodId"
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.status.toLowerCase()})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5 text-[13px]">
        <span>Facilities</span>
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] ${
                selectedSites.has(s.id) ? "border-accent bg-track" : "border-border bg-surface"
              }`}
            >
              <input
                type="checkbox"
                name="siteIds"
                value={s.id}
                checked={selectedSites.has(s.id)}
                onChange={() => toggleSite(s.id)}
                className="accent-accent"
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px]">
        <span>Format</span>
        <div className="flex gap-2">
          {(["JSON", "CSV"] as const).map((f) => (
            <label
              key={f}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] ${
                format === f ? "border-accent bg-track" : "border-border bg-surface"
              }`}
            >
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="accent-accent" />
              {f}
            </label>
          ))}
        </div>
      </div>

      {needsAcknowledgement && <input type="hidden" name="acknowledgeWarnings" value="true" />}

      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          disabled={pending || selectedSites.size === 0}
          className="self-start rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Generating…" : needsAcknowledgement ? "Generate anyway" : "Generate report"}
        </button>
        {state && !state.ok && <span className="text-[13px] text-crit">{state.error}</span>}
      </div>

      {state?.ok && (
        <div className="mt-2 rounded-[11px] border border-good bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[15px] font-semibold text-good">Report generated</div>
            <div className="flex gap-2">
              <a
                href={`/reports/${state.reportId}/export?format=csv`}
                className="rounded-md border border-border bg-plane px-2.5 py-1 text-xs font-medium hover:bg-track"
              >
                Download CSV
              </a>
              <a
                href={`/reports/${state.reportId}/export?format=json`}
                className="rounded-md border border-border bg-plane px-2.5 py-1 text-xs font-medium hover:bg-track"
              >
                Download JSON
              </a>
            </div>
          </div>
          <div className="mt-3 text-[24px] font-semibold tracking-tight">
            {state.figuresSnapshot.totalTonnes} <span className="text-sm font-medium text-ink2">tCO2e</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
            {Object.entries(state.figuresSnapshot.byScope).map(([scope, kg]) => (
              <div key={scope} className="rounded-md border border-border bg-plane p-2.5">
                <div className="text-[11px] uppercase tracking-wide text-muted">{scope.replace("_", " ")}</div>
                <div className="font-medium">{(Number(kg) / 1000).toFixed(2)} t</div>
              </div>
            ))}
          </div>
          {state.figuresSnapshot.bySite.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 text-[13px]">
              {state.figuresSnapshot.bySite.map((s) => (
                <div key={s.siteId} className="flex justify-between">
                  <span className="text-ink2">{s.siteName}</span>
                  <span className="font-medium">{(Number(s.kgCo2e) / 1000).toFixed(2)} t</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
