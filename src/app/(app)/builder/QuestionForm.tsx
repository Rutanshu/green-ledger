"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createQuestion } from "./actions";
import { UNIT_DIMENSIONS, unitsInDimension, type UnitDimension } from "@/lib/units";

const FIELD_TYPES = [
  { value: "NUMBER_WITH_UNIT", label: "Number with unit" },
  { value: "NUMBER", label: "Number" },
  { value: "TEXT", label: "Text" },
  { value: "SINGLE_SELECT", label: "Single select" },
  { value: "MULTI_SELECT", label: "Multi select" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
] as const;

export function QuestionForm({ sectionId }: { sectionId: string }) {
  const [state, formAction, pending] = useActionState(createQuestion, null);
  const [inputType, setInputType] = useState<string>("NUMBER_WITH_UNIT");
  const [dimension, setDimension] = useState<UnitDimension>("VOLUME");
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
        className="w-full rounded-md border border-dashed border-border p-2 text-left text-xs text-muted hover:border-accent hover:text-ink2"
      >
        + Add question
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-md border border-border bg-plane/40 p-3">
      <input type="hidden" name="sectionId" value={sectionId} />
      <div className="flex gap-2">
        <input
          name="code"
          placeholder="code_like_this"
          required
          className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
        />
        <input
          name="label"
          placeholder="Question text shown to the person answering"
          required
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>
      <input
        name="helpText"
        placeholder="Help text (optional)"
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted">Field type</label>
        <select
          name="inputType"
          value={inputType}
          onChange={(e) => setInputType(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        >
          {FIELD_TYPES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-ink2">
          <input name="isRequired" type="checkbox" defaultChecked className="accent-accent" />
          Required
        </label>
      </div>

      {inputType === "NUMBER_WITH_UNIT" && (
        <div className="flex flex-wrap items-start gap-2 rounded-md bg-track p-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted">Dimension</label>
            <select
              name="unitDimension"
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

      {(inputType === "SINGLE_SELECT" || inputType === "MULTI_SELECT") && (
        <input
          name="options"
          placeholder="Option one, Option two, Option three"
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      )}

      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add question"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink2">
          Cancel
        </button>
        {state?.error && <span className="text-xs text-crit">{state.error}</span>}
      </div>
    </form>
  );
}
