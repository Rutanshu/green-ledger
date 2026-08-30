"use client";

import { useState, useRef, useActionState } from "react";
import Link from "next/link";
import { submitAnswer } from "../data-collection/actions";
import { labelText } from "@/components/Label";
import { CalculationBreakdown } from "@/components/CalculationBreakdown";
import { GuidanceBanner } from "@/components/GuidanceBanner";
import { formatQuestionLabel } from "@/lib/labels/formatQuestionLabel";
import type { LabelOverride } from "@/lib/labels";

export interface WizardQuestion {
  questionId: string;
  code: string;
  label: string;
  helpText: string | null;
  allowedUnits: string[];
  evidenceRequired: boolean;
  existing: { value: string; unit: string; quality: string; comment: string; updatedAt: string; status: string } | null;
  prior: { value: string; unit: string; periodLabel: string } | null;
}

export interface WizardSite {
  siteId: string;
  siteName: string;
  siteCode: string;
  /** The scope template this entry is for — a facility now holds up to
   * 17 of these (Scope 1, Scope 2, Scope 3.1…3.15), each its own
   * independently-submitted step-0 choice. */
  scopeLabel: string;
  assignmentId: string;
  periodLabel: string;
  questions: WizardQuestion[];
}

const STEPS = ["Facility", "What", "Period", "Value", "Unit", "Evidence", "Review"] as const;
const QUALITIES = ["MEASURED", "CALCULATED", "ESTIMATED", "PROXY"] as const;

