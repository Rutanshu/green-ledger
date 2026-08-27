# My GHG Emission Tool — Architecture & Build Specification

**Product:** Green Ledger — a multi-tenant GHG accounting and sustainability reporting platform
**Owner:** Rutanshu
**Version:** 2.0 · 27 August 2026
**Companion document:** `BUILD_PLAN.md` (the phased action plan to hand to Claude in VS Code)

---

## How to read this document

| Part | Contains | Use it for |
|---|---|---|
| **Part 0** | The core idea and the ten laws | Understanding *why* the model is shaped this way |
| **Part 1** | Every module and every screen to build | Scoping the UI work |
| **Part 2** | The technical architecture | Schema, engines, pipelines |
| **Part 3** | Multi-tenant productisation | Everything needed to sell this to more than one company |
| **Part 4** | Full development backlog | Epic-by-epic, with acceptance criteria |
| **Part 5** | Non-functional requirements | Performance, security, compliance targets |
| **Part 6** | Effort, sequencing, and what to cut | Planning |

---

# PART 0 — THE CORE IDEA

## 0.1 The one abstraction

Every screen in this product is a view over **one generic table of data points**. There is no diesel table and no electricity table. There is a **Position**: an abstract, typed, permanently identified slot where a number or a piece of text can be stored, for a given site, in a given collection period, on a given transaction line.

Everything else is configuration layered on that atom:

| Layer | What it does | Entity |
|---|---|---|
| Positions | Define *what can be stored* | `Position` |
| Questionnaires | Group and order positions into *a form a human fills in* | `Questionnaire` |
| Sites | Define *where* a value belongs (5–6 levels) | `Site` |
| Collection periods | Define *when* a value belongs to | `CollectionPeriod` |
| Impact profiles | Bind positions to *emission factors* | `ImpactProfile`, `FactorAssignment` |
| Indicators | Compute new positions from other positions | `Position(type=indicator)` |
| Custom fields | Add dimensions to one transaction line | `CustomField` |
| Rules | Constrain what may be stored | `Rule` |
| Analytics | Slice the resulting fact table | `SavedView` |

**This is why one codebase can serve a steel mill, a hospital group and a bank.** All vertical knowledge lives in *data* — positions, questionnaires, factors, labels — never in code. It is also the reason the product is sellable to multiple customers without a fork per customer, which is the entire subject of Part 3.

## 0.2 The ten laws

These go into `CLAUDE.md` verbatim and are enforced in code review.

1. **Emissions arithmetic lives only in `lib/calc/`.** Pure functions. No database, no `fetch`, no `Date.now()`, no `Math.random()`. If a UI component multiplies anything by an emission factor, that is a bug.
2. **Every number is traceable.** An emission record stores every input — quantity, unit, factor value, factor version, GWP set, conversion factor, consolidation share, engine version — not just the result.
3. **Factors are immutable once referenced.** A correction creates a new version with a new `valid_from`. Recalculation is explicit, user-triggered, audit-logged, and refused on locked periods.
4. **Units are a type, never a string.** Cross-dimension conversion (litres → GJ) is a *fuel property*, not a unit conversion, and must be modelled separately.
5. **No floats.** `Decimal` end to end. Round only at display and export.
6. **Every query is tenant-scoped** — enforced by both an ORM extension and Postgres row-level security. Two independent mechanisms, because one will eventually be bypassed.
7. **Audit events are written in the same transaction** as the change they describe.
8. **Locked periods are immutable.** Corrections go through restatement.
9. **A position cannot be published into a questionnaire with a broken or ambiguous factor binding.** A form that silently records zeros is the worst possible bug in this product.
10. **No hardcoded user-visible strings.** Every label resolves through the label layer. Codes belong to the system; labels belong to the customer.

---

# PART 1 — MODULES AND SCREENS TO BUILD

The shell is constant: a left rail of modules, a main canvas. The rail is **composed from the user's role and entitlements**, not hidden by scattered permission checks.

```
┌────────────────┬─────────────────────────────────────────────┐
│ ⬸ Dashboard    │                                              │
│ ⬸ Data Entry   │        Main canvas                           │
│ ⬸ Analytics    │        (charts, grids, forms, editors)       │
│ ⬸ Management   │                                              │
│ ⬸ Setup        │                                              │
│ ⬸ Admin        │                                              │
└────────────────┴─────────────────────────────────────────────┘
```

---

## 1. Dashboard module

**Job:** answer *where do we stand* with zero configuration by the user.

### Screens to build
| Screen | Route | Contents |
|---|---|---|
| Overview dashboard | `/` | Tile grid, scope-aware |
| Site dashboard | `/sites/[id]` | Same tiles, single-site scope |
| My tasks | `/tasks` | Assignments owed by this user |

### Tiles to build (each a reusable component)
- **Emissions summary** — Scope 1 / Scope 2 location / Scope 2 market / Scope 3, current period, with prior-year delta.
- **Emissions trend** — multi-year line, stacked by scope.
- **Raw-data summary** — collected quantities by dimension (litres, kWh, tonnes, km). Essential: in month two of a collection cycle there are no emissions yet, only inputs.
- **Collection progress** — % complete by site and by assignee, with a bar per site.
- **Data-quality mix** — measured / calculated / estimated share as a stacked bar.
- **Exceptions** — count of failed rules, missing factor bindings, overdue assignments, each linking into the relevant module.
- **Target tracker** — actual versus trajectory, gap to target.
- **My tasks** — the current user's open assignments with due dates.

### Behaviour to implement
- Every tile takes a **scope token** `(tenant, site subtree, period)` and renders identically at group or site level.
- Tiles read from the **analytics fact tables**, never from transactional tables.
- Layout is a **saved view** — the user can pin, remove and reorder tiles; the default layout is per role.
- Empty states are first-class: a brand-new tenant sees onboarding prompts, not zeros.

---

## 2. Data Entry module

### 2.1 Data Acquisition (direct entry)

**Screens**
| Screen | Route | Contents |
|---|---|---|
| Acquisition home | `/data` | Site tree with per-node assignment summary |
| Questionnaire form | `/data/[assignmentId]` | The actual data-entry form |
| Line detail | drawer | Custom fields, comment, attachments, history |

