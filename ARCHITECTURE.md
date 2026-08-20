# ARCHITECTURE.md — Green Ledger

**Companion to SPEC.md.** SPEC.md says *what*; this says *how it's wired*.

## Stack
- **Next.js 15**, App Router, React Server Components by default
- **TypeScript**, `strict: true`, no `any` in `/lib/calc/`
- **PostgreSQL 16** via **Prisma**
- **Tailwind** (+ shadcn/ui for tables and forms)
- **Zod** for every boundary: form input, CSV row, API payload, env vars
- **Vitest** for unit tests, **Playwright** for the two or three flows that matter
- **decimal.js** / Prisma `Decimal` — no JS floats touch an emissions number
- Object storage: S3-compatible (R2), presigned uploads

## Layers, and the one rule between them

```
app/            Server Components + route handlers. Auth, tenant scoping, rendering.
  └─ no arithmetic on emissions. Ever.
lib/db/         Prisma client, tenant middleware, query helpers.
lib/calc/       PURE. No imports from lib/db, no fetch, no Date.now().
lib/units/      UnitCode enum, conversion table, dimension checks. PURE.
lib/factors/    resolveFactor() — pure; takes a candidate array, returns one factor or throws.
lib/import/     CSV parse → Zod validate → dry-run diff → commit.
lib/audit/      writeAuditEvent(); called from a Prisma extension, not sprinkled in handlers.
lib/reports/    Builders that read snapshots only, never recompute.
```

> **The rule:** data flows `app → lib/db → lib/calc → back`. `lib/calc` never reaches out. If a calculation needs something, it is passed in as an argument. This is what makes the engine testable and the numbers reproducible.

## Multi-tenancy — belt and braces
1. **Prisma extension** injects `organization_id` into every `where` and every `create`.
2. **Postgres RLS** on every tenant table, keyed off `current_setting('app.org_id')`, set per request in a transaction.

Layer 1 catches developer mistakes. Layer 2 catches layer 1's mistakes. Neither alone is enough for data an auditor will look at.

## Audit trail
A Prisma client extension wraps `create`/`update`/`delete` on audited models and writes an `AuditEvent` inside the same transaction. The table has `REVOKE UPDATE, DELETE` for the app role. Audit writes are never optional and never async-fire-and-forget.

## Calculation flow
```
ActivityRecord saved
   → resolveFactor(candidates, activity)      [pure]
   → convertUnits(quantity, from, to, fuelProps) [pure]
   → calculateEmissions(input)                [pure] → CalcResult[]
   → persist EmissionRecord rows with all snapshots
   → AuditEvent
```
Recalculation reruns the same path explicitly and refuses on `LOCKED` periods.

## Performance targets
- 100k EmissionRecords per org per period.
- Dashboard totals come from a materialised summary table refreshed on write, not a live `SUM` over 100k rows.
- CSV import streams; 10k rows < 60s; batched inserts of 500.
- Every list view is cursor-paginated. No `skip/take` over large offsets.

## Environments
`local` (docker compose: postgres + minio) → `preview` (per-PR) → `production`. Migrations are forward-only; never edit an applied migration.

## Testing pyramid
- `lib/calc`, `lib/units`, `lib/factors`: near-100% branch coverage. These are pure; there's no excuse.
- `lib/import`: fixture CSVs including malformed ones.
- E2E: sign in → enter an activity → see emissions → lock period → confirm edit is refused.