function StepBar({ index }: { index: number }) {
  return (
    <div className="mb-6 flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
          <div className={`h-[3px] w-full rounded-full ${i <= index ? "bg-accent" : "bg-track"}`} />
          <span className={`text-[10.5px] ${i === index ? "font-semibold text-ink" : "text-muted"}`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink2">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

export function EnterDataWizard({ sites, labelOverrides }: { sites: WizardSite[]; labelOverrides: readonly LabelOverride[] }) {
  const [stepIndex, setStepIndex] = useState(0);
  // Selects a (site, scope) entry — a facility can hold up to 17 of
  // these, so the assignment id (not the site id) is the unique key.
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);

  // Every field the final submit needs, lifted here — the wizard is one
  // logical form split across steps, not several independent ones.
  const [value, setValue] = useState("");
  const [quality, setQuality] = useState<string>("ESTIMATED");
  const [comment, setComment] = useState("");
  const [unit, setUnit] = useState("");

  const [state, formAction, pending] = useActionState(submitAnswer, null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  // Two submit buttons sharing one <form> — set the hidden field
  // imperatively (not via React state, which wouldn't commit before
  // requestSubmit reads the DOM) rather than relying on the clicked
  // button's own name/value pair reaching the server action's FormData.
  function submitForm(draft: boolean) {
    if (draftInputRef.current) draftInputRef.current.value = draft ? "true" : "false";
    formRef.current?.requestSubmit();
  }

  const site = sites.find((s) => s.assignmentId === selectedAssignmentId) ?? null;
  const question = site?.questions.find((q) => q.questionId === questionId) ?? null;

  function go(i: number) {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, i)));
  }

  function chooseSite(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);
    setQuestionId(null);
    go(1);
  }

  function chooseQuestion(q: WizardQuestion) {
    setQuestionId(q.questionId);
    setValue(q.existing?.value ?? "");
    setQuality(q.existing?.quality ?? "ESTIMATED");
    setComment(q.existing?.comment ?? "");
    setUnit(q.existing?.unit ?? q.allowedUnits[0] ?? "");
    go(2);
  }

  function reset() {
    setSelectedAssignmentId(null);
    setQuestionId(null);
    setValue("");
    setQuality("ESTIMATED");
    setComment("");
    setUnit("");
    go(0);
  }

  if (sites.length === 0) {
    return (
      <div className="mt-6 rounded-[11px] border border-dashed border-border bg-surface p-5 text-[13.5px] text-muted">
        Nothing to enter right now — every facility's period is locked, or none are assigned to you yet.
      </div>
    );
  }

  // Submitted successfully — confirmation, breakdown, what's next.
  if (state?.ok) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-[11px] border border-good bg-surface p-4">
          <div className="text-[15px] font-semibold text-good">Saved</div>
          <p className="mt-1 text-[13.5px] text-ink2">
            {question && site ? formatQuestionLabel(question.label, site.periodLabel) : "This entry"} for {site?.siteName} is saved. Sent to your reviewer next.
          </p>
        </div>
        {state.breakdown && <CalculationBreakdown record={state.breakdown} labelOverrides={labelOverrides} />}
        {state.calcWarning && <p className="text-[13px] text-warn">{state.calcWarning}</p>}
        <div className="flex flex-wrap gap-2.5">
          <button onClick={reset} className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
            Enter another
          </button>
          {site && (
            <Link
              href="/data-collection"
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium"
            >
              Done with {site.siteName}? Submit it for review →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-6">
      <input type="hidden" name="assignmentId" value={site?.assignmentId ?? ""} />
      <input type="hidden" name="questionId" value={question?.questionId ?? ""} />
      <input type="hidden" name="expectedUpdatedAt" value={question?.existing?.updatedAt ?? ""} />
      <input type="hidden" name="value" value={value} />
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="dataQuality" value={quality} />
      <input type="hidden" name="comment" value={comment} />
      <input ref={draftInputRef} type="hidden" name="draft" defaultValue="false" />

      <StepBar index={stepIndex} />

      {stepIndex === 0 && (
        <div className="flex flex-col gap-4">
          <div className="text-[15px] font-medium">Which facility, and which scope?</div>
          {Object.entries(
            sites.reduce<Record<string, WizardSite[]>>((groups, s) => {
              (groups[s.siteId] ??= []).push(s);
              return groups;
            }, {}),
          ).map(([siteId, entries]) => (
            <div key={siteId} className="flex flex-col gap-1.5">
              <div className="text-[13px] font-semibold text-ink2">
                {entries[0].siteName} <span className="font-normal text-muted">({entries[0].siteCode})</span>
              </div>
              {entries.map((s) => (
                <button
                  key={s.assignmentId}
                  type="button"
                  onClick={() => chooseSite(s.assignmentId)}
                  className="glass flex items-center justify-between rounded-[11px] p-3.5 text-left hover:bg-track"
                >
                  <div>
                    <div className="text-[14px] font-medium">{s.scopeLabel}</div>
                    <div className="text-[12px] text-muted">{s.periodLabel}</div>
                  </div>
                  <span className="text-muted">→</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {stepIndex === 1 && site && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[15px] font-medium">What are you reporting on?</div>
          {site.questions.length === 0 ? (
            <p className="text-[13.5px] text-muted">No items for this facility yet.</p>
          ) : (
            site.questions.map((q) => (
              <button
                key={q.questionId}
                type="button"
                onClick={() => chooseQuestion(q)}
                className="glass flex items-center justify-between rounded-[11px] p-4 text-left hover:bg-track"
              >
                <div>
                  <div className="text-[14.5px] font-medium">{formatQuestionLabel(q.label, site.periodLabel)}</div>
                  {(q.existing?.status === "ANSWERED" || q.existing?.status === "APPROVED") && (
                    <div className="text-[12.5px] text-good">
                      {q.existing.status === "APPROVED" ? "approved — locked: " : "already entered: "}
                      {q.existing.value} {q.existing.unit}
                    </div>
                  )}
                  {q.existing?.status === "DRAFT" && <div className="text-[12.5px] text-warn">draft saved</div>}
                </div>
                <span className="text-muted">→</span>
              </button>
            ))
          )}
          <button type="button" onClick={() => go(0)} className="mt-1 self-start text-[13px] text-ink2 hover:underline">
            ← back to facilities
          </button>
        </div>
      )}

      {stepIndex === 2 && site && question && (
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-medium">Confirm the period</div>
          <div className="glass rounded-[11px] p-4">
            <div className="text-[14.5px] font-medium">{site.periodLabel}</div>
            <div className="text-[12.5px] text-muted">
              {site.siteName} — {formatQuestionLabel(question.label, site.periodLabel)}
            </div>
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => go(1)} className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
              Back
            </button>
            <button type="button" onClick={() => go(3)} className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
              This is right
            </button>
          </div>
        </div>
      )}

      {stepIndex === 3 && site && question && (
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-medium">{formatQuestionLabel(question.label, site.periodLabel)}</div>
          {question.helpText && <GuidanceBanner>{question.helpText}</GuidanceBanner>}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            step="any"
            min="0"
            placeholder="Amount"
            className="rounded-lg border border-border bg-plane px-3.5 py-3 text-[18px] outline-none focus:border-accent"
          />
          {question.prior && (
            <p className="text-[12.5px] text-muted">
              Last period ({question.prior.periodLabel}): {question.prior.value} {question.prior.unit}
            </p>
          )}
          <div className="text-[13.5px] font-medium">How do you know this?</div>
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((q) => (
              <label
                key={q}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] ${
                  quality === q ? "border-accent bg-track" : "border-border bg-surface"
                }`}
              >
                <input type="radio" checked={quality === q} onChange={() => setQuality(q)} className="accent-accent" />
                {labelText("DATA_QUALITY", q, labelOverrides)}
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            rows={2}
            className="rounded-lg border border-border bg-plane px-3 py-2 text-[13.5px] outline-none focus:border-accent"
          />
          <div className="flex gap-2.5">
            <button type="button" onClick={() => go(2)} className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
              Back
            </button>
            <button
              type="button"
              onClick={() => go(4)}
              disabled={!value}
              className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {stepIndex === 4 && question && (
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-medium">Confirm the unit</div>
          <div className="flex flex-wrap gap-2">
            {question.allowedUnits.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-lg border px-3.5 py-2 text-[13.5px] font-medium ${
                  unit === u ? "border-accent bg-track" : "border-border bg-surface"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => go(3)} className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
              Back
            </button>
            <button type="button" onClick={() => go(5)} className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
              Next
            </button>
          </div>
        </div>
      )}

      {stepIndex === 5 && question && (
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-medium">Evidence</div>
          <div className="rounded-[11px] border border-dashed border-border bg-surface p-5 text-[13.5px] text-muted">
            File uploads are coming soon. {question.evidenceRequired ? "This item normally needs evidence — " : ""}
            keep the invoice or meter reading in your own records for now; we&apos;ll ask for it here shortly.
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => go(4)} className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
              Back
            </button>
            <button type="button" onClick={() => go(6)} className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
              Next
            </button>
          </div>
        </div>
      )}

      {stepIndex === 6 && site && question && (
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-medium">Review</div>
          <div className="glass flex flex-col gap-2 rounded-[11px] p-4 text-[13.5px]">
            <RowKV k="Facility" v={site.siteName} />
            <RowKV k="Item" v={formatQuestionLabel(question.label, site.periodLabel)} />
            <RowKV k="Period" v={site.periodLabel} />
            <RowKV k="Amount" v={`${value} ${unit}`} />
            <RowKV k="Data quality" v={labelText("DATA_QUALITY", quality, labelOverrides)} />
          </div>
          {state?.error && <p className="text-[13px] text-crit">{state.error}</p>}
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => go(5)} className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium">
              Back
            </button>
            <button
              type="button"
              onClick={() => submitForm(true)}
              disabled={pending}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => submitForm(false)}
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