**Acquisition home must show, per site tree node:**
- questionnaires assigned to it,
- assignee and reviewer,
- each person's control level (fill / review / approve / read),
- completion — answered positions ÷ visible positions,
- workflow status and due date,
- a rule-violation badge.

**Questionnaire form must support:**
- one row per position, grouped into sections;
- unit selector limited to the position's allowed units;
- multiple **transaction lines** per position (twelve monthly invoices, four quarters, three suppliers), each with its own custom-field values;
- custom fields rendered inline on the line (dropdown, date, number, text, lookup);
- comment and file attachment per line;
- conditional visibility via `visible_if`, evaluated by **one shared pure function** used by client and server;
- inline rule validation as the user types, blocking rules preventing submit;
- autosave with optimistic concurrency, and a clear saved/dirty indicator;
- keyboard-first entry — tab order, paste a column from Excel into a grid;
- inherited-value display for asset positions ("inherited from 2025 — override?");
- a running completeness meter.

**Workflow actions:** save draft → submit → return for correction → approve → lock. Four-eyes enforcement where configured.

### 2.2 File Importer

**Screens:** import home (batch list) → new import wizard (upload → map → validate → preview → commit) → batch detail (with rollback).

**Build:**
- **Master workbook generator** — produces a workbook covering everything assigned in scope, with hidden key columns (tenant, site code, position code, period code, line key) and a data-validation dropdown for units.
- **Parser** — xlsx and csv, streamed, configurable tab and header row, type coercion, locale-aware number and date parsing.
- **Mapper** — applies a `MappingProfile` from the Connection Center, or lets the user map columns interactively and save the result as a new profile.
- **Staging** — every row lands in `ImportRow` first. Nothing touches live data before the user accepts.
- **Validator** — unknown codes, unit not in allowed set, period closed or locked, rule failures, duplicate lines, overwrite conflicts, type errors. Each with a row number and a human-readable reason.
- **Preview** — N accepted / M rejected with reasons / K overwrites, downloadable as an error report.
- **Committer** — atomic, batched, writes `import_batch_id` and source row on every line, enqueues calculation for affected keys.
- **Rollback** — reverses a whole batch, audit-logged.

### 2.3 Questionnaire Exporter

**Build:** subset selection by site / questionnaire / tag / assignee → export to xlsx with hidden key columns and unit dropdowns → the returned file re-imports losslessly through the File Importer even if visible columns were reordered or renamed.

---

## 3. Analytics module

### 3.1 Analysis views

A pivot engine over the fact tables, sliceable by **site × period × position × questionnaire × custom field × tag × factor**, in raw or emission units, with drill-through to individual transaction lines.

**Report types to build**
| Report | Answers | Notes |
|---|---|---|
| Performance | Trend, intensity, variance vs target and prior year | Intensity denominators from site attributes |
| Qualitative evaluation | Text and choice answers across sites | Side-by-side matrix |
| Transaction report | Every line behind a number | The audit drill-down; must export |
| Collection status | Completeness and workflow state | Also feeds the dashboard tile |
| Rule validation | Every control that failed, with the value | Bulk acknowledge from here |
| Structural report | The configuration itself | Sites, positions, assignments, bindings — the pre-audit pack |
| Factor usage | Which factor produced which tonnage | Assurance question number one |

**Build:** a query builder UI (rows / columns / measures / filters), a chart renderer (line, stacked bar, treemap, sankey for scope flows), a pivot grid with subtotals, and a single `POST /api/analytics/query` contract that all of them use.

### 3.2 Intelligence Center

Saved analysis with filter state, name, owner, description, sharing (private / role / tenant), folder organisation, and "pin to dashboard". Versioned so a shared view cannot be silently changed under its consumers.

### 3.3 Data Exporter

Export any view — raw, calculated or configuration — to xlsx or csv, with a header-row toggle between **display labels** and **machine codes**, scheduled exports (weekly to an SFTP or e-mail), and a downloadable export history.

---

## 4. Management module

### 4.1 Targets & Actions
Target definition (absolute / intensity / per scope / per site / SBTi-style trajectory with base year and target year), automatic trajectory interpolation, actual-versus-trajectory tracking, and an **action register**: owner, expected abatement, cost, capex/opex, status, linked positions. Marginal abatement cost view.

### 4.2 Compliance & Controls
Rule builder UI over a declarative expression language: hard limits, plausibility bands versus prior period, mandatory comment, mandatory attachment, minimum data-quality level, cross-position consistency, completeness rules. Severity `block` or `warn`. Rule versioning and a test-run against historical data before activation.

### 4.3 Disclosure Management
Framework registry (CSRD/ESRS E1, GRI 305, CDP, ISSB/IFRS S2, national GHG programmes) held **as data**. Datapoint-to-position mapping, narrative text slots, evidence attachment, readiness dashboard (required / populated / gapped / below required quality), and export of a disclosure pack.

### 4.4 Benchmarks
Reference series — internal best performer, sector average, regulatory threshold — attachable to any analysis so results are shown against a standard.

### 4.5 Impact Profile — the emission-factor engine
**The most important module in Management.**

- **Factor library**: value, numerator unit, denominator unit, gas or CO₂e, GWP set (AR4/AR5/AR6), source, publication, version, `valid_from`/`valid_to`, geography, method (location-based / market-based / supplier-specific / spend-based / average-data), uncertainty, and notes.
- **Assignment**: which factor applies to which position, optionally narrowed by site, site type, period, or custom-field value.
- **Profile versioning**: the whole set is a version — `Impact Profile 2026 v1` — that can be drafted, tested, promoted, copied forward and **diffed** against its predecessor.
- **Health check / test binding**: for any position and context, show which factor *would* resolve, and fail loudly on ambiguity or absence.
- **Bulk import** of factor sets from DEFRA, EPA, IEA, ecoinvent-style exports.

### 4.6 Content Updates
The release channel. New government factors, a framework's new datapoints, platform schema changes — each appears with a changelog and an explicit **adopt** action, recorded with a date and an author. Nothing changes under the customer's feet.

### 4.7 Connection Center
Reusable **mapping profiles** for company-specific files and systems: workbook tab, header row, column → position × site × custom field, unit rules, date parsing, delimiter and encoding. Plus scheduled inbound feeds — SFTP drop, API push, e-mail attachment ingestion — with credential storage and a run history.

---

## 5. Setup module

Configuration only. No operational data.

