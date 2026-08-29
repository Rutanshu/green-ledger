"use client";

import { useActionState } from "react";
import { unlockPositionValue } from "./actions";

export function UnlockPositionValueForm({ positionValueId }: { positionValueId: string }) {
  const [state, formAction, pending] = useActionState(unlockPositionValue, null);

  if (state?.ok) {
    return <span className="text-[12.5px] text-warn">Unlocked — sent back to the data collector.</span>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="positionValueId" value={positionValueId} />
      <input
        name="reason"
        placeholder="Why reopen this?"
        required
        className="w-48 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
