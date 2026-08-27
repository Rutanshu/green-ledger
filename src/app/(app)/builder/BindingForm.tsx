"use client";

import { useActionState, useState } from "react";
import { upsertBinding } from "./actions";
import { labelText } from "@/components/Label";
import type { LabelOverride } from "@/lib/labels";

const ACTIVITY_TYPES = [
  "STATIONARY_COMBUSTION", "MOBILE_COMBUSTION", "FUGITIVE", "PROCESS", "PURCHASED_ELECTRICITY",
  "PURCHASED_HEAT", "PURCHASED_STEAM", "PURCHASED_COOLING", "SPEND", "DISTANCE", "MASS", "WASTE", "OTHER",
];
const METHODS = [
  "FUEL_BASED", "DISTANCE_BASED", "SPEND_BASED", "AVERAGE_DATA",
  "SUPPLIER_SPECIFIC", "WASTE_TYPE_SPECIFIC", "MATERIAL_BASED", "HYBRID",
];
const REGION_STRATEGIES = ["SITE_COUNTRY_THEN_GRID_THEN_GLOBAL", "SITE_GRID_ONLY", "FIXED_REGION", "GLOBAL_ONLY"];

interface Existing {
  scope: string;
  scope3Category: number | null;
  activityType: string;
  method: string;
  fuelOrMaterialCode: string;
  regionStrategy: string;
  outputBasis: string;
  health: string;
}

export function BindingForm({
  questionId,
  positionId,
  existing,
  labelOverrides,
}: {
  questionId?: string;
  positionId?: string;
  existing: Existing | null;
  labelOverrides: readonly LabelOverride[];
}) {
  const [state, formAction, pending] = useActionState(upsertBinding, null);
  const [open, setOpen] = useState(!existing);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-accent-sky hover:underline">
        Edit binding
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-1.5 rounded-md bg-track p-2.5">
      {questionId && <input type="hidden" name="questionId" value={questionId} />}
      {positionId && <input type="hidden" name="positionId" value={positionId} />}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <select name="scope" defaultValue={existing?.scope ?? "SCOPE_1"} className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]">
          <option value="SCOPE_1">Scope 1</option>
          <option value="SCOPE_2">Scope 2</option>
          <option value="SCOPE_3">Scope 3</option>
        </select>
        <input
          name="scope3Category"
          type="number"
          min={1}
          max={15}
          defaultValue={existing?.scope3Category ?? ""}
          placeholder="cat. #"
          className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]"
        />
        <select name="outputBasis" defaultValue={existing?.outputBasis ?? "SINGLE"} className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]">
          <option value="SINGLE">Single basis</option>
          <option value="DUAL">Dual (Scope 2)</option>
        </select>
        <select name="activityType" defaultValue={existing?.activityType ?? "STATIONARY_COMBUSTION"} className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]">
          {ACTIVITY_TYPES.map((a) => (
            <option key={a} value={a}>{labelText("ACTIVITY_TYPE", a, labelOverrides)}</option>
          ))}
        </select>
        <select name="method" defaultValue={existing?.method ?? "FUEL_BASED"} className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]">
          {METHODS.map((m) => (
            <option key={m} value={m}>{labelText("METHOD", m, labelOverrides)}</option>
          ))}
        </select>
        <input
          name="fuelOrMaterialCode"
          defaultValue={existing?.fuelOrMaterialCode ?? ""}
          placeholder="fuel/material code"
          required
          className="rounded border border-border bg-surface px-1.5 py-1 text-[11px] font-mono"
        />
        <select name="regionStrategy" defaultValue={existing?.regionStrategy ?? "SITE_COUNTRY_THEN_GRID_THEN_GLOBAL"} className="col-span-2 rounded border border-border bg-surface px-1.5 py-1 text-[11px] sm:col-span-3">
          {REGION_STRATEGIES.map((r) => (
            <option key={r} value={r}>{r.replaceAll("_", " ").toLowerCase()}</option>
          ))}
        </select>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "Testing…" : "Save & test binding"}
        </button>
        {existing && (
          <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:text-ink2">
            Cancel
          </button>
        )}
      </div>
      {state?.error && <p className="text-[11px] text-warn">{state.error}</p>}
      {state?.ok && !state.error && <p className="text-[11px] text-good">Bound — health OK.</p>}
    </form>
  );
}
