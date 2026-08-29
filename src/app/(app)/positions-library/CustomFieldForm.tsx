"use client";

import { useActionState, useState } from "react";
import { createCustomField } from "./actions";

interface PositionOption {
  id: string;
  positionCode: string;
}

export function CustomFieldForm({ positions }: { positions: PositionOption[] }) {
  const [state, formAction, pending] = useActionState(createCustomField, null);
  const [fieldType, setFieldType] = useState<"TEXT" | "NUMBER" | "DATE" | "SELECT">("TEXT");

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[11px] border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px]">
          Label
          <input
            name="label"
            required
            placeholder="Reference number"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Type
          <select
            name="fieldType"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as typeof fieldType)}
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            <option value="TEXT">Text</option>
            <option value="NUMBER">Number</option>
            <option value="DATE">Date</option>
            <option value="SELECT">Select (choose one)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
          Attach to (optional — leave blank to float on every position)
          <select
            name="positionId"
            defaultValue=""
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            <option value="">Floating — available everywhere</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode}
              </option>
            ))}
          </select>
        </label>
        {fieldType === "SELECT" && (
          <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
            Options (comma-separated)
            <input
              name="options"
              placeholder="Option A, Option B, Option C"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
          </label>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" name="isRequired" value="true" className="accent-accent" />
          Required
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add custom field"}
        </button>
        {state && !state.ok && <span className="text-[13px] text-crit">{state.error}</span>}
      </div>
    </form>
  );
}
