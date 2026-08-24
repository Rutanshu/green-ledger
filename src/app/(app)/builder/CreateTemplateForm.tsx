"use client";

import { useActionState } from "react";
import { createTemplate } from "./actions";

export function CreateTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, null);

  return (
    <form action={formAction} className="glass flex items-center gap-2 rounded-[11px] p-3">
      <input
        name="name"
        placeholder="New template name…"
        required
        className="min-w-0 flex-1 rounded-md border border-border bg-plane px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "+ Create"}
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