### 5.1 Collection periods
Years, quarters, months. State machine **Open → Closed → Locked**. Locked periods reject writes; corrections require restatement. Period templates so a new year is one click.

### 5.2 Units
Base set across dimensions — volume, mass, energy, distance, currency, count, area, time, and composite (tonne-km, passenger-km). Each unit has exactly one dimension and a conversion to that dimension's base.

- **Cross-dimension conversion is impossible by construction.** Litres → GJ is a *fuel property* (calorific value), modelled as a dated, sourced conversion record attached to a material, never as a unit conversion.
- Currency never auto-converts; an FX rate is a dated, stored input.
- Tenants may add units; system units cannot be edited.

### 5.3 Sites
Level 1 → level 6 tree. Permanent `site_code`, renameable label. Attributes: country, region, site type, floor area, headcount, operating hours, ownership share, consolidation approach, operational start and end dates. Site versioning so an acquisition or divestment mid-year is handled correctly. Bulk import of the structure.

### 5.4 Positions — the atoms
| Type | Behaviour | Storage key |
|---|---|---|
| **Asset** | Carries forward year to year until changed — fleet count, refrigerant charge, contracted grid factor | `(position, site, valid_from)` |
| **Flow** | Collected fresh every period — litres, kWh | `(position, site, period, line)` |
| **Indicator** | Computed by formula from other positions | derived |
| **Overview** | Roll-up of positions beneath it | derived |
| **Question** | Choice or boolean — qualitative | as flow |
| **Text** | Free text only — narrative, method notes | as flow |

Each position has: permanent code, label, type, dimension, allowed unit set, default unit, owner, tags, description, help text, `visible_if` expression, and (for indicators) a formula.

### 5.5 Questionnaires
Assemblies of positions. The library is a flat pool; building a questionnaire means **filtering** by tag, category or scope and ordering the result into sections. The same position can appear in many questionnaires — still one storage slot. Questionnaire versioning, publish gate (all bindings healthy), preview-as-respondent, and assignment rules ("assign to every site of type Manufacturing").

### 5.6 Tagging
Free tags on positions and questionnaires: `scope3`, `cat-3.1`, `EU-sites`, `assured`, `ESRS-E1-6`. Drives questionnaire assembly, analytics filters, disclosure mapping and bulk assignment.

### 5.7 Custom fields
A position stores one number per line. Custom fields add dimensions to that same line: quarter, month, data quality, supplier, cost centre, evidence reference, comment. Typed (dropdown / date / number / text / lookup / boolean), defined once, attached to a questionnaire or to specific positions, with required/optional and default value.

### 5.8 Data-quality standards
Definition of the quality scale, which levels are acceptable per position or framework, uncertainty ranges, and roll-up rules for reporting a weighted quality score.

---

## 6. Administration module

| Area | Build |
|---|---|
| Users | Invite, deactivate, bulk import, delegation during absence |
| Roles | Role definitions and per-role module entitlements |
| Site access | Grant a user a role over a site subtree; effective-permission viewer |
| Welcome content | Editable landing content per tenant: instructions, deadlines, contacts |
| Password policy | Complexity, rotation, MFA enforcement, session timeout |
| IP allow-list | Per-tenant network restriction |
| Terms & conditions | Versioned, acceptance recorded per user |
| Application log | Login, change, export, permission events — filterable, exportable |
| Restore points | Snapshots at 1 day / 1 week / 1 month / 3 months, with preview-diff before restore |
| Notifications | Reminder schedules, escalation, digest settings |

**The log and the restore points are different tools.** The log tells you *what happened*; the restore point lets you *undo it*. Ship both.

---

# PART 2 — TECHNICAL ARCHITECTURE

## 7. System context

```
        ┌───────────────────────────────────────────────────────┐
        │                    Web client                           │
        │  Dashboard · Data Entry · Analytics · Mgmt · Setup · Adm │
        └─────────────────────────────┬───────────────────────────┘
                                    │ HTTPS / JSON
        ┌─────────────────────────────┼───────────────────────────┐
        │                    Application API                      │
        │   authn · tenancy · RBAC · validation · orchestration    │
        └──┬───────┬───────┬───────┬───────┬───────┬──────────┘
           │        │        │        │        │        │
    ┌──────┴──┐ ┌────┴────┐ ┌─┴──────┐ ┌┴──────┐ ┌┴─────┐ ┌┴───────┐
    │ Config  │ │ Intake │ │ Calc   │ │ Rules │ │Report│ │ Audit   │
    │ service │ │ import │ │ engine │ │engine │ │ / BI │ │ + vers. │
    └──────┬──┘ └────┬────┘ └─┬──────┘ └┬──────┘ └┬─────┘ └┬───────┘
           └────────┴────────┴──────────┴──────────┴─────────┘
                                    │
           ┌──────────────────────┼───────────────────────────┐
           │                        │                        │
   ┌───────┴───────┐    ┌──────────┴───────┐    ┌──────────┴─────┐
   │ Postgres       │    │ Object store      │    │ Job queue       │
   │ RLS tenancy    │    │ evidence, imports │    │ import, calc,   │
   │ + fact tables  │    │ exports, backups  │    │ snapshot, mail  │
   └───────────────────┘    └───────────────────┘    └─────────────────┘
```

A **modular monolith**: one deployable, six internal boundaries with no cross-imports, plus a worker process running the same codebase. Split into services only when a boundary actually becomes a scaling problem — realistically import and calculation first.

## 8. Domain model

### 8.1 Platform / tenancy entities *(new in v2 — see Part 3)*
```
Tenant          (slug, name, region, plan, status, created_at)
TenantSettings  (branding, locale, timezone, fiscal_year_start, features_json)
Subscription    (plan, seats, limits, period_start, period_end, status)
Entitlement     (tenant, feature_code, enabled, limit)
PlatformUser    (email, name, mfa, status)          ← global identity
Membership      (platform_user, tenant, role, status, invited_by)
IdentityProvider(tenant, type: password|saml|oidc, config, domain)
ApiKey          (tenant, scopes, hashed_secret, last_used_at)
```

