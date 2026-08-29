"use client";

import { useActionState } from "react";
import { runSbtiCalculation } from "./actions";

export function SbtiForm() {
  const [state, formAction, pending] = useActionState(runSbtiCalculation, null);

  return (
    <div className="rounded-[11px] glass p-4">
      <h2 className="text-[15px] font-semibold">SBTi near-term target</h2>
      <p className="mt-0.5 text-[13px] text-ink2">
        Absolute Contraction Approach — a straight-line reduction from base-year emissions. Leave the rate blank to
        use SBTi's published 1.5°C cross-sector minimum (4.2%/year). Sector-specific pathways can differ — treat this
        as a first-pass check, not a substitute for SBTi's own validation before submitting a real target.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            Base year
            <input
              name="baseYear"
              required
              type="number"
              placeholder="2020"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            Target year
            <input
              name="targetYear"
              required
              type="number"
              placeholder="2030"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[13px]">
          Base-year emissions (kg CO₂e)
          <input
            name="baseYearEmissionsKgCo2e"
            required
            inputMode="decimal"
            placeholder="1000000"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          Annual reduction rate (optional — defaults to the minimum-ambition rate)
          <input
            name="reductionRatePerYear"
            inputMode="decimal"
            placeholder="0.042"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Calculating…" : "Calculate"}
        </button>
        {state && !state.ok && <span className="text-[13px] text-crit">{state.error}</span>}
      </form>

      {state?.ok && (
        <div className="mt-4 rounded-[11px] border border-border bg-surface p-4 text-[13.5px]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Result</div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[13px]">
            <span>{(Number(state.reductionRatePerYear) * 100).toFixed(1)}%/year</span>
            <span className="text-muted">×</span>
            <span>{state.yearsToTarget} years</span>
            <span className="text-muted">=</span>
            <span className="font-semibold text-ink">{(Number(state.totalReductionPct) * 100).toFixed(1)}% total reduction</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[13px]">
            <span>Target-year emissions</span>
            <span className="text-muted">=</span>
            <span className="font-semibold text-ink">{Number(state.targetYearEmissionsKgCo2e).toLocaleString()} kg CO₂e</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[12px]">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                state.meetsMinimumAmbition
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {state.meetsMinimumAmbition ? "Meets minimum ambition" : "Below minimum ambition"}
            </span>
            <span className="text-ink2">
              minimum {(Number(state.minimumAmbitionRatePerYear) * 100).toFixed(1)}%/year — {state.minimumAmbitionSource}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
