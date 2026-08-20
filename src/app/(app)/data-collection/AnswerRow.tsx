"use client";

import { useActionState } from "react";
import { submitAnswer } from "./actions";

interface Props {
  assignmentId: string;
  questionId: string;
  code: string;
  allowedUnits: string[];
  existing: { value: string; unit: string; quality: string } | null;
}

const QUALITIES = ["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"];

export function AnswerRow({ assignmentId, questionId, code, allowedUnits, existing }: Props) {
  const [state, formAction, pending] = useActionState(submitAnswer, null);

  return (
    <tr className="border-t border-grid align-top">
      <td className="px-4 py-2 font-medium">{code}</td>
      <td className="px-4 py-2">
        <form action={formAction} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="questionId" value={questionId} />
          <input
            name="value"
            type="number"
            step="any"
            min="0"
            defaultValue={existing?.value ?? ""}
            placeholder="value"
            required
            className="w-24 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <select
            name="unit"
            defaultValue={existing?.unit ?? allowedUnits[0]}
            className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent"
          >
            {allowedUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <select
            name="dataQuality"
            defaultValue={existing?.quality ?? "ESTIMATED"}
            className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent"
          >
            {QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {state?.ok && <span className="text-xs text-good">saved</span>}
          {state?.error && <span className="text-xs text-crit">{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