### 8.2 Configuration entities
```
Site             (tenant, parent_id, level, site_code, label_key, attributes, valid_from/to)
CollectionPeriod (tenant, code, type, start, end, state)
UnitDimension    (code)
Unit             (tenant|system, code, dimension, factor_to_base)
Material         (code) ←→ FuelProperty (material, property, value, unit, valid_from, source)
Position         (tenant, position_code, type, dimension, allowed_units, parent_id,
                  formula_ast, visible_if, owner, help_text)
Questionnaire    (tenant, code, version, state) ←→ Section ←→ Item → Position
Tag ←→ TagAssignment (polymorphic)
CustomField (tenant, code, type, options) ←→ CustomFieldBinding → questionnaire|position
ImpactProfile    (tenant, code, version, state) ←→ FactorAssignment → Position
EmissionFactor   (tenant|global, code, value, num_unit, den_unit, gas, gwp_set,
                  source, publication, version, valid_from/to, geo, method, uncertainty)
GwpSet           (code, gas, value, source)
Rule             (tenant, target, expression_ast, severity, version)
Target ←→ Action
Benchmark
DisclosureFramework ←→ Datapoint ←→ DatapointMapping → Position|Indicator
MappingProfile ←→ ColumnMapping
LabelOverride    (tenant, scope_level, scope_id, key, locale, value)
```

### 8.3 Operational entities
```
Assignment       (tenant, questionnaire, site, period, user, control_level, due, state)
TransactionLine  (tenant, position, site, period, value, unit_code, source,
                  import_batch_id, entered_by, entered_at, updated_at)
CustomFieldValue (line, field, value)
Attachment       (line|entity, object_key, filename, checksum, size, uploaded_by)
EmissionRecord   (tenant, line, quantity_normalised, factor_value, factor_unit_num,
                  factor_unit_den, factor_source, factor_version, gwp_value, gwp_set,
                  unit_conversion_factor, consolidation_share, co2e, scope, category,
                  method, calc_engine_version, calculated_at, inputs_hash)
ImportBatch ←→ ImportRow
RuleViolation    (line, rule, rule_version, severity, acknowledged_by, comment)
AuditEvent       (tenant, actor, entity, entity_id, action, before, after, at, ip, request_id)
Snapshot         (tenant, scope, taken_at, retention_tier, payload_ref)
SavedView        (tenant, owner, module, filter_json, chart_json, visibility, version)
Restatement      (tenant, period, reason, author, diff_ref, approved_by)
```

### 8.4 Identity rules — non-negotiable
- Every configuration object has a **permanent machine code** and a **separately editable display label**. Renaming never touches a number, an import mapping or a historical report.
- Codes are unique within a tenant; `(tenant, code)` is the natural key used by imports and exports.
- Position codes look hierarchical (`3.1.2`) but the hierarchy is a real parent-child edge, never parsed from the string.
- Primary keys are opaque (cuid/uuid); codes are the human contract.

## 9. The calculation pipeline

```
Transaction line
  value 12,000   unit L   position POS-1.2.3 (diesel, mobile)
  site DE-01     period FY2026     custom: Q3, measured
       │
       ▼  (1) UNIT NORMALISATION
  L → base unit of dimension "volume"; original value and unit retained
       │
       ▼  (2) FACTOR RESOLUTION — ImpactProfile
  candidates = factors assigned to POS-1.2.3 in the active profile version
     filtered by: period overlap, site geography, site type,
                  custom-field selectors, method
  precedence: line > site > site-type > org > default
  exactly one match  → proceed
  more than one      → THROW (ambiguous binding)
  none               → THROW (never record a silent zero)
       │
       ▼  (3) DENOMINATOR ALIGNMENT
  factor is kgCO2e / litre → convert normalised quantity back to litres
  same dimension  → convert
  different dim.  → look for a FuelProperty bridge (calorific value etc.)
  no bridge       → THROW (configuration error, not a coercion)
       │
       ▼  (4) MULTIPLICATION + GWP + CONSOLIDATION
  co2e = quantity × factor_value × gwp(gas, gwp_set) × consolidation_share
       │
       ▼  (5) SNAPSHOT + PERSIST
  EmissionRecord stores every input above plus calc_engine_version
  and a hash of the inputs, so reproduction is provable
```

### Rules that keep it defensible
1. **Calculations are pure functions.** `calculate(line, factor, gwp, share) → record`. Everything else is orchestration.
2. **Every input is stored**, so a number is reconstructible from the record alone without re-reading current configuration.
3. **Mid-period factor changes split the line.** If a factor's validity ends mid-period, the quantity is apportioned across sub-intervals and produces two records. This is the classic silent error.
4. **Recalculation is explicit and versioned.** Every record carries `calc_engine_version`; a recalculation is a job with a batch id, a reason, an author, and a diff report showing every number that moved.
5. **Scope 2 is dual-basis always.** Location-based and market-based are both computed and both stored; a report chooses which to show.
6. **A position with a broken or ambiguous binding cannot be published.**

## 10. Indicator (formula) engine

- Formulas stored as an **AST**, never a string to `eval` — parsed once, validated against the position registry, and **dimension-checked**: you cannot add kWh to litres; kWh ÷ m² is a valid intensity.
- Supported: `+ − × ÷`, parentheses, comparison and conditionals, `SUM`, `AVG`, `MIN`, `MAX`, `PRIOR_PERIOD(x)`, `SITE_ATTRIBUTE(x)`, constants.
- Dependencies live in an edge table. Saving a formula runs **cycle detection**; a cycle is rejected at save time, not discovered mid-calculation.
- Evaluation is topological, per site × period, cached, invalidated by any upstream write.
- Overview positions are a restricted case: sum over the sub-tree, resolved through the site or position hierarchy, with an explicit choice of whether to include sites acquired mid-period.
- Division by zero, missing upstream values and partial periods produce a **typed null with a reason**, never a 0. A blank and a zero mean very different things in an assurance review.

## 11. Asset versus flow semantics

- **Flow positions** are keyed `(position, site, period, line)` — absent in a new period until entered.
- **Asset positions** are keyed `(position, site, valid_from)` with open-ended validity. Opening a new period does not clear them; the engine resolves the value effective for that period. A change writes a **new versioned row**, never an update, so prior periods still resolve to the old value.
- The UI shows carry-forward as *inherited from 2025 — override?*, so an unchanged value is a conscious confirmation rather than an accident.
- A "confirm all inherited values" bulk action, audit-logged, closes the year cleanly.

## 12. Import pipeline

