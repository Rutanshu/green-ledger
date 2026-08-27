"use client";

import { useActionState } from "react";
import { stageImport } from "./actions";

interface Props {
  periods: Array<{ id: string; label: string }>;
  mappingProfiles: Array<{ id: string; name: string }>;
}

export function ImportForm({ periods, mappingProfiles }: Props) {
  const [state, formAction, pending] = useActionState(stageImport, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[11px] glass p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted">CSV file</label>
          <input name="file" type="file" accept=".csv,text/csv" required className="text-xs" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted">Reporting period</label>
          <select name="reportingPeriodId" required className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent">
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted">Mapping profile (optional)</label>
          <select name="mappingProfileId" className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent">
            <option value="">None — headers must match site_code/question_code/value/unit/data_quality</option>
            {mappingProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Staging…" : "Stage import"}
        </button>
      </div>
      {state?.ok && <p className="text-xs text-good">Staged as a dry run — review it below before committing.</p>}
      {state?.error && <p className="text-xs text-crit">{state.error}</p>}
    </form>
  );
}
