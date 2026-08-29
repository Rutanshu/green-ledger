"use client";

import { useActionState } from "react";
import { createSite } from "./actions";

interface SiteTypeOption {
  code: string;
  label: string;
}

interface SiteOption {
  id: string;
  name: string;
  code: string;
  depth: number | null;
}

export function CreateSiteFields({
  siteTypes,
  siteOptions,
  onCancel,
  onAddAnother,
}: {
  siteTypes: SiteTypeOption[];
  siteOptions: SiteOption[];
  onCancel: () => void;
  onAddAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState(createSite, null);

  if (state?.ok) {
    return (
      <div className="rounded-[11px] border border-good bg-surface p-4 text-[13px]">
        <span className="font-medium text-good">Facility added.</span> It now appears in Data Collection and on the
        Dashboard.
        <button onClick={onAddAnother} className="ml-3 font-medium text-accent hover:underline">
          Add another
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[11px] border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px]">
          Name
          <input
            name="name"
            required
            placeholder="Riverside Distribution Centre"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Code
          <input
            name="code"
            required
            placeholder="MI-RD-09"
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Type
          <select
            name="siteType"
            required
            defaultValue=""
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            <option value="" disabled>
              Choose a type…
            </option>
            {siteTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            Country
            <input
              name="country"
              required
              maxLength={2}
              placeholder="GB"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] uppercase outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            City
            <input
              name="city"
              placeholder="Leeds"
              className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
          Parent facility (optional)
          <select
            name="parentSiteId"
            defaultValue=""
            className="rounded-md border border-border bg-plane px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            <option value="">None — a top-level facility</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {"— ".repeat(s.depth ?? 0)}
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add facility"}
        </button>
        <button type="button" onClick={onCancel} className="text-[13px] text-ink2 hover:underline">
          Cancel
        </button>
        {state && !state.ok && <span className="text-[13px] text-crit">{state.error}</span>}
      </div>
    </form>
  );
}
