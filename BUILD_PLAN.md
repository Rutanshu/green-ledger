# Green Ledger — Build Plan for VS Code

**How to use this file:** each step below is a self-contained session. Copy the prompt block verbatim into Claude in VS Code, let it work, run the acceptance check, commit, then move to the next step. Do not skip ahead — every step assumes the ones above it exist.

**Companion:** `GHG_TOOL_ARCHITECTURE.md` — the specification these steps implement. Section references below point into it.

**Status note (this repo specifically):** Step 1.1's tenancy foundation already exists here in spirit — the `Organization` model *is* this document's `Tenant` (a `User` global/unique-by-email plus `Membership` already matches `PlatformUser`/`Membership` exactly), with two-layer isolation (`orgScopedClient` + Postgres RLS) already built and tested. What Step 1.1 was actually missing — an AsyncLocalStorage request context and a comprehensive cross-tenant isolation suite covering every model — has been added (`src/lib/tenancy/`). An `Entitlement` model and `can()` check (§23) exist as groundwork, unwired to any live gate. Steps 1.2 onward are not yet started. See the session history for the reasoning behind keeping `Organization` rather than renaming to `Tenant`.

---

## 0. Before the first prompt

### 0.1 Repo setup (do this yourself, once)

```bash
npx create-next-app@latest green-ledger --typescript --tailwind --app --eslint
cd green-ledger
npm i @prisma/client decimal.js zod
npm i -D prisma vitest @vitest/coverage-v8 tsx
npx prisma init
git init && git add -A && git commit -m "chore: scaffold"
```

Copy `GHG_TOOL_ARCHITECTURE.md`, `BUILD_PLAN.md`, `SPEC.md` and `UX.md` into the repo root.

### 0.2 `CLAUDE.md` — put this in the repo root before anything else

```markdown
# CLAUDE.md — Green Ledger conventions

Read `GHG_TOOL_ARCHITECTURE.md` before writing code. It is the contract.

## Non-negotiables
1. Emissions arithmetic lives only in `src/lib/calc/`. Pure functions. No Prisma,
   no fetch, no Date.now(), no Math.random(). A UI component that multiplies by an
   emission factor is a bug.
2. Every number is traceable. An EmissionRecord stores quantity_normalised,
   factor_value, factor_unit_num, factor_unit_den, factor_source, factor_version,
   gwp_value, gwp_set, unit_conversion_factor, consolidation_share and
   calc_engine_version — not just the result.
3. Factors are immutable once referenced. Corrections create a new version with a
   new valid_from. Recalculation is explicit, user-triggered, audit-logged, and
   refused on locked periods.
4. Units are a type (UnitCode), never a string. Cross-dimension conversion
   (L -> GJ) is a fuel property, not a unit conversion.
5. No floats. Decimal end to end. Round only at display/export.
6. Every tenant query is scoped — Prisma extension AND Postgres RLS. Two nets.
7. Audit events are written in the same transaction as the change they describe.
8. Locked periods are immutable. Corrections go through restatement.
9. A questionnaire cannot be published with a broken or ambiguous factor binding.
   A form that silently records zeros is the worst possible bug in this product.
10. visible_if is evaluated by ONE pure function used by both client and server.
11. An Answer is what a human typed; a TransactionLine is the accounting record.
    Never let UI code write a TransactionLine directly.
12. No hardcoded user-visible strings. Everything goes through resolveLabel() /
    the <Label> component. Codes are the system's; labels belong to the tenant.
13. The product is industry-neutral. No vertical assumptions in schema, seeds or copy.

## Definition of done for any change
- [ ] Pure function where the logic is arithmetic; no side effects
- [ ] Zod schema on every input boundary
- [ ] Unit tests, including the failure cases named in the step
- [ ] Migration included if the schema moved
- [ ] calc_engine_version bumped if a formula changed
- [ ] Cross-tenant isolation test still green

## Naming
- DB: snake_case, plural tables. TS: camelCase vars, PascalCase types.
- Enums are DB enums mirrored as TS unions from Prisma. Never a free-text status column.
- Quantities Decimal(20,6). Factors Decimal(24,12). Emissions Decimal(24,6).

## Commits
Small and revertible. One migration per commit.
Message style: `feat(calc): mid-year factor split`
```

### 0.3 Session protocol — follow this every time

1. **Open with context:** *"Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §X before you start."*
2. **Paste the step prompt** exactly as written below.
3. **Run the acceptance check** yourself; don't take "done" on trust.
4. **Run the review prompt** (below) on the diff.
5. **Commit** before starting the next step.

