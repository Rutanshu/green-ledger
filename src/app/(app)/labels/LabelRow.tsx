"use client";

import { useActionState, useState } from "react";
import { setLabelOverride, clearLabelOverride } from "./actions";
import type { LabelEntityKind } from "@/lib/labels";

export function LabelRow({
  entityKind,
  code,
  currentLabel,
  currentShortLabel,
  source,
  canEdit,
}: {
  entityKind: LabelEntityKind;
  code: string;
  currentLabel: string;
  currentShortLabel: string;
  source: string;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(setLabelOverride, null);
  const [open, setOpen] = useState(false);

  return (
    <tr className="border-b border-grid last:border-0">
      <td className="px-4 py-2.5 font-mono text-xs text-ink2">{code}</td>
      <td className="px-4 py-2.5 font-medium">{currentLabel}</td>
      <td className="px-4 py-2.5 text-xs text-muted">
        {source === "org" ? "renamed" : source === "system" ? "default" : source}
      </td>
      <td className="px-4 py-2.5">
        {!canEdit ? null : !open ? (
          <button onClick={() => setOpen(true)} className="text-xs text-accent-sky hover:underline">
            Rename
          </button>
        ) : (
          <form action={formAction} className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="entityKind" value={entityKind} />
            <input type="hidden" name="code" value={code} />
            <input
              name="label"
              defaultValue={currentLabel}
              required
              className="w-40 rounded border border-border bg-surface px-1.5 py-1 text-xs"
            />
            <input
              name="shortLabel"
              defaultValue={currentShortLabel !== currentLabel ? currentShortLabel : ""}
              placeholder="short (optional)"
              className="w-24 rounded border border-border bg-surface px-1.5 py-1 text-xs"
            />
            <button type="submit" disabled={pending} className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink2">
              Cancel
            </button>
            {source === "org" && (
              <button
                type="button"
                onClick={() => clearLabelOverride(entityKind, code)}
                className="text-xs text-muted hover:text-crit"
              >
                Reset to default
              </button>
            )}
            {state?.error && <span className="text-xs text-crit">{state.error}</span>}
          </form>
        )}
      </td>
    </tr>
  );
}
