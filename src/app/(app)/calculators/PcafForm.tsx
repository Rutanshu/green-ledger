"use client";

import { useActionState, useState } from "react";
import { runPcafCalculation } from "./actions";

export function PcafForm() {
  const [state, formAction, pending] = useActionState(runPcafCalculation, null);
  const [assetClass, setAssetClass] = useState<"LISTED_EQUITY_CORPORATE_BONDS" | "BUSINESS_LOANS">("LISTED_EQUITY_CORPORATE_BONDS");

  return (
    <div className="rounded-[11px] glass p-4">
      <h2 className="text-[15px] font-semibold">PCAF financed emissions</h2>
      <p className="mt-0.5 text-[13px] text-ink2">
        Attribution factor × investee emissions, per the PCAF Global GHG Accounting and Reporting Standard for the
        Financial Industry. Covers listed equity/corporate bonds and business loans in this version.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          Asset class
          <select
            name="assetClass"
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value as typeof assetClass)}
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            <option value="LISTED_EQUITY_CORPORATE_BONDS">Listed equity / corporate bonds</option>
            <option value="BUSINESS_LOANS">Business loans</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          Outstanding amount
          <input
            name="outstandingAmount"
            required
            inputMode="decimal"
            placeholder="1000000"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>

        {assetClass === "LISTED_EQUITY_CORPORATE_BONDS" ? (
          <label className="flex flex-col gap-1 text-[13px]">
            EVIC (enterprise value including cash)
            <input
              name="evic"
              required
              inputMode="decimal"
              placeholder="10000000"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[13px]">
              Total equity
              <input
                name="totalEquity"
                required
                inputMode="decimal"
                placeholder="5000000"
                className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              Total debt
              <input
                name="totalDebt"
                required
                inputMode="decimal"
                placeholder="5000000"
                className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1 text-[13px]">
          Investee's total emissions (kg CO₂e)
          <input
            name="investeeEmissionsKgCo2e"
            required
            inputMode="decimal"
            placeholder="500000"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          Data quality score (1 best – 5 worst, optional)
          <input
            name="dataQualityScore"
            inputMode="numeric"
            placeholder="3"
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
            <span>Attribution factor</span>
            <span className="text-muted">=</span>
            <span className="font-semibold text-ink">{Number(state.attributionFactor).toFixed(6)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[13px]">
            <span>Financed emissions</span>
            <span className="text-muted">=</span>
            <span className="font-semibold text-ink">
              {Number(state.financedEmissionsKgCo2e).toLocaleString()} kg CO₂e
            </span>
          </div>
          <div className="mt-2.5 text-[12px] text-ink2">Denominator used: {Number(state.denominatorUsed).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