**Review prompt — run after every step:**
> Review this diff as a skeptical senior engineer. What breaks at 100,000 records, at a mid-year factor update, when two factors match equally well, or when a second tenant exists? Name specific lines. Do not fix anything yet — list the problems first.

---

# PHASE 1 — FOUNDATION (E1–E3)

## Step 1.1 — Tenancy foundation

**Goal:** a tenant model, request context, and two independent scoping nets.

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §8.1 and §19.
>
> Stack: Next.js App Router, TypeScript, Postgres via Prisma, Tailwind.
>
> Build the tenancy foundation.
>
> Files: `prisma/schema.prisma`, `src/lib/tenancy/context.ts`, `src/lib/tenancy/prisma.ts`, `src/lib/tenancy/__tests__/isolation.test.ts`, and a migration.
>
> Requirements:
> 1. Models: Tenant, TenantSettings, PlatformUser, Membership, Entitlement. Every tenant-owned table carries `tenant_id`, including child tables where it is technically redundant.
> 2. A request-scoped tenant context using AsyncLocalStorage. Reading the context when it is unset must throw, never default.
> 3. A Prisma client extension that injects `tenant_id` into every `where` and every `create` for tenant-owned models, sourced from that context.
> 4. Postgres RLS policies on every tenant-owned table keyed to `app.tenant_id`, set at connection checkout. Include the SQL in the migration.
> 5. An isolation test suite that, for every tenant-owned model, attempts a cross-tenant read and a cross-tenant write and asserts both fail.
>
> Acceptance: the isolation suite passes; calling the scoped client with no context throws a typed error; `npm run verify` is green.
>
> Do not build any UI, auth screens, or business models yet.

**Acceptance check:** `npm test` — isolation suite green. Manually try a query without context; it must throw.

---

## Step 1.2 — Label and vocabulary layer

**Goal:** no user-visible string is ever hardcoded again. Build this now or retrofit hundreds later.

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §24 and law 10.
>
> Build the label layer.
>
> Files: `prisma/schema.prisma` (LabelOverride), `src/lib/labels/resolveLabel.ts`, `src/lib/labels/systemDefaults.ts`, `src/components/Label.tsx`, `src/lib/labels/__tests__/`, `eslint-rules/no-literal-user-strings.js`, migration.
>
> Requirements:
> 1. `resolveLabel(key, context, locale)` with six-level precedence: binding > question > template > site type > tenant > system default. Most specific wins; fall through cleanly.
> 2. Locale-aware: the same key resolves per language, falling back to the tenant default then the system default.
> 3. A `<Label>` component that is the only way a label reaches the DOM.
> 4. An ESLint rule that flags string literals rendered as JSX text outside `src/lib/labels/`.
> 5. Tests for every precedence level, missing-key behaviour, and locale fallback.
>
> Acceptance: renaming a label changes no code and no stored value; the lint rule catches a deliberately added literal.
>
> Do not touch the tenancy layer.

---

## Step 1.3 — Units, dimensions and fuel properties

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §5.2 and §E3.
>
> Build the units layer.
>
> Files: `prisma/schema.prisma` (UnitDimension, Unit, Material, FuelProperty), `src/lib/units/`, tests, migration.
>
> Requirements:
> 1. `UnitCode` as a TypeScript type derived from the seeded unit set — never a bare string in any signature.
> 2. Dimensions: volume, mass, energy, distance, currency, count, area, time, and composite (tonne-km, passenger-km). Every unit belongs to exactly one dimension with a conversion to that dimension's base.
> 3. `convert(value, from, to)` using Decimal. Same dimension converts; different dimensions THROW a typed `CrossDimensionError`.
> 4. A separate `bridge(value, from, to, material, date)` that uses a dated, sourced FuelProperty (calorific value, density) to cross dimensions. Missing property throws with a message naming the material and the property needed.
> 5. Currency never converts implicitly; an FX rate is a dated stored input.
> 6. Tenants may add units; system units are read-only (nullable `tenant_id`, null = platform).
>
> Acceptance: `convert(100, 'L', 'GJ')` throws; `bridge(100, 'L', 'GJ', 'diesel', date)` returns a Decimal; every conversion path has a test.

---

# PHASE 2 — THE CALCULATING CORE (E4–E7)