```
Upload → virus scan → parse (tab, header row, encoding, locale coercion)
       → apply MappingProfile (column → position × site × custom field, unit + date rules)
       → stage into ImportRow            [nothing touches live data yet]
       → validate: known codes? unit allowed? period open? rules pass?
                   overwrite conflicts? duplicate lines? tenant scope?
       → preview: N accept / M reject (reasons) / K overwrite  + error report download
       → commit as ImportBatch           [atomic, reversible]
       → enqueue calculation for affected (position, site, period)
```

Every imported line records batch id and source row, so any number in any report traces back to cell `Sheet2!D47` of a named file uploaded by a named person at a named time.

## 13. Rules & controls engine

- Declarative expressions over a line's own value, its history, and sibling positions — stored as an AST like formulas.
- Evaluated at three moments: **on entry** (immediate feedback), **on submit** (blocking), **on import** (report).
- `block` prevents workflow progression; `warn` records a violation that must be acknowledged with a comment, and the acknowledgement is itself audited.
- Rules are versioned; a violation stores the rule version that produced it.
- A rule can be test-run against historical data before activation, showing how many past lines it would have flagged.

## 14. Roles, scoping & workflow

**Roles:** Platform Operator (your staff), Tenant Admin, Sustainability Manager, Site Contributor, Reviewer/Approver, Read-only, **Auditor** (read plus audit trail, never write).

Access is a triple `(role, site subtree, period)`, enforced in **one place** — a scope filter applied by the data-access layer — plus Postgres RLS as a second, independent net.

Assignment states: `Not started → In progress → Submitted → Under review → Approved → Locked`, with optional four-eyes (submitter ≠ approver). Locking a period freezes lines and emission records; further change requires a **restatement** carrying a reason, an author and a diff — exactly what an assurance provider asks for.

## 15. Audit trail, versioning & restore

| Mechanism | Grain | Purpose |
|---|---|---|
| **Audit trail** | Every write, append-only, same transaction | Who changed what, when, from where |
| **Entity versioning** | Config objects and asset values | What the configuration was when this number was produced |
| **Restore points** | Whole tenant: 1d / 1w / 1m / 3m | Undo a catastrophic import or config mistake |

Emission records additionally hold factor and GWP snapshots, so a published report is reproducible even after every restore point has expired. Audit events are append-only at the database level (no update or delete grant on the table).

## 16. Analytics layer

- A **star schema** materialised from operational tables: `fact_emission` and `fact_activity`, with `dim_site`, `dim_period`, `dim_position`, `dim_questionnaire`, `dim_custom_field`, `dim_factor`.
- Refreshed incrementally by calculation jobs; analytics never queries the write tables.
- `SavedView` stores filter and chart state as JSON, versioned and shareable. The Intelligence Center browses SavedViews; dashboard tiles are SavedViews pinned with a layout position.
- Exports render from the same fact tables, with the label/code header toggle.
- Partition fact tables by tenant and period once volume justifies it.

## 17. Disclosure layer

Frameworks are **data, not code**: a framework has datapoints; a datapoint maps to one or more positions or indicators plus narrative slots. Readiness is then a query — for each required datapoint, is the mapped position populated for this period at the required quality level? The gap report writes itself, and adding a framework is a content release rather than a deployment.

## 18. Stack

| Concern | Choice | Note |
|---|---|---|
| App | Next.js App Router + TypeScript | One deployable; server actions for writes |
| Database | Postgres + Prisma | Row-level security; `Decimal` everywhere, never float |
| Numbers | decimal.js | Fixed precision end to end |
| Validation | Zod | Shared client/server schemas on every boundary |
| Jobs | Queue-backed workers (same codebase) | Import, recalculation, snapshot, export, mail |
| Files | S3-compatible object store | Evidence, imports, exports; checksum on every object |
| Cache | Redis | Sessions, rate limits, formula evaluation cache |
| Tests | Vitest + Playwright | Pure calc/unit/formula functions are the test-heavy core |
| Auth | Session + MFA; SAML/OIDC per tenant | IP allow-list at the edge |
| Charts | One chart layer, tokenised palette | Dashboard and Intelligence Center share components |
| Observability | Structured logs + traces + error tracking | Every log line carries `tenant_id` and `request_id` |

---

# PART 3 — MULTI-TENANT PRODUCTISATION

*Everything that must exist before this can be sold to more than one company. This is the part that separates a tool from a product, and it is usually underestimated by a factor of three.*

## 19. Tenancy model

### 19.1 Choose the isolation strategy — and choose once

| Model | Isolation | Cost | Ops burden | Verdict |
|---|---|---|---|---|
| **Shared DB, shared schema, `tenant_id` + RLS** | Logical | Lowest | Lowest | **Start here.** Right for 1–500 tenants |
| Shared DB, schema per tenant | Better | Medium | Migrations × N schemas | Only if a customer contractually demands it |
| Database per tenant | Strong | High | High — N migrations, N backups | Reserve for large enterprise or data-residency deals |

**Recommendation: shared schema with `tenant_id` on every table and Postgres RLS**, with the architecture kept capable of promoting a single tenant to a dedicated database later (which is why nothing may ever join across tenants and why the tenant id is on *every* table, including child tables where it is technically redundant).

### 19.2 Enforcement — two independent nets
1. **ORM layer**: a Prisma client extension that injects `tenant_id` into every `where` and every `create`, sourced from request context (AsyncLocalStorage), and throws if the context is missing.
2. **Database layer**: RLS policies on every tenant table keyed to a session variable `app.tenant_id`, set at connection checkout.

Then a **test that proves it**: a suite that, for every model, attempts a cross-tenant read and write and asserts both fail. Run it in CI. This is the single most important test in the product.

### 19.3 The rules that keep tenancy safe
- No query is ever written without going through the scoped client. Lint rule against raw `prisma.` usage outside the data layer.
- No foreign key crosses tenants. Ever.
- Every background job carries the tenant context explicitly; jobs never "look up" a tenant from data.
- Object-store keys are prefixed `tenant/{id}/…` and signed URLs are scoped and short-lived.
- Caches are keyed by tenant. A cache-key bug is a data leak.

## 20. Global content versus tenant content

The hardest modelling decision in a multi-customer sustainability product.

