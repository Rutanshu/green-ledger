"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { assignPosition } from "./actions";

export function AssignForm({
  positionId,
  isBackup,
  members,
}: {
  positionId: string;
  isBackup: boolean;
  members: Array<{ id: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(assignPosition, null);
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
      <button onClick={() => setOpen(true)} className="mt-1.5 text-xs text-accent-sky hover:underline">
        {isBackup ? "Assign backup" : "Reassign"}
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-1.5 flex flex-col gap-1.5">
      <input type="hidden" name="positionId" value={positionId} />
      {isBackup && <input type="hidden" name="isBackup" value="on" />}
      <select name="userId" required defaultValue="" className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]">
        <option value="" disabled>Choose a person…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <input
        name="reason"
        placeholder="Reason (optional)"
        className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]"
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Assign"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted hover:text-ink2">
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-[11px] text-crit">{state.error}</p>}
    </form>
  );
}
