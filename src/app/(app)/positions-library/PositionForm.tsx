"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPosition } from "./actions";
import { UNIT_DIMENSIONS, unitsInDimension, type UnitDimension } from "@/lib/units";

const TYPES = [
  { value: "FLOW", label: "Flow (periodic activity — most positions)" },
  { value: "ASSET", label: "Asset (versioned point-in-time value)" },
  { value: "INDICATOR", label: "Indicator (computed)" },
  { value: "TEXT", label: "Text" },
  { value: "QUESTION", label: "Question (freeform)" },
  { value: "OVERVIEW", label: "Overview (roll-up)" },
];

export function PositionForm() {
  const [state, formAction, pending] = useActionState(createPosition, null);
  const [type, setType] = useState("FLOW");
  const [dimension, setDimension] = useState<UnitDimension>("VOLUME");
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hasUnits = type === "FLOW" || type === "ASSET" || type === "INDICATOR";

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        + Create position
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-[11px] glass p-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="positionCode"
          placeholder="code_like_this"
          required
          className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
        />
        <input
          name="labelKey"
          placeholder="Label shown to the person answering"
          required
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted">Type</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          name="tags"
          placeholder="tags, comma-separated"
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
      </div>
      {hasUnits && (
        <div className="flex flex-wrap items-start gap-2 rounded-md bg-track p-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted">Dimension</label>
            <select
              name="dimension"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as UnitDimension)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            >
              {UNIT_DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted">Allowed units</label>
            <div className="flex flex-wrap gap-2">
              {unitsInDimension(dimension).map((u) => (
                <label key={u} className="flex items-center gap-1 text-xs text-ink2">
                  <input type="checkbox" name="allowedUnits" value={u} defaultChecked={u === unitsInDimension(dimension)[0]} className="accent-accent" />
                  {u}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create position"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink2">
          Cancel
        </button>
        {state?.error && <span className="text-xs text-crit">{state.error}</span>}
      </div>
    </form>
  );
}
