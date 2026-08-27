"use client";

import { useActionState, useState } from "react";
import { requestRestatement } from "../periods/actions";

const QUALITIES = ["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"];

interface Props {
  assignmentId: string;
  questions: Array<{ id: string; code: string; allowedUnits: string[] }>;
}

export function RestatementForm({ assignmentId, questions }: Props) {
  const [state, formAction, pending] = useActionState(requestRestatement, null);
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? "");
  const units = questions.find((q) => q.id === questionId)?.allowedUnits ?? [];

  if (questions.length === 0) return null;

  if (state?.ok) {
    return <p className="mt-2 text-xs text-good">Restatement requested — pending approval from a different person.</p>;
  }

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <select
        name="questionId"
        value={questionId}
        onChange={(e) => setQuestionId(e.target.value)}
        className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent"
      >
        {questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.code}
          </option>
        ))}
      </select>
      <input
        name="value"
        type="number"
        step="any"
        min="0"
        placeholder="corrected value"
        required
        className="w-28 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <select name="unit" className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent">
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <select name="dataQuality" defaultValue="ESTIMATED" className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent">
        {QUALITIES.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      <input
        name="reason"
        placeholder="Reason for the correction"
        required
        className="min-w-[12rem] flex-1 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
      >
        {pending ? "Requesting…" : "Request restatement"}
      </button>
      {state?.error && <span className="text-xs text-crit">{state.error}</span>}
    </form>
  );
}
