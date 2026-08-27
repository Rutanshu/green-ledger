"use client";

import { useActionState, useEffect, useRef } from "react";
import { createResponsibility } from "./actions";

const TYPES = [
  { value: "DATA_OWNER", label: "Data owner" },
  { value: "REVIEWER", label: "Reviewer" },
  { value: "APPROVER", label: "Approver" },
  { value: "SITE_MANAGER", label: "Site manager" },
  { value: "CATEGORY_OWNER", label: "Category owner" },
  { value: "OTHER", label: "Other" },
];

export function CreatePositionForm({ sites }: { sites: Array<{ id: string; name: string; code: string }> }) {
  const [state, formAction, pending] = useActionState(createResponsibility, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="glass flex flex-wrap items-center gap-2 rounded-[11px] p-3">
      <input
        name="title"
        placeholder="Responsibility title, e.g. “Site Data Owner”"
        required
        className="min-w-0 flex-1 rounded-md border border-border bg-plane px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <select name="type" defaultValue="DATA_OWNER" className="rounded-md border border-border bg-plane px-2 py-1.5 text-sm outline-none focus:border-accent">
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select name="siteId" defaultValue="" className="rounded-md border border-border bg-plane px-2 py-1.5 text-sm outline-none focus:border-accent">
        <option value="">Org-wide (no site)</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "+ Create responsibility"}
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