## Step 2.1 — Collection periods and site tree

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §5.1, §5.3.
>
> Build collection periods and the site hierarchy.
>
> Files: `prisma/schema.prisma`, `src/lib/periods/`, `src/lib/sites/`, tests, migration.
>
> Requirements:
> 1. CollectionPeriod with state machine Open → Closed → Locked. Transitions are functions; illegal transitions throw. A write to a locked period throws `PeriodLockedError`.
> 2. Site as a self-referencing tree to six levels, with permanent `site_code`, label key, and attributes: country, region, site_type, floor_area, headcount, ownership_share, consolidation_approach, valid_from, valid_to.
> 3. Site versioning so an acquisition or divestment mid-period resolves correctly: `resolveSites(period)` returns the sites in scope with their effective attributes.
> 4. A path column or closure table maintained on write, so a six-level roll-up is a single indexed query, not a recursive CTE per request.
> 5. Depth limit enforced; cycle impossible.
>
> Acceptance: a six-level tree roll-up returns in one query; a write to a locked period throws; a site divested mid-year appears in the prior period and not the next.

---

## Step 2.2 — Positions

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §5.4, §11.
>
> Build the Position model — the atom of the whole product.
>
> Files: `prisma/schema.prisma`, `src/lib/positions/`, tests, migration.
>
> Requirements:
> 1. Six types: asset, flow, indicator, overview, question, text. Type and dimension are immutable once any data exists against the position.
> 2. Fields: permanent `position_code`, label key, type, dimension, allowed_units, default_unit, parent_id, owner, help_text key, `visible_if`, `formula_ast` (indicator only), tags.
> 3. Positions are global within a tenant and reusable across any number of questionnaires. They are NOT owned by a questionnaire.
> 4. Asset positions are keyed `(position, site, valid_from)` with open-ended validity; a change writes a new versioned row, never an update. `resolveAssetValue(position, site, period)` returns the value effective for that period.
> 5. Flow positions are keyed `(position, site, period, line)` and support many lines per period.
>
> Acceptance: an asset value set in 2025 still resolves for 2025 after a 2026 change; a position appears in two questionnaires and is one storage slot; changing a position's type when data exists throws.

---

## Step 2.3 — Factors and Impact Profile

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §4.5, §20.
>
> Build the factor library and the Impact Profile resolution engine.
>
> Files: `prisma/schema.prisma`, `src/lib/factors/`, tests, migration.
>
> Requirements:
> 1. EmissionFactor: value Decimal(24,12), num_unit, den_unit, gas or co2e, gwp_set, source, publication, version, valid_from, valid_to, geography, method, uncertainty. Nullable `tenant_id` — null means platform-global; a tenant row shadows a global row and records what it overrode.
> 2. GwpSet with AR4, AR5, AR6 seeded.
> 3. ImpactProfile with version and state (draft / active / superseded), containing FactorAssignments that bind a factor to a position, optionally narrowed by site, site_type, period, or custom-field selector.
> 4. `resolveFactor(position, context)` applying precedence line > site > site_type > tenant > default. Exactly one match proceeds. More than one throws `AmbiguousBindingError`. None throws `NoBindingError`. Never return a default and never return zero.
> 5. `checkBindingHealth(questionnaire)` returning every position whose binding is missing or ambiguous.
> 6. `sliceByFactorValidity(line, period)` splitting a line when a factor's validity ends mid-period, returning apportioned sub-intervals.
> 7. `diffProfiles(a, b)` returning added, removed and changed assignments.
>
> Acceptance tests: tie throws; none throws; a mid-year factor change produces two slices with quantities summing to the original; a tenant factor shadows a global one; a superseded factor still resolves for its own validity window.

---

## Step 2.4 — The calculation engine

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §9. This is the heart of the product; treat it accordingly.
>
> Build the calculation engine as pure functions.
>
> Files: `src/lib/calc/emissions.ts`, `src/lib/calc/dualBasis.ts`, `src/lib/calc/version.ts`, `src/lib/calc/__tests__/`, `prisma/schema.prisma` (EmissionRecord), migration.
>
> Requirements:
> 1. `calculate(line, factor, gwp, consolidationShare) -> EmissionRecordInput`. Pure: no Prisma, no fetch, no Date.now(), no Math.random().
> 2. Pipeline: unit normalisation → denominator alignment (same dimension converts, cross dimension uses a FuelProperty bridge, otherwise throws) → multiply by factor → apply GWP → apply consolidation share.
> 3. EmissionRecord stores every input listed in CLAUDE.md rule 2, plus scope, category, method, calculated_at, and an `inputs_hash`.
> 4. `calculateDualBasis()` produces location-based and market-based Scope 2 records for the same line, both stored.
> 5. `CALC_ENGINE_VERSION` exported as a constant and written to every record.
> 6. Decimal end to end. No float appears anywhere in this module.
>
> Required tests — all must exist:
> - a diesel record with a superseded factor recalculates to its original value
> - a mid-year factor split produces two records summing to the single-factor result within rounding tolerance
> - a unit mismatch with no fuel-property bridge throws
> - Scope 2 dual basis produces two records with different values and the same quantity
> - consolidation share of 0.5 halves the result
> - a locked period refuses recalculation
>
> Do not touch `src/lib/tenancy/` or `src/lib/labels/`.

