# Green Ledger

Multi-tenant greenhouse-gas accounting. Organisations describe their sites, answer a
plain-language questionnaire, and get an emissions inventory where **every number is
reproducible from stored inputs, forever**.

Aligned to the **GHG Protocol Corporate Standard** (the arithmetic) and disclosed under
**CSRD / ESRS E1** (the format). All 15 Scope 3 categories are in the schema.

---

## The idea in one paragraph

Four layers, deliberately separate:

1. **Site profile + assets** — what physically exists at a site (boilers, generators, chillers, vehicles).
2. **Questionnaire** — plain-language questions. The asset list decides which ones appear.
3. **Factor binding** — each question is mapped to a published emission factor.
4. **Labels** — the organisation's own word for every system code.

The person filling the form never sees an emission factor or a GHG Protocol activity type.
They answer *"How much diesel did the backup generator consume?"*. The binding underneath
resolves a factor and writes the record.

> **The one rule:** a report generated today must produce identical figures in 2035, after
> every factor in the system has been superseded. That is why `EmissionRecord` snapshots
> the factor value, source, version, GWP, conversion factor and consolidation share —
> rather than looking them up live.

---

## Status

| Built | State |
|---|---|
| Prisma schema — 27 models, 31 enums | ✅ validates |
| `lib/units` — typed units, dimension safety | ✅ tested |
| `lib/labels` — 6-level label resolution | ✅ tested |
| `lib/visibility` — `visible_if` + completeness | ✅ tested |
| `lib/factors` — resolution, ties, mid-year splits, binding health | ✅ tested |
| `lib/calc` — the engine, pure | ✅ tested |
| Seed data — 4 sites, 17 factors, full template | ✅ integrity-tested |
| UI, auth, API routes | ⬜ not started |

**59 tests passing.** Run `npm run verify`.

---

## Getting started

```bash
npm install
cp .env.example .env      # fill in your Neon connection strings
npm run verify            # schema + types + tests — needs no database
npm run db:migrate        # needs a database
npm run db:seed
npm run dev
```

`npm run verify` is deliberately runnable with no database and no network. The calculation
engine, the unit layer, the label resolver and the visibility rules are all **pure functions**
— they take their inputs as arguments and touch nothing else. That is what makes the numbers
testable, and it is enforced in `CLAUDE.md`.

---

## The tests that matter

```
✓ A SUPERSEDED FACTOR DOES NOT CHANGE A PAST RESULT
✓ splits day-weighted across a mid-year factor change, and the parts sum correctly
✓ THROWS on a unit-dimension mismatch rather than producing a wrong number
✓ a tie is an ERROR, never a silent pick
✓ produces both Scope 2 bases from one activity
✓ the empty warehouse sits at 100%, not 0%
✓ every bound question resolves to a factor, except the deliberate one
```

That last one runs against the seed data, so a broken demo fails the build rather than
shipping. One binding is broken **on purpose** so the Factor Lab has something to show.

---

## Layout

```
prisma/
  schema.prisma        27 models — the contract
  seed-data.ts         the demo. Separated from Prisma writes so it can be unit-tested.
src/lib/
  units/               UnitCode + conversion. Cross-dimension is a fuel property, not a conversion.
  labels/              resolveLabel() — binding > question > template > site type > org > system
  visibility/          evaluateVisibility() — ONE function, used by client and server alike
  factors/             resolveFactor() — deterministic; ties throw; mid-year changes split
  calc/                calculateEmissions() — PURE. No Prisma, no fetch, no Date.now().
scripts/
  validate-schema.cjs  validates schema.prisma without a database or the Prisma engine download
```

## Documentation

| File | What it covers |
|---|---|
| `SPEC.md` | Data model, scopes, factor versioning, the calculation contract |
| `UX.md` | Every screen, the label layer, the get-started page |
| `ARCHITECTURE.md` | How the layers are wired, multi-tenancy, performance targets |
| `DEPLOY.md` | Free hosting: Vercel + Neon + R2, and the constraints they impose |
| `CLAUDE.md` | Conventions. Read before writing code. |

## Licence

MIT.
