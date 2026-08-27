"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPositionToSection } from "./actions";

interface PositionOption {
  id: string;
  positionCode: string;
  labelKey: string;
  type: string;
}

export function AddPositionToSectionForm({ sectionId, positions }: { sectionId: string; positions: PositionOption[] }) {
  const [state, formAction, pending] = useActionState(addPositionToSection, null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-border p-2 text-left text-xs text-muted hover:border-accent hover:text-ink2"
      >
        + Add existing position
      </button>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted">
        No positions in the library yet — create one on the{" "}
        <a href="/positions-library" className="text-accent-sky hover:underline">
          Position library
        </a>{" "}
        page first.{" "}
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink2">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2 rounded-md border border-border bg-plane/40 p-2">
      <input type="hidden" name="sectionId" value={sectionId} />
      <select
        name="positionId"
        required
        defaultValue=""
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
      >
        <option value="" disabled>
          Choose a position…
        </option>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.positionCode} — {p.labelKey} ({p.type})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink2">
        Cancel
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