---

## Step 2.5 — The formula (indicator) engine

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §10.
>
> Build the indicator formula engine.
>
> Files: `src/lib/formula/parse.ts`, `src/lib/formula/evaluate.ts`, `src/lib/formula/graph.ts`, tests, `prisma/schema.prisma` (IndicatorDependency), migration.
>
> Requirements:
> 1. Parse a formula string into an AST. Never `eval`, never `new Function`.
> 2. Operators `+ - * /`, parentheses, comparisons, conditionals, and functions SUM, AVG, MIN, MAX, PRIOR_PERIOD, SITE_ATTRIBUTE.
> 3. Dimension type-checking at parse time: kWh + L is rejected; kWh / m² yields an intensity dimension.
> 4. Dependencies stored as edges. Saving a formula runs cycle detection and rejects a cycle at save time with the cycle path in the error.
> 5. Topological evaluation per site × period, memoised, invalidated by any upstream write.
> 6. Missing upstream value, division by zero and partial period return a typed null carrying a reason. Never 0.
> 7. Overview positions: sum over the sub-tree with an explicit flag for whether sites acquired mid-period are included.
>
> Acceptance: a cycle is rejected at save; kWh + L is rejected at parse; a missing input yields `{ value: null, reason: 'UPSTREAM_MISSING', position: '...' }`.

---

## Step 2.6 — Seed data and the integrity test

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §21.2.
>
> Build industry-neutral seed data and prove it before it reaches a database.
>
> Files: `prisma/seed-data.ts`, `prisma/seed.ts`, `src/lib/__tests__/seed-integrity.test.ts`.
>
> Requirements:
> 1. Platform content: unit dimensions, base units, GWP sets, a real national emission-factor set with sources and validity dates.
> 2. A starter tenant template: positions covering Scope 1, Scope 2 and a realistic subset of Scope 3, a questionnaire assembled from them, an impact profile binding every position, four sites across two levels, and label defaults.
> 3. Deliberately industry-neutral. No hospital, no manufacturing, no vertical assumptions in any code, label or seed.
> 4. One site left at partial completion so demo screens show a mid-progress state.
> 5. `seed-integrity.test.ts` asserts, without any database: every binding in the seed resolves to exactly one factor; every unit referenced exists; every position's dimension matches its factor's denominator dimension or has a fuel-property bridge; no orphan references.
>
> Acceptance: the integrity test catches a deliberately broken binding when you introduce one.

---

# PHASE 3 — THE PRODUCT SURFACE (E8–E12)

## Step 3.1 — Questionnaires, custom fields, publish gate

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §5.5, §5.7, §E8.
>
> Build questionnaire assembly and custom fields.
>
> Files: `prisma/schema.prisma`, `src/lib/questionnaires/`, `src/lib/visibility/`, tests, migration.
>
> Requirements:
> 1. A questionnaire is built by FILTERING the global position pool by tag, category or scope, then ordering the result into sections. Positions are referenced, never owned.
> 2. Questionnaire versioning with state draft / published / retired.
> 3. Publish gate: `publish()` calls `checkBindingHealth()` and refuses if any position has a missing or ambiguous binding, listing them in the error.
> 4. CustomField definitions (dropdown, date, number, text, lookup, boolean) with options, required flag and default, bound to a questionnaire or to specific positions.
> 5. `evaluateVisibility(visibleIf, answers, siteAttributes)` as ONE pure function exported for both client and server, plus `computeCompleteness()`.
> 6. A shared test vector proving client and server produce identical visibility results.
>
> Acceptance: publishing a questionnaire with one broken binding fails with that position named; the same visibility vector gives identical output in both call sites.

---

