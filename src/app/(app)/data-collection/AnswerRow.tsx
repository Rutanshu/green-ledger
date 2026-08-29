"use client";

import { useActionState } from "react";
import { submitAnswer } from "./actions";
import { saveCustomFieldValues } from "./customFieldActions";
import { labelText } from "@/components/Label";
import type { LabelOverride } from "@/lib/labels";

interface CustomFieldProp {
  id: string;
  label: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  options: { code: string; label: string }[];
  isRequired: boolean;
  existingValue: string;
}

interface Props {
  assignmentId: string;
  questionId: string;
  code: string;
  allowedUnits: string[];
  existing: { value: string; unit: string; quality: string; updatedAt: string; comment: string } | null;
  existingEmissionsKg: string | null;
  canEdit: boolean;
  labelOverrides: readonly LabelOverride[];
  customFields?: CustomFieldProp[];
}

const QUALITIES = ["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"];

export function AnswerRow({ assignmentId, questionId, code, allowedUnits, existing, existingEmissionsKg, canEdit, labelOverrides, customFields = [] }: Props) {
  const [state, formAction, pending] = useActionState(submitAnswer, null);
  // Custom-field values ride along on the same form/submit as the answer,
  // but save through their own independent action (see customFieldActions.ts
  // for why) — fired here, not inside submitAnswer's own transaction.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (customFields.length > 0) saveCustomFieldValues(new FormData(e.currentTarget));
  };

  const emissionsKg = state?.ok ? state.emissionsKgCo2e ?? null : existingEmissionsKg;

  if (!canEdit) {
    return (
      <tr className="border-t border-grid align-top">
        <td className="px-4 py-2 font-medium">{code}</td>
        <td className="px-4 py-2 font-mono text-xs text-ink2">
          {emissionsKg ? `${Number(emissionsKg).toLocaleString()} kg CO2e` : <span className="text-muted">—</span>}
        </td>
        <td className="px-4 py-2 text-xs text-ink2">
          {existing ? (
            `${existing.value} ${existing.unit} · ${labelText("DATA_QUALITY", existing.quality, labelOverrides)}`
          ) : (
            <span className="text-muted">not answered</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-grid align-top">
      <td className="px-4 py-2 font-medium">{code}</td>
      <td className="px-4 py-2 font-mono text-xs text-ink2">
        {emissionsKg ? (
          `${Number(emissionsKg).toLocaleString()} kg CO2e`
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-2">
        <form action={formAction} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="questionId" value={questionId} />
          <input type="hidden" name="expectedUpdatedAt" value={existing?.updatedAt ?? ""} />
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
                {labelText("DATA_QUALITY", q, labelOverrides)}
              </option>
            ))}
          </select>
          <input
            name="comment"
            defaultValue={existing?.comment ?? ""}
            placeholder="comment (optional)"
            className="w-32 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
          />
          {customFields.map((f) =>
            f.fieldType === "SELECT" ? (
              <select
                key={f.id}
                name={`customField_${f.id}`}
                defaultValue={f.existingValue}
                required={f.isRequired}
                title={f.label}
                className="rounded-md border border-border bg-plane px-1.5 py-1 text-xs outline-none focus:border-accent"
              >
                <option value="">{f.label}…</option>
                {f.options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={f.id}
                name={`customField_${f.id}`}
                type={f.fieldType === "NUMBER" ? "number" : f.fieldType === "DATE" ? "date" : "text"}
                step={f.fieldType === "NUMBER" ? "any" : undefined}
                defaultValue={f.existingValue}
                required={f.isRequired}
                placeholder={f.label}
                className="w-28 rounded-md border border-border bg-plane px-2 py-1 text-xs outline-none focus:border-accent"
              />
            ),
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-track disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {state?.ok && !state.calcWarning && <span className="text-xs text-good">saved &amp; calculated</span>}
          {state?.ok && state.calcWarning && (
            <span className="text-xs text-warn" title={state.calcWarning}>
              saved — calc issue
            </span>
          )}
          {state?.error && <span className="text-xs text-crit">{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
