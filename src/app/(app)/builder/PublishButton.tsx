"use client";

import { useActionState } from "react";
import { publishTemplate } from "./actions";

export function PublishButton({ templateId }: { templateId: string }) {
  const [state, formAction, pending] = useActionState(async () => publishTemplate(templateId), null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Checking bindings…" : "Publish"}
        </button>
      </form>
      {state?.error && <p className="max-w-xs text-right text-xs text-crit">{state.error}</p>}
    </div>
  );
}