## Step 3.2 — Transaction lines and the entry API

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §8.3, §14.
>
> Build the transaction-line data layer and the assignment workflow.
>
> Files: `prisma/schema.prisma`, `src/lib/lines/`, `src/lib/assignments/`, `src/app/api/lines/`, `src/app/api/assignments/`, tests, migration.
>
> Requirements:
> 1. TransactionLine with tenant, position, site, period, value Decimal(20,6), unit_code, source, import_batch_id, entered_by, entered_at, updated_at. Many lines per position per period.
> 2. CustomFieldValue rows attached to a line. Attachment rows with object key and checksum.
> 3. Optimistic concurrency: a write carrying a stale `updated_at` is rejected with a typed conflict error.
> 4. Assignment with control_level and the state machine Not started → In progress → Submitted → Under review → Approved → Locked, with optional four-eyes (submitter ≠ approver, enforced server-side).
> 5. Zod schemas on every API boundary. UI code can never write a line without passing through this layer.
> 6. Writing a line enqueues calculation for `(position, site, period)`.
>
> Acceptance: a stale write is rejected; four-eyes blocks self-approval; every transition writes an audit event in the same transaction.

---

## Step 3.3 — Audit, versioning, restore points

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §15.
>
> Build the audit and recovery layer.
>
> Files: `prisma/schema.prisma` (AuditEvent, Snapshot, Restatement), `src/lib/audit/`, `src/lib/snapshots/`, migration with grants, tests.
>
> Requirements:
> 1. AuditEvent written in the SAME transaction as the change. Provide a transaction helper that makes it impossible to write a change without one.
> 2. The audit table is append-only at the database level: revoke UPDATE and DELETE in the migration.
> 3. Every event carries tenant, actor, entity, entity_id, action, before, after, at, ip, request_id.
> 4. Snapshot job at four retention tiers (1 day, 1 week, 1 month, 3 months) per tenant, stored in the object store, with a restore that first produces a preview diff.
> 5. Restatement flow: a change to a locked period is only possible as a Restatement carrying reason, author, approver and a diff reference.
>
> Acceptance: an attempted UPDATE on the audit table fails at the database; a restore preview lists what would change before anything is written.

---

## Step 3.4 — Data Acquisition UI

**Prompt:**
> Read CLAUDE.md, GHG_TOOL_ARCHITECTURE.md §2.1 and UX.md.
>
> Build the Data Acquisition screens.
>
> Files: `src/app/(app)/data/`, `src/components/entry/`, tests.
>
> Requirements:
> 1. Acquisition home: the site tree with, per node, assigned questionnaires, assignee, reviewer, control level, completion percentage, status, due date and a rule-violation badge.
> 2. Entry form: one row per position grouped into sections; multiple lines per position; unit selector limited to allowed units; custom fields inline on the line; comment and attachment per line; inherited-value display for asset positions with an override action.
> 3. Conditional visibility via the shared `evaluateVisibility` — never reimplemented in a component.
> 4. Inline validation, autosave with the optimistic-concurrency token, a clear saved/dirty indicator, keyboard-first tab order, and paste-a-column-from-Excel into the grid.
> 5. Running completeness meter, and workflow action buttons wired to the assignment state machine.
> 6. Every user-visible string goes through `<Label>`.
>
> Acceptance: a questionnaire can be completed, submitted, reviewed, approved and locked end to end; the lint rule reports zero literal strings; no component imports from `src/lib/calc/`.

---

## Step 3.5 — Import, export and Connection Center

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §12, §4.7, §2.2, §2.3.
>
> Build the import and export pipeline.
>
> Files: `src/lib/import/`, `src/lib/export/`, `src/app/(app)/import/`, `prisma/schema.prisma` (MappingProfile, ColumnMapping, ImportBatch, ImportRow), tests, migration.
>
> Requirements:
> 1. Master workbook generator: every position assigned in scope, hidden key columns (tenant, site_code, position_code, period_code, line_key), unit dropdowns as data validation.
> 2. Streamed xlsx/csv parser: configurable tab and header row, encoding and locale-aware number and date coercion. Must handle 100,000 rows without loading everything into memory.
> 3. MappingProfile: column → position × site × custom field, with unit and date rules, saveable and reusable. Interactive mapper UI that can save its result as a new profile.
> 4. Staging into ImportRow. NOTHING touches live data before the user accepts the preview.
> 5. Validator reporting, per row: unknown code, unit not allowed, period closed or locked, rule failure, duplicate line, overwrite conflict, type error — each with row number and human-readable reason, downloadable as an error report.
> 6. Atomic commit as an ImportBatch, writing batch id and source row on every line, then enqueuing calculation. Full batch rollback, audit-logged.
> 7. Questionnaire exporter producing a subset that re-imports losslessly even after visible columns are reordered or renamed.
>
> Acceptance: a 100,000-row import completes as a background job with progress; a rejected row names its number and reason; rollback restores the prior state exactly; an exported-then-reordered-then-reimported questionnaire round-trips with identical values.

---

