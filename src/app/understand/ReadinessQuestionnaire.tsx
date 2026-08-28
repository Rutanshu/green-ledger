"use client";

import { useState } from "react";

interface Question {
  id: string;
  prompt: string;
  options: Array<{ value: string; label: string }>;
}

const QUESTIONS: Question[] = [
  {
    id: "registration",
    prompt: "Where is your company registered?",
    options: [
      { value: "eu", label: "In the EU" },
      { value: "listed_eu", label: "Outside the EU, but listed on an EU-regulated market" },
      { value: "other", label: "Outside the EU, not listed there" },
    ],
  },
  {
    id: "employees",
    prompt: "How many employees, across the whole group?",
    options: [
      { value: "under_250", label: "Under 250" },
      { value: "mid", label: "250 – 999" },
      { value: "over_1000", label: "1,000 or more" },
    ],
  },
  {
    id: "turnover",
    prompt: "Annual net turnover, across the whole group?",
    options: [
      { value: "under_50", label: "Under €50m" },
      { value: "mid", label: "€50m – €450m" },
      { value: "over_450", label: "Over €450m" },
    ],
  },
  {
    id: "structure",
    prompt: "Group structure?",
    options: [
      { value: "standalone", label: "Standalone company" },
      { value: "parent", label: "Parent, with subsidiaries" },
      { value: "subsidiary", label: "Subsidiary of another group" },
    ],
  },
  {
    id: "euOps",
    prompt: "Do you have operations (not just sales) in the EU?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "euLinks",
    prompt: "Do you have EU subsidiaries, or EU suppliers that make up a large share of your supply chain?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "existingReporting",
    prompt: "Are you already reporting sustainability data?",
    options: [
      { value: "csrd", label: "Yes, under CSRD or the older NFRD" },
      { value: "voluntary", label: "Yes, voluntarily (e.g. CDP, a sustainability report)" },
      { value: "none", label: "Not yet" },
    ],
  },
  {
    id: "targetYear",
    prompt: "What reporting year are you aiming for?",
    options: [
      { value: "fy2026", label: "FY2026" },
      { value: "fy2027", label: "FY2027" },
      { value: "fy2028", label: "FY2028" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: "measured",
    prompt: "What have you already measured?",
    options: [
      { value: "none", label: "Nothing yet" },
      { value: "scope1", label: "Scope 1 (fuel you burn)" },
      { value: "scope12", label: "Scope 1 and 2 (fuel and purchased energy)" },
      { value: "scope123", label: "Scope 1, 2, and 3 (including your value chain)" },
    ],
  },
];

function summarise(answers: Record<string, string>) {
  const bigEnough = answers.employees === "over_1000" && answers.turnover === "over_450";
  const euConnected = answers.registration !== "other" || answers.euOps === "yes" || answers.euLinks === "yes";

  let headline: string;
  let likelyAreas: string[];

  if (bigEnough && euConnected) {
    headline = "You're likely in scope for CSRD, on the current Omnibus I thresholds.";
    likelyAreas = ["Scope 1 and 2 emissions, fully audited", "Scope 3 for your material categories", "A double-materiality assessment", "ESRS-aligned narrative disclosure"];
  } else if (answers.euLinks === "yes" || answers.structure === "subsidiary") {
    headline = "You may be pulled in indirectly, even if you're not in scope yourself.";
    likelyAreas = ["Emissions data requested by an EU parent or a large EU customer", "Scope 1 and 2 at minimum, since that's usually asked for first", "A simpler process than full CSRD, but still worth tracking properly"];
  } else {
    headline = "You don't look to be in scope under the current thresholds.";
    likelyAreas = ["Nothing mandatory yet, on the numbers you've given", "Worth tracking Scope 1 and 2 anyway — thresholds have moved twice already", "Voluntary reporting keeps you ready if that changes"];
  }

  const dataGap =
    answers.measured === "none"
      ? "You haven't started measuring yet — that's the first real step, not the paperwork."
      : answers.measured === "scope1"
        ? "You've got Scope 1 — Scope 2 (purchased electricity, heat, steam) is usually the next-easiest to add."
        : answers.measured === "scope12"
          ? "You've got Scope 1 and 2 — Scope 3 is the long pole for most companies, and the part worth starting early."
          : "You've already got all three scopes — the work from here is mostly rigor: traceability, audit-readiness, consistency year over year.";

  return { headline, likelyAreas, dataGap };
}

export function ReadinessQuestionnaire() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);
  const result = submitted ? summarise(answers) : null;

  if (result) {
    return (
      <div className="glass-strong rounded-2xl p-6">
        <h3 className="text-base font-semibold text-ink">{result.headline}</h3>
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Likely reporting areas</div>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13.5px] text-ink2">
            {result.likelyAreas.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="text-accent">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-[13.5px] text-ink2">{result.dataGap}</p>
        <p className="mt-5 text-xs text-muted">
          This is guidance based on what you told us, not legal advice. Confirm applicability against your own
          counsel — thresholds and dates are still moving.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:bg-track"
        >
          Answer again
        </button>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-6">
      <div className="flex flex-col gap-6">
        {QUESTIONS.map((q) => (
          <div key={q.id}>
            <div className="text-[13.5px] font-medium text-ink">{q.prompt}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((o) => (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] ${
                    answers[q.id] === o.value ? "border-accent bg-track" : "border-border bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={o.value}
                    checked={answers[q.id] === o.value}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.value }))}
                    className="accent-accent"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setSubmitted(true)}
        disabled={!allAnswered}
        className="mt-6 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-40"
      >
        See where you likely stand
      </button>
      {!allAnswered && <p className="mt-2 text-xs text-muted">Answer all {QUESTIONS.length} questions to see your result.</p>}
    </div>
  );
}
