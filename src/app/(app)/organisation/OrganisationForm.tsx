"use client";

import { useActionState } from "react";
import { updateOrganisation } from "./actions";
import { CONSOLIDATION_LABEL } from "@/lib/org/consolidationLabel";

interface Props {
  legalName: string;
  consolidationApproach: string;
  baseYear: number | null;
  baseYearRationale: string;
  fiscalYearStartMonth: number;
  locale: string;
}

export function OrganisationForm(props: Props) {
  const [state, formAction, pending] = useActionState(updateOrganisation, null);

  return (
    <form action={formAction} className="mt-5 flex max-w-lg flex-col gap-3 rounded-[11px] glass p-4">
      <label className="flex flex-col gap-1 text-[13px]">
        Legal name
        <input
          name="legalName"
          defaultValue={props.legalName}
          required
          className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        How you count shared sites
        <select
          name="consolidationApproach"
          defaultValue={props.consolidationApproach}
          className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
        >
          {Object.entries(CONSOLIDATION_LABEL).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          Base year
          <input
            name="baseYear"
            type="number"
            defaultValue={props.baseYear ?? ""}
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          Fiscal year starts (month)
          <input
            name="fiscalYearStartMonth"
            type="number"
            min={1}
            max={12}
            defaultValue={props.fiscalYearStartMonth}
            required
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px]">
        Base year rationale
        <textarea
          name="baseYearRationale"
          defaultValue={props.baseYearRationale}
          rows={2}
          className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Locale
        <input
          name="locale"
          defaultValue={props.locale}
          required
          className="w-32 rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
        />
      </label>
      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.ok && <span className="text-[13px] text-good">Saved.</span>}
        {state?.error && <span className="text-[13px] text-crit">{state.error}</span>}
      </div>
    </form>
  );
}