## Step 3.6 — Rules and controls

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §13, §4.2.
>
> Build the rules engine.
>
> Files: `src/lib/rules/`, `src/app/(app)/management/rules/`, `prisma/schema.prisma` (Rule, RuleViolation), tests, migration.
>
> Requirements:
> 1. Rules stored as an AST like formulas — never an eval'd string. Reuse the formula parser where possible.
> 2. Rule types: hard limit, plausibility band versus prior period, mandatory comment, mandatory attachment, minimum data-quality level, cross-position consistency, completeness.
> 3. Severity `block` (prevents workflow progression) and `warn` (records a RuleViolation that must be acknowledged with a comment; the acknowledgement is audited).
> 4. Evaluated at three moments: on entry, on submit, on import.
> 5. Rules are versioned; a violation stores the rule version that produced it.
> 6. Test-run: evaluate a draft rule against historical data and report how many past lines it would have flagged, without writing anything.
>
> Acceptance: a blocking rule prevents submission; a warning requires an audited acknowledgement; a test-run writes nothing.

---

# PHASE 4 — REPORTING (E13–E15)

## Step 4.1 — Analytics fact tables and query API

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §16.
>
> Build the analytics layer.
>
> Files: `prisma/schema.prisma` (fact and dim tables), `src/lib/analytics/`, `src/app/api/analytics/query/route.ts`, tests, migration.
>
> Requirements:
> 1. Star schema: `fact_emission`, `fact_activity`, with `dim_site`, `dim_period`, `dim_position`, `dim_questionnaire`, `dim_custom_field`, `dim_factor`. Partitioned by tenant and period.
> 2. Incremental materialisation driven by calculation jobs. Analytics NEVER queries the transactional tables.
> 3. One query contract: `POST /api/analytics/query` taking rows, columns, measures, filters and a scope token, returning a typed result with subtotals.
> 4. Drill-through from any cell to the underlying transaction lines.
> 5. A seeded performance test with one million fact rows asserting the pivot returns within the §5 budget.
>
> Acceptance: the performance test passes; a drill-through reaches individual lines; no analytics code path imports the transactional models.

---

## Step 4.2 — Reports, charts, Intelligence Center

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §3.
>
> Build the analytics UI.
>
> Files: `src/app/(app)/analytics/`, `src/components/charts/`, `prisma/schema.prisma` (SavedView), migration, tests.
>
> Requirements:
> 1. Query-builder UI (rows / columns / measures / filters) posting to the single analytics contract.
> 2. The seven report types from §3.1, each a preset of that builder: performance, qualitative evaluation, transaction report, collection status, rule validation, structural report, factor usage.
> 3. A chart layer — line, stacked bar, treemap — sharing one tokenised palette, legible in light and dark, accessible.
> 4. SavedView: filter and chart state as JSON, with name, owner, description, visibility (private / role / tenant), folders, versioning, and pin-to-dashboard.
> 5. Data Exporter: xlsx/csv from any view with a header toggle between display labels and machine codes, plus export history.
>
> Acceptance: a saved view survives a reload and renders identically for a second user it is shared with; an export with machine codes re-imports through the File Importer.

---

## Step 4.3 — Dashboard

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §1.
>
> Build the dashboard.
>
> Files: `src/app/(app)/page.tsx`, `src/components/tiles/`, tests.
>
> Requirements:
> 1. The eight tiles listed in §1, each a component taking a scope token `(tenant, site subtree, period)` and rendering identically at group or site level.
> 2. Every tile reads from the analytics fact tables. None reads a transactional table.
> 3. Layout is a SavedView: pin, remove, reorder; a default layout per role.
> 4. First-class empty states — a brand-new tenant sees onboarding prompts, not zeros.
> 5. Both the emissions view and the raw-data view, switchable, because early in a collection cycle only raw data exists.
>
> Acceptance: the same tile component renders correctly at group and at single-site scope; a fresh tenant shows onboarding, not an empty chart.

---

## Step 4.4 — Management module

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §4.1, §4.3, §4.4, §4.6, §17.
>
> Build the Management module.
>
> Files: `src/app/(app)/management/`, `src/lib/targets/`, `src/lib/disclosure/`, `src/lib/content/`, schema, migration, tests.
>
> Requirements:
> 1. Targets: absolute, intensity, per scope, per site, with base year, target year, interpolated trajectory, and actual-versus-trajectory tracking. Action register with owner, expected abatement, cost and status.
> 2. Benchmarks as comparison series attachable to any analysis.
> 3. Disclosure frameworks held AS DATA: framework → datapoints → mapping to positions or indicators, plus narrative slots and evidence attachments. Readiness report: required / populated / gapped / below required quality.
> 4. Content Updates: a release feed with changelog and diff, an explicit Adopt action with a preview of what would change, adoption recorded with who and when, and NO automatic recalculation — recalculation is a separate, explicit, diff-reporting job.
>
> Acceptance: adopting a content release changes zero stored numbers until a recalculation is explicitly run; a readiness report lists gaps by datapoint; adding a new framework requires no code change.