| Content | Ownership | Behaviour |
|---|---|---|
| Unit dimensions, base units | **Platform** | Read-only to tenants |
| GWP sets (AR4/AR5/AR6) | **Platform** | Read-only, versioned |
| Standard emission-factor libraries (DEFRA, EPA, IEA…) | **Platform** | Published as versioned *content releases*; tenants adopt explicitly |
| Disclosure frameworks and datapoints | **Platform** | Same — content release |
| Starter position library and questionnaire templates | **Platform** | Copied into a tenant at provisioning; the copy is then the tenant's |
| Tenant units, positions, questionnaires, sites, custom fields, rules, labels | **Tenant** | Fully owned and editable |
| Tenant factor overrides and supplier-specific factors | **Tenant** | May override a platform factor for that tenant only |

**Mechanism:** every content-bearing table has a nullable `tenant_id`. `NULL` means platform-global. Resolution is *tenant row first, else global row*. Tenants can never edit a global row — they can only shadow it, and the shadow records what it overrode.

**Content release pipeline:**
```
authoring (internal) → validation (every factor resolves, units exist, no dupes)
   → staged release with changelog and diff
   → tenants see it in Content Updates
   → tenant clicks Adopt (with a preview of what would change)
   → adoption recorded: who, when, from version → to version
   → optional recalculation job, explicitly triggered, with a diff report
```
No content release ever changes a tenant's numbers automatically. That property is what makes the product safe to sell to an assured reporter.

## 21. Tenant lifecycle

### 21.1 Provisioning
A new customer must be created in minutes, not days:
1. Create tenant record, slug, region, plan, entitlements.
2. Seed from a **configuration template**: units, starter positions, starter questionnaires, a default impact profile bound to the correct national factor set, default roles, default labels, default dashboards.
3. Create the first admin user and send an invitation.
4. Create the object-store prefix and the first restore point.
5. Optionally load demo data into a **sandbox period** so the customer can click around safely.

Build this as an idempotent, scripted, API-driven flow — never a manual checklist.

### 21.2 Configuration templates and industry packs
A template is an exportable, versioned bundle of configuration (positions, questionnaires, tags, custom fields, rules, label sets, impact-profile bindings). It is the mechanism for:
- onboarding a new customer quickly,
- selling "industry packs" without a code fork,
- copying a proven setup from one customer to another (with consent),
- moving configuration from a customer's sandbox to their production tenant.

**Requirement:** configuration must be exportable to a file and importable into another tenant, with code collision detection and a dry-run diff. Build this early — it is also how you test everything else.

### 21.3 Sandbox and environments per tenant
Each tenant gets at least a **sandbox** alongside production: same configuration, throwaway data, used for training, for testing a new questionnaire, and for trialling a factor update. Implement as a linked tenant with a `type` flag and a one-way "copy configuration from production" action.

### 21.4 Offboarding
- Full data export in an open format (all tables as csv/json plus every attachment), generated on request.
- Suspension (read-only) distinct from deletion.
- Hard deletion with a retention window, certificate of deletion, and audit entry.
- Deletion must also purge object storage, backups after their retention window, caches, and search indexes.

## 22. Identity, authentication and access

| Capability | Why it is required to sell |
|---|---|
| Email + password with MFA | Baseline |
| **SAML 2.0 / OIDC SSO per tenant** | Any customer above ~200 staff will demand it |
| Domain-based IdP discovery | User types email → routed to their company's IdP |
| **SCIM provisioning** | Enterprise deprovisioning requirement; without it, IT will block the purchase |
| Just-in-time user creation with role mapping from IdP groups | Reduces admin burden |
| Service accounts / API keys with scopes | Integrations |
| Session policy per tenant | Timeout, concurrent sessions, IP allow-list |
| Break-glass platform access | Your support staff, see §26 |

**Identity model:** a `PlatformUser` is global and unique by email; `Membership` links it to a tenant with a role. One consultant can then belong to five customer tenants and switch between them — which is a real and common requirement, and impossible to retrofit if identity is scoped inside the tenant.

## 23. Plans, entitlements and billing

- **Entitlement service**: a single `can(tenant, feature)` check used by both API and UI. Features are codes, not booleans scattered in code.
- Typical limits to meter: sites, users, transaction lines, storage, API calls, scenario runs, sandbox count.
- **Soft limits warn, hard limits block**, and both are visible to the customer before they hit them.
- Usage metering written to a separate table, aggregated nightly, exposed both to the customer and to your billing system.
- Plan changes take effect through the same entitlement path — never through a migration.
- If self-serve: integrate a payment provider, handle dunning, trials, proration. If enterprise-only: an internal admin screen that sets plan and limits is enough for the first two years.

## 24. Localisation and per-tenant presentation

- **Label layer** already gives per-tenant renaming at six levels of specificity. Extend it with `locale`, so the same label key resolves per language.
- UI strings in standard i18n resource files; number, date and currency formatting by locale.
- Per-tenant: logo, accent colour, e-mail sender name, login page branding, custom domain (optional, requires certificate automation).
- Per-tenant fiscal year start, timezone, default units, default GWP set, default consolidation approach.
- Report and export templates brandable per tenant.

## 25. Data residency and regionalisation

- Tenant record carries a **region**; the region determines which database cluster and object-store bucket serve it.
- Build the region indirection early even if you run one region — retrofitting it means touching every data path.
- Keep the platform (identity, billing, content catalogue) separable from regional data planes.
- Document what leaves the region: e-mail, error tracking, support access, backups. Customers will ask, and procurement will require it in writing.

## 26. Support, operations and the back office

An internal **Platform Console**, separate from the tenant app:
- tenant list with plan, usage, health, last activity;
- provision, suspend, resume, delete a tenant;
- content release management and per-tenant adoption status;
- job queue view — failed imports, stuck calculations, retry;
- **impersonation / support access**: time-boxed, reason-required, tenant-notified, fully audit-logged, and read-only by default. Never a silent back door;
- feature-flag control per tenant;
- migration and backfill runner with per-tenant progress.

## 27. Release management across many customers

- **One codebase, one version, all tenants.** Per-customer branches are how this product dies.
- Migrations must be **backwards compatible**: expand → deploy → migrate data → contract, so a rollback never destroys data.
- Long backfills run as tenant-by-tenant jobs with progress and resume, never as a single blocking migration.
- **Feature flags** gate anything risky, with staged rollout: internal → pilot tenants → all.
- A **calculation-engine version bump** is a special release: it never silently changes stored numbers; it requires each tenant to run an explicit recalculation with a diff report, and locked periods refuse it.
- Every release: changelog visible in Content Updates, and a status page.

