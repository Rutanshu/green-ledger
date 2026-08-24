"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSection } from "./actions";

export function SectionForm({ templateId }: { templateId: string }) {
  const [state, formAction, pending] = useActionState(createSection, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="glass flex flex-wrap items-center gap-2 rounded-[11px] p-3">
      <input type="hidden" name="templateId" value={templateId} />
      <input
        name="title"
        placeholder="Section title, e.g. “Fuel burned on site”"
        required
        className="min-w-0 flex-1 rounded-md border border-border bg-plane px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <select name="scope" required defaultValue="SCOPE_1" className="rounded-md border border-border bg-plane px-2 py-1.5 text-sm outline-none focus:border-accent">
        <option value="SCOPE_1">Scope 1</option>
        <option value="SCOPE_2">Scope 2</option>
        <option value="SCOPE_3">Scope 3</option>
      </select>
      <input
        name="scope3Category"
        type="number"
        min={1}
        max={15}
        placeholder="cat. #"
        className="w-20 rounded-md border border-border bg-plane px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "+ Add section"}
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