---

## Step 4.5 — Administration

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §6, §22.
>
> Build the Administration module.
>
> Files: `src/app/(app)/admin/`, `src/lib/authz/`, schema, migration, tests.
>
> Requirements:
> 1. User management: invite, deactivate, bulk import, delegation during absence.
> 2. Roles with per-module entitlements; site-scoped access granting a role over a site subtree.
> 3. An effective-permission viewer: pick a user, see exactly what they can do where, and why.
> 4. Welcome content per tenant, password policy, MFA enforcement, session timeout, IP allow-list, versioned T&Cs with per-user acceptance.
> 5. Application log viewer over AuditEvent: filter by actor, entity, action, date; exportable.
> 6. Notification schedules with reminders, escalation and digests.
>
> Acceptance: the effective-permission viewer explains a denial by naming the rule that caused it; every admin action appears in the log.

---

# PHASE 5 — SELLING IT TO MANY CUSTOMERS (E16–E17)

*This is the phase that is always underestimated. Nothing here is visible to a user, and none of it can be skipped.*

## Step 5.1 — Provisioning and configuration templates

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §21.
>
> Build tenant provisioning and configuration templates.
>
> Files: `src/lib/provisioning/`, `src/lib/templates/`, `scripts/provision-tenant.ts`, tests.
>
> Requirements:
> 1. `provisionTenant({slug, name, region, plan, template, adminEmail})` — idempotent, scripted, API-driven. Creates the tenant, seeds from a configuration template, creates the first admin and invitation, creates the object-store prefix, takes the first restore point.
> 2. A ConfigurationTemplate is an exportable, versioned bundle: positions, questionnaires, tags, custom fields, rules, label sets, impact-profile bindings, default dashboards.
> 3. `exportTemplate(tenant)` and `importTemplate(tenant, bundle)` with code-collision detection and a DRY-RUN DIFF before anything is written.
> 4. Sandbox tenants: a linked tenant with `type = sandbox` and a one-way "copy configuration from production" action.
>
> Acceptance: a new tenant is live from one command in under a minute; a template exported from tenant A imports into tenant B with a diff shown first; a code collision is reported, not silently renamed.

---

## Step 5.2 — Entitlements, plans and metering

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §23.
>
> Build entitlements and usage metering.
>
> Files: `src/lib/entitlements/`, `src/lib/metering/`, tests.
>
> Requirements:
> 1. One `can(tenant, featureCode)` check used by BOTH the API and the UI. Features are codes in a registry, never booleans scattered through the code.
> 2. Metered limits: sites, users, transaction lines, storage, API calls, sandboxes. Soft limits warn, hard limits block, and both are visible to the customer before they are hit.
> 3. Usage written to a metering table, aggregated nightly, exposed to the tenant and to an internal report.
> 4. A plan change takes effect purely through the entitlement path — never a migration.
>
> Acceptance: disabling a feature hides it in the UI and rejects it at the API in the same commit; exceeding a soft limit warns and keeps working; exceeding a hard limit blocks with a clear message.

---

## Step 5.3 — SSO, SCIM and enterprise identity

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §22.
>
> Build enterprise identity.
>
> Files: `src/lib/auth/`, `prisma/schema.prisma` (IdentityProvider, ApiKey), migration, tests.
>
> Requirements:
> 1. Per-tenant IdentityProvider: password, SAML 2.0, or OIDC, with domain-based discovery — a user types their email and is routed to their company's IdP.
> 2. Just-in-time user creation with role mapping from IdP groups.
> 3. SCIM 2.0 endpoints for user and group provisioning and deprovisioning.
> 4. Service accounts and scoped API keys, hashed at rest, with last-used tracking and rotation.
> 5. A PlatformUser is global and unique by email; Membership links it to tenants. One consultant belongs to five tenants and switches between them.
> 6. Session policy per tenant: timeout, concurrent sessions, IP allow-list.
>
> Acceptance: two tenants with different IdPs both authenticate; a SCIM deprovision immediately revokes access; a consultant switches tenants without re-authenticating, and sees only the active tenant's data.

---