## 28. Security and compliance posture

The checklist procurement will send you:

| Area | What must exist |
|---|---|
| Encryption | TLS 1.2+ in transit; encryption at rest for database, object store and backups |
| Secrets | A secret manager; nothing in environment files in the repo; rotation policy |
| Access control | Least privilege, MFA on all internal access, no shared accounts |
| Audit | Immutable audit log, exportable, retained per contract |
| Vulnerability management | Dependency scanning, SAST, container scanning, patch SLA |
| Penetration test | Annual third-party test, summary report shareable |
| **SOC 2 Type II or ISO 27001** | Expected by mid-size and larger buyers; start the evidence trail early |
| GDPR | DPA, sub-processor list, data-subject request handling, records of processing |
| Backups | Automated, encrypted, **restore-tested quarterly** with the test documented |
| DR | Defined RPO and RTO, documented runbook, rehearsed |
| Incident response | Documented plan, breach notification timelines, contact path |
| Business continuity | Source escrow if enterprise customers ask; key-person risk documented |

Cheapest sequencing: implement the *controls* from day one (they are mostly free at the start and expensive to retrofit), and pursue the *certification* when the first deal requires it.

## 29. Observability and reliability

- Structured logs with `tenant_id`, `user_id`, `request_id` on every line; no PII in logs.
- Distributed traces on the API and worker paths.
- Error tracking with tenant tagging, so one customer's breakage is visible as theirs.
- **Per-tenant metrics**: active users, lines written, imports run, calculation duration, failure rate. This is both an ops tool and a customer-success tool.
- Alerts on: queue depth, failed jobs, calculation errors, RLS violations (should be zero — any occurrence is a security incident), auth failures, and error-rate spikes.
- Noisy-neighbour protection: per-tenant rate limits and job concurrency caps, so one customer's 2-million-row import cannot starve everyone else.
- Environments: local → CI → staging (with anonymised data) → production. Nobody develops against production data.

## 30. Customer-facing programme

Not code, but required for a multi-customer product:
- **Onboarding wizard** in-product: a nine-step checklist from "create your sites" to "publish your first report", with progress persisted.
- **Guided demo tenant** with realistic data, for sales and for training.
- In-product help, contextual to each module, plus a concept glossary for people new to carbon accounting.
- Documentation site, changelog, status page.
- Support channel with SLA by plan, and an escalation path.
- Assurance pack: a document explaining methodology, calculation approach, audit trail and controls — auditors will ask, and having it ready wins deals.

---

# PART 4 — DEVELOPMENT BACKLOG

Epic by epic. Each epic lists what to build and what "done" means. `BUILD_PLAN.md` turns these into ordered, promptable steps.

## E1 — Foundation and tenancy
**Build:** repo, CI, lint rules, Prisma schema base, tenant model, request context, scoped Prisma extension, RLS policies and migration, seed of the platform content, session auth, membership and tenant switching.
**Done when:** the cross-tenant isolation test suite passes for every model; a second tenant can be provisioned by script; a user belonging to two tenants can switch between them and sees only their own data.

## E2 — Label and vocabulary layer
**Build:** `resolveLabel()` with six-level precedence and locale, `<Label>` component, system defaults, tenant override editor, lint rule banning literal user-visible strings.
**Done when:** no user-visible string is hardcoded; renaming anything changes zero numbers; a second locale renders.

## E3 — Units and materials
**Build:** `UnitCode` type, dimensions, base-unit conversion, cross-dimension throw, `FuelProperty` bridge for calorific values, currency and FX handling, tenant-defined units.
**Done when:** converting L→GJ without a fuel property throws a typed error; every conversion is covered by tests; currency never silently converts.

## E4 — Setup: periods, sites, positions
**Build:** collection periods with the state machine; site tree to six levels with attributes, versioning and bulk import; position CRUD for all six types with codes, dimensions, allowed units, tags, help text.
**Done when:** a six-level tree renders and roll-ups resolve; period locking rejects writes; positions of every type can be created and are reusable across questionnaires.

## E5 — Factors and Impact Profile
**Build:** factor library, GWP sets, factor import, profile versioning and promotion, `FactorAssignment` with the precedence chain, `resolveFactor()` (throws on ambiguity and absence), binding health check, profile diff.
**Done when:** `resolveFactor` throws on tie and on none; a superseded factor still reproduces its original number; a profile can be copied to the next year and diffed.

## E6 — Calculation engine
**Build:** pure `calculate()`, unit normalisation, denominator alignment, GWP application, consolidation share, dual-basis Scope 2, mid-period factor splitting, `EmissionRecord` snapshotting, recalculation job with diff report, `calc_engine_version`.
**Done when:** the required test set passes — superseded-factor reproducibility, mid-year factor split, unit-mismatch throw, dual-basis Scope 2, locked-period refusal.

## E7 — Formula (indicator) engine
**Build:** expression parser to AST, dimension type-checking, dependency edges, cycle detection at save, topological evaluation, typed nulls with reasons, overview roll-ups.
**Done when:** a cycle is rejected at save time; adding kWh to litres is rejected; a missing upstream value yields a reasoned null, never zero.

## E8 — Questionnaires and custom fields
**Build:** questionnaire assembly by filtering the position pool, sections and ordering, versioning, publish gate on binding health, `visible_if` shared evaluator, custom-field definitions and bindings, preview-as-respondent.
**Done when:** a questionnaire with any unhealthy binding cannot be published; `visible_if` gives identical results on client and server for a shared test vector.

## E9 — Data Acquisition UI
**Build:** acquisition home with the site tree and assignment summary; the entry form with multi-line positions, custom fields, units, comments, attachments, inline validation, autosave, optimistic concurrency, Excel paste, completeness meter, inherited-value handling; the workflow state machine with four-eyes.
**Done when:** a full questionnaire can be completed, submitted, reviewed, approved and locked, with every transition audited.