## Step 5.4 — Platform Console

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §26, §27.
>
> Build the internal Platform Console, separate from the tenant app.
>
> Files: `src/app/(platform)/`, `src/lib/platform/`, tests.
>
> Requirements:
> 1. Tenant list with plan, usage, health and last activity. Provision, suspend, resume and delete actions.
> 2. Content release management: author, validate, stage, publish; per-tenant adoption status.
> 3. Job queue view: failed imports, stuck calculations, retry and cancel.
> 4. Support access / impersonation: time-boxed, reason required, tenant notified, fully audit-logged, READ-ONLY by default with an explicit escalation to write. Never a silent back door.
> 5. Feature-flag control per tenant with staged rollout: internal → pilot → all.
> 6. Migration and backfill runner with per-tenant progress and resume.
>
> Acceptance: an impersonation session appears in the TENANT's audit log as well as the platform log, expires automatically, and cannot write unless explicitly escalated.

---

## Step 5.5 — Offboarding, residency and data rights

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §21.4, §25.
>
> Build data-rights and residency handling.
>
> Files: `src/lib/dataRights/`, `src/lib/regions/`, tests.
>
> Requirements:
> 1. Full tenant export: every table as csv/json plus every attachment, generated as a background job, delivered as a signed download.
> 2. Suspension (read-only) as a state distinct from deletion.
> 3. Hard deletion with a retention window, a deletion certificate, an audit entry, and purge of object storage, caches, search indexes and backups after their retention window.
> 4. A `region` on the tenant record that selects the database cluster and object-store bucket. Build the indirection even while running one region.
> 5. A documented list of what leaves the region: email, error tracking, support access, backups.
>
> Acceptance: an export round-trips into a fresh tenant; a deleted tenant leaves no rows, objects or cache entries; adding a second region requires no changes to data-access code.

---

## Step 5.6 — Hardening

**Prompt:**
> Read CLAUDE.md and GHG_TOOL_ARCHITECTURE.md §28, §29, and Part 5.
>
> Harden the platform for production and for procurement review.
>
> Files: `.github/workflows/`, `src/lib/observability/`, `src/middleware.ts`, `docs/runbooks/`, tests.
>
> Requirements:
> 1. Structured logs carrying tenant_id, user_id and request_id on every line, with no PII. Traces on API and worker paths. Error tracking tagged by tenant.
> 2. Per-tenant metrics: active users, lines written, imports run, calculation duration, failure rate.
> 3. Alerts on queue depth, failed jobs, calculation errors, auth failures, error-rate spikes, and ANY RLS violation — which must be treated as a security incident, because it should be impossible.
> 4. Per-tenant rate limits and job concurrency caps so one customer's two-million-row import cannot starve the others.
> 5. CI: dependency scanning, SAST, container scanning, the isolation suite, and load tests against the Part 5 budgets.
> 6. Automated backups with a QUARTERLY RESTORE TEST that is scripted and produces evidence.
> 7. Security headers, CSP, secret manager integration, and a documented incident-response and DR runbook with stated RPO and RTO.
>
> Acceptance: the restore test runs end to end and produces a dated evidence artefact; a simulated failure fires the right alert; load tests meet the budgets.

---

# 6. Standing checks

Run these regularly, not just at the end.

**After every step:**
```
npm run verify     # schema validate + typecheck + tests
```

**Weekly:**
> Audit the codebase against CLAUDE.md's thirteen non-negotiables. For each one, name a file and line that violates it, or state that it holds. Do not fix anything — report first.

**Before any release:**
> List every code path that writes to the database without producing an audit event in the same transaction. List every query that could execute without a tenant scope. List every place a float could reach a stored quantity.

**Before the first customer:**
- [ ] Cross-tenant isolation suite green
- [ ] A restore test completed and documented
- [ ] Factor snapshotting proven by the superseded-factor test
- [ ] Period locking and restatement working
- [ ] Binding-health publish gate working
- [ ] Provisioning script produces a working tenant from scratch
- [ ] An export of everything a customer owns can be produced on request

---

# 7. Order of steps at a glance

| Phase | Steps | Milestone |
|---|---|---|
| 1 Foundation | 1.1 – 1.3 | Tenancy, labels, units |
| 2 Calculating core | 2.1 – 2.6 | A number can be produced and defended |
| 3 Product surface | 3.1 – 3.6 | A human can collect and submit data |
| 4 Reporting | 4.1 – 4.5 | The organisation can see and steer |
| 5 Multi-customer | 5.1 – 5.6 | It can be sold more than once |

Do not start Phase 5 work early, and do not defer it indefinitely. Everything in it is invisible to users and mandatory for customers.