## E10 — Import / export and Connection Center
**Build:** master workbook generator, streamed parser, mapping profiles, interactive mapper, staging, validator, preview with error report, atomic commit, rollback, questionnaire exporter, scheduled feeds.
**Done when:** a 100,000-row file imports without timeout; a rejected row reports its number and reason; a committed batch rolls back cleanly; an exported questionnaire re-imports losslessly after column reordering.

## E11 — Rules and controls
**Build:** rule AST, builder UI, three evaluation moments, severity handling, acknowledgement with comment, versioning, test-run against history.
**Done when:** a blocking rule prevents submission; a warning rule requires an audited acknowledgement; a rule can be trialled before activation.

## E12 — Audit, versioning, restore
**Build:** append-only audit table with same-transaction writes, entity versioning, snapshot job at four retention tiers, restore with preview-diff, restatement flow for locked periods.
**Done when:** every write path produces an audit event; a snapshot restores a tenant to a prior state; a locked-period correction is only possible as a restatement.

## E13 — Analytics and Intelligence Center
**Build:** star schema and incremental materialisation, `POST /api/analytics/query`, pivot grid, chart layer, the seven report types, drill-through to lines, SavedView with sharing and versioning, dashboard tile pinning.
**Done when:** a pivot over ten million lines returns within the performance budget; every dashboard tile is a SavedView; drill-through reaches the individual transaction line.

## E14 — Management module
**Build:** targets and trajectories, action register, benchmarks, disclosure frameworks as data with datapoint mapping and readiness reporting, content-update channel with adopt flow.
**Done when:** a target shows gap-to-trajectory; a disclosure readiness report lists gaps by datapoint; adopting a content release is recorded and never auto-recalculates.

## E15 — Administration
**Build:** user and role management, site-scoped access with an effective-permission viewer, welcome content, password policy, IP allow-list, T&Cs with acceptance, application log viewer, notification schedules.
**Done when:** a user's effective permissions are inspectable in one screen; every admin action is audited.

## E16 — Productisation *(Part 3)*
**Build:** provisioning API and configuration templates, sandbox tenants, entitlements and usage metering, SSO/SCIM, per-tenant branding and locale, region indirection, Platform Console with audited impersonation, offboarding export and deletion.
**Done when:** a new customer is live in under fifteen minutes from a single command; a configuration template moves between tenants with a dry-run diff; a support session is time-boxed and logged.

## E17 — Hardening and compliance
**Build:** backup and restore-test automation, DR runbook, dependency and container scanning in CI, rate limiting, security headers, penetration-test remediation, observability dashboards and alerts, load testing at target volumes.
**Done when:** a restore test is green and documented; load tests hit the Part 5 budgets; alerting fires on a simulated failure.

---

# PART 5 — NON-FUNCTIONAL REQUIREMENTS

| Area | Target |
|---|---|
| Page load (dashboard, warm) | < 1.5 s p95 |
| Data-entry save | < 300 ms p95 |
| Analytics pivot, 10M lines | < 3 s p95 |
| Import, 100k rows | < 5 min, streamed, resumable |
| Recalculation, 1M lines | < 15 min as a background job with progress |
| Availability | 99.5% initially; 99.9% when contracts demand it |
| RPO / RTO | 1 hour / 4 hours |
| Backup retention | 35 days point-in-time, plus monthly archives per contract |
| Precision | `Decimal(24,12)` factors, `Decimal(24,6)` emissions, `Decimal(20,6)` quantities |
| Browser support | Evergreen Chrome, Edge, Safari, Firefox |
| Accessibility | WCAG 2.1 AA on all data-entry and reporting screens |
| Audit retention | 7 years default, configurable per tenant |
| Cross-tenant leakage | Zero, proven by an automated test suite on every build |

---

# PART 6 — SEQUENCING, EFFORT AND WHAT TO CUT

## 31. Build order

Each step depends on the one above it. Do not reorder.

1. Foundation, tenancy, RLS, isolation tests **(E1)**
2. Label layer **(E2)** — first, or you retrofit hundreds of strings
3. Units and materials **(E3)**
4. Periods, sites, positions **(E4)**
5. Factors and Impact Profile **(E5)**
6. Calculation engine **(E6)**
7. Formula engine **(E7)**
8. Questionnaires and custom fields **(E8)**
9. Data Acquisition UI **(E9)**
10. Import / export and Connection Center **(E10)**
11. Rules and controls **(E11)**
12. Audit, versioning, restore **(E12)**
13. Analytics and Intelligence Center **(E13)**
14. Management module **(E14)**
15. Administration **(E15)**
16. Productisation **(E16)**
17. Hardening and compliance **(E17)**

**Dashboards and report exports come late deliberately.** They are views, and views built over a wrong model are wasted work.

## 32. Rough effort

For one experienced developer working with Claude, in focused sessions:

| Milestone | Epics | Indicative effort |
|---|---|---|
| **M1 — Calculating core** | E1–E7 | 6–10 weeks |
| **M2 — Usable single-tenant product** | E8–E12 | 8–12 weeks |
| **M3 — Reporting** | E13–E15 | 6–8 weeks |
| **M4 — Sellable to many customers** | E16–E17 | 8–12 weeks |

M4 is the one that gets underestimated. Provisioning, SSO, entitlements, the Platform Console, and the compliance evidence trail are not features customers see — they are the price of entry to selling at all.

## 33. What to cut for a first paying customer

Cut, safely:
- Scheduled inbound feeds (manual upload is fine at first)
- Custom domains per tenant
- Multi-region (one region, documented)
- Self-serve billing (an internal screen is enough)
- Sankey and treemap charts
- Marginal abatement cost view
- SCIM (SSO alone usually suffices for the first deal)

Never cut:
- Tenant isolation and its test suite
- Factor snapshotting and traceability
- The audit trail
- Period locking and restatement
- The binding-health publish gate
- Backups with a *tested* restore

## 34. Open decisions to confirm before schema work

1. **Consolidation approach** — operational control assumed. Equity share requires `consolidation_share` on every site and record (already in the model, but the UI and reporting differ).
2. **Reporting entity** — multi-site group assumed.
3. **First national factor set** to ship as platform content.
4. **First target customer profile** — it decides which starter template you build first, without letting it leak into the schema.
5. **Self-serve versus enterprise sales** — decides how much of §23 is needed in year one.

---

*Companion: `BUILD_PLAN.md` — the ordered, copy-pasteable prompt sequence for building this in VS Code.*
