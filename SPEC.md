# SPEC.md — Green Ledger

**Version:** 0.1 (draft)
**Date:** 2026-08-20
**Standards targeted:** GHG Protocol Corporate Standard + Corporate Value Chain (Scope 3) Standard, disclosed under **CSRD / ESRS E1**
**Scope 3 coverage:** all 15 categories (schema-complete; categories with no primary data are recorded at screening level with an explicit `data_quality` flag)
**Stack:** Next.js 15 (App Router), TypeScript, PostgreSQL via Prisma, Tailwind
**Companion docs:** `UX.md` (screens), `ARCHITECTURE.md` (wiring), `CLAUDE.md` (conventions)

---

## 1. Purpose and non-goals

### 1.1 Purpose
A multi-tenant web application where an organisation records activity data, converts it to greenhouse-gas emissions using versioned emission factors, keeps every calculation traceable to its inputs, and exports an ESRS E1-shaped disclosure that a third-party assurer can verify.

### 1.2 Non-goals (v1)
- No automated ERP/utility-API ingestion. CSV import + manual entry only.
- No target-setting optimiser or scenario modelling beyond storing declared targets.
- No financial (double-materiality) module beyond E1. Other ESRS topics are out of scope.
- No public-facing sustainability microsite.

### 1.3 The one rule everything else serves
> **Every reported number must be reproducible from stored inputs, forever.**
> A report generated on 2026-03-01 must produce byte-identical figures if regenerated on 2030-03-01, even after every emission factor in the system has been superseded.

This is why factors are snapshotted onto records (§5.3) and why calculations are pure functions (§7).

---

## 2. Actors and permissions

| Role | Can do |
|---|---|
| `OWNER` | Everything, including billing, deleting the org, managing members |
| `ADMIN` | Manage sites, periods, factor sets, users; lock/unlock periods |
| `CONTRIBUTOR` | Enter/edit activity data and upload documents in **open** periods only |
| `APPROVER` | Review + approve activity data; cannot edit approved records |
| `AUDITOR` | Read-only across everything, including the full audit log |

Rules:
- Every row in every tenant-scoped table carries `organization_id`. Every query is scoped by it. No exceptions — enforced by Prisma middleware **and** Postgres row-level security.
- `AUDITOR` access is granted per reporting period, with an expiry date.

---

## 3. Entity model

```
Organization
├── Membership (User ↔ Organization, role)
├── Site
│   ├── SiteOwnershipPeriod        (consolidation share over time)
│   └── SiteAsset                  (boilers, generators, chillers, vehicles…)
├── ReportingPeriod                 (FY boundaries, status, lock)
│   ├── ActivityRecord              (the raw input: what, how much, when)
│   │   └── EmissionRecord          (the computed result, 1..n per activity)
│   ├── Target                      (ESRS E1-4)
│   └── Report                      (an immutable export)
├── QuestionnaireTemplate           (versioned form definition)
│   └── QuestionnaireSection
│       └── Question                (one question = one data point)
│           └── FactorBinding       (question → factor lookup rule)
├── QuestionnaireAssignment         (template version × site × period)
│   └── Answer                      (→ generates ActivityRecord)
├── EmissionFactorSet               (a published factor library + version)
│   └── EmissionFactor              (one factor, dated, unit-typed)
├── FuelProperty                    (density, NCV — versioned like a factor)
├── GWPSet                          (AR5 / AR6, per-gas values)
├── LabelOverride                   (org's own word for any system code)
├── Vocabulary                      (org-extensible code lists: site types, asset types, denominators)
├── Document                        (invoice, meter read, methodology note)
├── Task                            (assignee, due date, linked entity)
└── AuditEvent                      (append-only)
```

### 3.1 Organization
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `legal_name` | string | |
| `consolidation_approach` | enum | `OPERATIONAL_CONTROL` \| `FINANCIAL_CONTROL` \| `EQUITY_SHARE` — set once, changing it requires a documented restatement |
| `base_year` | int | ESRS E1 requires a base year for targets |
| `base_year_rationale` | text | |
| `default_gwp_set_id` | fk | |
| `fiscal_year_start_month` | int 1–12 | |
| `created_at` / `updated_at` | | |

### 3.2 Site
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id` | fk | |
| `name`, `code` | string | `code` unique per org — used as the CSV import key |
| `country`, `region`, `grid_region` | string | `grid_region` selects the location-based electricity factor |
| `site_type` | string | from an org-editable vocabulary, seeded with `MANUFACTURING`, `OFFICE`, `WAREHOUSE`, `DATA_CENTRE`, `RETAIL`, `LOGISTICS`, `LAB`, `MIXED_USE`, `OTHER` |
| `floor_area_m2`, `headcount` | numeric | intensity denominators |
| `is_in_scope_from` / `is_in_scope_to` | date | acquisitions and divestments |

**SiteOwnershipPeriod** — `site_id`, `valid_from`, `valid_to`, `consolidation_share` (0–1). Under equity share, emissions are multiplied by the share in force on the activity date. Under control approaches this is 0 or 1.

### 3.3 ReportingPeriod
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id` | fk | |
| `label` | string | "FY2026" |
| `starts_on`, `ends_on` | date | |
| `status` | enum | `DRAFT` → `IN_REVIEW` → `LOCKED` → `ASSURED` |
| `locked_at`, `locked_by` | | Once `LOCKED`, no ActivityRecord in the period may be created, edited, or deleted. Corrections happen via §9 restatement. |
| `default_factor_set_id` | fk | The factor set new records default to |

### 3.4 ActivityRecord — the heart of the system
This is what the user actually types in. It stores **what happened**, never an emissions number.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id`, `site_id`, `reporting_period_id` | fk | |
| `scope` | enum | `SCOPE_1` \| `SCOPE_2` \| `SCOPE_3` |
| `category` | enum | see §4 |
| `scope3_category` | int 1–15, nullable | required iff `scope = SCOPE_3` |
| `activity_type` | enum | `STATIONARY_COMBUSTION`, `MOBILE_COMBUSTION`, `FUGITIVE`, `PROCESS`, `PURCHASED_ELECTRICITY`, `PURCHASED_HEAT`, `PURCHASED_STEAM`, `PURCHASED_COOLING`, `SPEND`, `DISTANCE`, `MASS`, `WASTE`, `OTHER` |
| `method` | enum | `FUEL_BASED`, `DISTANCE_BASED`, `SPEND_BASED`, `AVERAGE_DATA`, `SUPPLIER_SPECIFIC`, `WASTE_TYPE_SPECIFIC`, `HYBRID` |
| `quantity` | decimal(20,6) | **never** a float |
| `unit` | enum `UnitCode` | typed, not a string — see §6 |
| `activity_start`, `activity_end` | date | a record spans a billing period; used to pick the factor valid at the time |
| `fuel_or_material_code` | string | FK-ish to a controlled vocabulary (`diesel`, `natural_gas`, `r410a`, `steel`, …) |
| `supplier_name`, `supplier_id` | string | needed for market-based Scope 2 and supplier-specific Scope 3 |
| `data_quality` | enum | `MEASURED` \| `CALCULATED` \| `ESTIMATED` \| `PROXY` — ESRS wants this disclosed |
| `uncertainty_pct` | numeric, nullable | ISO 14064-1 friendly; optional in v1 |
| `status` | enum | `DRAFT` \| `SUBMITTED` \| `APPROVED` \| `REJECTED` |
| `notes` | text | |
| `source_document_ids` | fk[] | at least one required to reach `APPROVED` |
| `import_batch_id` | fk, nullable | which CSV import created it |

Constraints:
- `quantity >= 0`.
- `activity_start <= activity_end`, and both must fall inside the reporting period (or the record is flagged for pro-rata split — v1 rejects it with a clear error).
- Unique-ish guard: warn (do not block) on a same-site, same-fuel, same-date-range record — the classic double-count.

### 3.5 EmissionRecord — the computed result
One ActivityRecord produces **one or more** EmissionRecords. Electricity produces two (location-based and market-based). A fuel with CO₂/CH₄/N₂O components may produce three gas rows if the factor is gas-split.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `activity_record_id` | fk | |
| `basis` | enum | `LOCATION_BASED` \| `MARKET_BASED` \| `SINGLE` |
| `gas` | enum | `CO2` \| `CH4` \| `N2O` \| `HFC` \| `PFC` \| `SF6` \| `NF3` \| `CO2E_BLENDED` |
| **Snapshotted inputs** | | |
| `quantity_normalised` | decimal | quantity after unit conversion to the factor's unit |
| `unit_normalised` | UnitCode | |
| `factor_id` | fk | pointer, for lineage only |
| `factor_value` | decimal(24,12) | **snapshot** |
| `factor_unit_numerator` | UnitCode | e.g. `KG_CO2E` |
| `factor_unit_denominator` | UnitCode | e.g. `LITRE` |
| `factor_source` | string | snapshot: "DEFRA 2026 v1.1, Table 5" |
| `factor_version` | string | snapshot |
| `factor_valid_from`, `factor_valid_to` | date | snapshot |
| `gwp_value` | decimal | snapshot (1 for CO₂, 27.9 for CH₄ under AR6, …) |
| `gwp_set` | string | snapshot: "IPCC AR6" |
| `consolidation_share` | decimal | snapshot, from §3.2 |
| `unit_conversion_factor` | decimal(24,12) | snapshot — the number used to get from `unit` to `unit_normalised` |
| **Output** | | |
| `emissions_kg_co2e` | decimal(24,6) | = `quantity_normalised × factor_value × gwp_value × consolidation_share` |
| `calculated_at` | timestamptz | |
| `calc_engine_version` | string | semver of the pure-function module that produced it |

> **Why every input is duplicated here:** in 2030 the DEFRA 2026 factor row may be edited, re-versioned, or deleted. The EmissionRecord must still be able to show the arithmetic. The `factor_id` is a convenience link; the snapshot is the truth.

### 3.6 EmissionFactorSet / EmissionFactor

**EmissionFactorSet** — `id`, `publisher` (`DEFRA`, `EPA`, `IEA`, `ADEME`, `ECOINVENT`, `GRID_OPERATOR`, `SUPPLIER`, `CUSTOM`), `name`, `version`, `published_on`, `region_scope`, `licence`, `source_url`, `is_active`, `organization_id` (nullable — null = global/shared set, non-null = tenant's own custom set).

**EmissionFactor**
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `factor_set_id` | fk | |
| `activity_type`, `method`, `scope`, `scope3_category` | | how a record matches to it |
| `fuel_or_material_code` | string | |
| `region` | string | ISO country or grid region; `GLOBAL` allowed |
| `gas` | enum | `CO2E_BLENDED` for a single blended factor |
| `value` | decimal(24,12) | |
| `unit_numerator`, `unit_denominator` | UnitCode | |
| `basis` | enum | for electricity: location vs residual-mix |
| `valid_from`, `valid_to` | date | `valid_to` nullable = still current |
| `source_citation` | string | table/page-level, not just a URL |
| `uncertainty_pct` | numeric, nullable | |
| `superseded_by_id` | fk, nullable | |

Factor rows are **immutable once referenced**. An update creates a new row with a new `valid_from` and sets `superseded_by_id` on the old one.

**Factor resolution** (deterministic, and unit-tested): given an ActivityRecord, pick the factor where set is active, `activity_type`/`method`/`fuel_or_material_code` match, region matches most-specific-first (site country → grid region → `GLOBAL`), and `activity_start` falls within `[valid_from, valid_to]`. Ties are an error, not a silent pick. **If the activity period spans a factor change, split the record pro-rata by days and emit one EmissionRecord per factor.**

### 3.7 GWPSet
`id`, `name` ("IPCC AR6"), `gas`, `gwp_100`, `is_default`. ESRS E1 currently expects AR6 100-year values; AR5 is kept for restating a pre-2024 base year.

### 3.8 Document
`id`, `organization_id`, `storage_key` (S3/R2), `filename`, `mime_type`, `size_bytes`, `sha256`, `uploaded_by`, `uploaded_at`, `document_type` (`INVOICE`, `METER_READ`, `CONTRACT`, `EAC_CERTIFICATE`, `METHODOLOGY`, `ASSURANCE`, `OTHER`), and a polymorphic link `entity_type` + `entity_id`.
`sha256` is mandatory — an assurer needs to know the file hasn't been swapped.

### 3.9 Task
`id`, `organization_id`, `title`, `description`, `assignee_id`, `due_on`, `status` (`OPEN`/`IN_PROGRESS`/`BLOCKED`/`DONE`), `priority`, polymorphic `entity_type` + `entity_id`, `created_by`. Tasks are how "Site B hasn't submitted Q3 gas bills" becomes visible.

### 3.10 AuditEvent (append-only, no updates, no deletes)
`id`, `organization_id`, `actor_user_id`, `occurred_at`, `action` (`CREATE`/`UPDATE`/`DELETE`/`LOCK`/`UNLOCK`/`APPROVE`/`RECALCULATE`/`EXPORT`/`LOGIN`), `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `request_id`, `ip`.
Enforced at the DB level: `REVOKE UPDATE, DELETE` on the table for the app role.

### 3.11 Target (ESRS E1-4)
`id`, `organization_id`, `name`, `scope_coverage` (which scopes/categories), `base_year`, `base_year_emissions_kg`, `target_year`, `target_type` (`ABSOLUTE`/`INTENSITY`), `reduction_pct`, `is_science_based`, `validated_by` (e.g. SBTi), `methodology_note`.

### 3.12 Report
`id`, `organization_id`, `reporting_period_id`, `generated_at`, `generated_by`, `format` (`XLSX`/`PDF`/`JSON`), `storage_key`, `sha256`, `figures_snapshot` (jsonb — the totals as generated), `calc_engine_version`, `factor_sets_used` (jsonb).
A Report is immutable. Regenerating creates a new Report row; the old one stays for comparison.

### 3.13 SiteAsset — "what appliances does this site have"

The site's physical inventory. Its purpose is not documentation: it is the **input to questionnaire conditional logic** (see §3.15) and the reason a user never has to pick a GHG Protocol activity type themselves.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id`, `site_id` | fk | |
| `name` | string | "Backup generator DG-1" |
| `asset_type_code` | string | from a seeded, **org-editable** library (`diesel_generator`, `gas_boiler`, `chiller`, `fleet_vehicle`, `forklift`, `air_compressor`, `process_oven`, `ups_system`, `rooftop_solar`, …) |
| `category` | enum | `STATIONARY_COMBUSTION`, `MOBILE_COMBUSTION`, `REFRIGERATION`, `MEDICAL_GAS`, `PROCESS`, `ON_SITE_GENERATION`, `ELECTRICAL`, `OTHER` |
| `fuel_or_material_code` | string, nullable | `diesel`, `natural_gas`, `r410a`, `n2o` |
| `capacity`, `capacity_unit` | decimal, UnitCode | 500 kVA, 2 t/h |
| `quantity` | int | 6 forklifts as one row |
| `refrigerant_charge_kg` | decimal, nullable | needed for the top-up method |
| `sub_location`, `tag_or_serial` | string | |
| `commissioned_on`, `decommissioned_on` | date | an asset only drives questions for periods it was active in |
| `status` | enum | `ACTIVE` \| `STANDBY` \| `DECOMMISSIONED` |
| `notes` | text | |

**AssetTypeLibrary** ships as one **industry-neutral** starter set — buildings, HVAC, generators, boilers, refrigeration, vehicles, IT equipment, on-site generation, process equipment, waste handling. Org admins add their own entries and rename any of the seeded ones (§3.19). The product never assumes a vertical; an org shapes the vocabulary to match how it already talks about its own sites.

### 3.14 QuestionnaireTemplate / Section

**QuestionnaireTemplate** — `id`, `organization_id`, `name` ("Standard Operations"), `applies_to_site_types` (enum[]), `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `version` (int), `published_at`, `published_by`, `parent_version_id`.

**QuestionnaireSection** — `id`, `template_id`, `title`, `description`, `scope`, `scope3_category` (nullable), `sort_order`, `visible_if` (jsonb).

Rules:
- Editing a `PUBLISHED` template creates a new `DRAFT` version; in-flight responses are untouched.
- Publishing shows a diff (questions added / removed / re-bound) and the affected sites and periods.
- **A template version assigned to a period is frozen for that period.** Same principle as factor snapshots (§5): next year's edits never rewrite last year's answers.

### 3.15 Question

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `section_id` | fk | |
| `code` | string | stable key, unique per template; what CSV import maps onto |
| `label` | text | plain language; supports `{{asset.name}}` interpolation |
| `help_text` | text | where to find the number |
| `input_type` | enum | `NUMBER_WITH_UNIT`, `NUMBER`, `TEXT`, `SINGLE_SELECT`, `MULTI_SELECT`, `DATE`, `DATE_RANGE`, `BOOLEAN`, `FILE`, `REPEATING_TABLE` |
| `unit_dimension` | enum, nullable | `VOLUME`, `MASS`, `ENERGY`, `DISTANCE`, `MASS_DISTANCE`, `CURRENCY` — **restricts the unit dropdown at render time** |
| `allowed_units` | UnitCode[] | optional narrowing within the dimension |
| `options` | jsonb | for select types |
| `columns` | jsonb | for `REPEATING_TABLE` (each column is itself typed + unit-dimensioned) |
| `is_required` | bool | |
| `evidence_required` | bool | cannot reach `APPROVED` without a linked Document |
| `allow_not_applicable` | bool | if true, N/A requires a mandatory reason that lands in the report |
| `visible_if` | jsonb | see below |
| `prefill_from_prior_period` | bool | |
| `sort_order` | int | |
| `library_question_id` | fk, nullable | reusable questions shared across templates |

**`visible_if` grammar** — a small, serialisable boolean expression, evaluated client- and server-side by the same pure function:
```json
{ "all": [
    { "site_has_asset": { "category": "REFRIGERATION", "fuel_or_material_code": "r410a" } },
    { "site_type_in": ["MANUFACTURING", "LAB"] },
    { "answer_equals": { "question_code": "buys_eacs", "value": true } }
] }
```
Supported predicates: `site_has_asset`, `site_type_in`, `site_country_in`, `answer_equals`, `answer_greater_than`, `any`, `all`, `not`.

> **This is the mechanism that makes the form feel intelligent.** A site with no R-410A chiller in its asset list never sees the R-410A question, and its completeness denominator excludes it — so a warehouse isn't stuck at 60% forever because it has no boiler.

### 3.16 FactorBinding — where the questionnaire meets the Factor Lab

Zero or one per Question (informational questions like "who is your energy supplier?" have none). This is the entire mapping layer.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `question_id` | fk, unique | |
| `scope` | enum | |
| `scope3_category` | int 1–15, nullable | |
| `activity_type` | enum | as §3.4 |
| `method` | enum | as §3.4 |
| `fuel_or_material_code` | string | |
| `region_strategy` | enum | `SITE_COUNTRY_THEN_GRID_THEN_GLOBAL` (default), `SITE_GRID_ONLY`, `FIXED_REGION`, `GLOBAL_ONLY` |
| `fixed_region` | string, nullable | with `FIXED_REGION` |
| `factor_set_mode` | enum | `PERIOD_DEFAULT` \| `PINNED` |
| `pinned_factor_set_id` | fk, nullable | |
| `gwp_set_mode` | enum | `ORG_DEFAULT` \| `PINNED` |
| `output_basis` | enum | `SINGLE` \| `DUAL` (electricity → location + market) |
| `multiplier` | decimal | default 1.0 (e.g. a monthly question × 12) |
| `column_bindings` | jsonb, nullable | for `REPEATING_TABLE`: which column is the quantity, which the unit, which the distance |
| `health` | enum, derived | `OK` \| `FALLBACK_REGION` \| `AMBIGUOUS` \| `BROKEN` |

**Hard rule: a question with `health = BROKEN` or `AMBIGUOUS` cannot be published.** The Builder's *Test binding* runs `resolveFactor` against a sample site and either shows the full arithmetic or a specific error. This one gate prevents the signature failure of this product category — a polished form that silently records zeros.

**Binding health is recomputed** on factor-set change, on factor import, and nightly. The count of broken bindings is a badge in the navigation.

### 3.17 QuestionnaireAssignment and Answer

**QuestionnaireAssignment** — `id`, `template_version_id`, `site_id`, `reporting_period_id`, `assigned_to_user_id`, `approver_user_id`, `due_on`, `status` (`NOT_STARTED`/`IN_PROGRESS`/`IN_REVIEW`/`APPROVED`/`LOCKED`), `completeness_pct` (materialised), `submitted_at`, `approved_at`.

**Answer**
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `assignment_id`, `question_id` | fk | unique together |
| `value_numeric` | decimal(20,6), nullable | |
| `value_text`, `value_json` | | `value_json` holds `REPEATING_TABLE` rows |
| `unit` | UnitCode, nullable | must be in the question's dimension — enforced at write |
| `data_quality` | enum | `MEASURED`/`CALCULATED`/`ESTIMATED`/`PROXY` |
| `is_not_applicable` | bool | |
| `na_reason` | text | **required** when `is_not_applicable`; surfaces in the report |
| `status` | enum | `UNANSWERED`/`DRAFT`/`ANSWERED`/`FLAGGED`/`APPROVED` |
| `answered_by`, `answered_at` | | |
| `document_ids` | fk[] | |
| `activity_record_id` | fk, nullable | the record this answer generated |
| `prior_period_value` | decimal, nullable | cached for the prefill ghost value |

**Answer → ActivityRecord is a projection, not a copy.** On save, a pure function `projectAnswer(answer, question, binding, site, period)` produces an `ActivityRecord`, which then flows through the normal engine of §7. The Answer stays the user-facing record of what a human typed; the ActivityRecord is the accounting record. They are linked one-to-one (or one-to-many for repeating tables) so the audit trail runs all the way back to the person and the invoice.

### 3.18 Completeness

```
completeness_pct = answered_or_na_required_questions / applicable_required_questions
```
`applicable` is computed by evaluating each question's `visible_if` against the site's profile and assets. Stored on the assignment, recomputed on answer save, asset change, and profile change — never summed live on the dashboard.

---

### 3.19 LabelOverride — the org owns every word on screen

**The principle: codes are the system's, labels are the customer's.**

Every enum, taxonomy entry, status, unit, category and factor code in Green Ledger has a stable machine `code` that never changes, and a **display label** the organisation controls. The code is what calculations, factor resolution, CSV imports, audit records and report exports use. The label is what a human sees, anywhere it appears — form fields, section headings, dropdown options, table columns, dashboard legends, chart series names, and exported reports.

Nothing about renaming a label can change a number. That separation is what makes this safe to expose to customers.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id` | fk | |
| `entity_kind` | enum | `SCOPE`, `SCOPE3_CATEGORY`, `ACTIVITY_TYPE`, `METHOD`, `ASSET_TYPE`, `ASSET_CATEGORY`, `SITE_TYPE`, `FUEL_OR_MATERIAL`, `UNIT`, `DATA_QUALITY`, `STATUS`, `SECTION`, `QUESTION`, `DENOMINATOR`, `ROLE`, `DOCUMENT_TYPE` |
| `code` | string | the thing being relabelled — `STATIONARY_COMBUSTION`, `diesel`, `PROXY`, `scope3_cat_5` |
| `scope_key` | string | where this override applies — see resolution order below |
| `label` | string | what the user sees |
| `short_label` | string, nullable | for table headers and chart legends |
| `description` | text, nullable | overrides the built-in help text |
| `locale` | string | BCP-47; `*` = applies to all locales |
| `is_hidden` | bool | hide an irrelevant option from pickers without deleting it |
| `sort_order` | int, nullable | reorder options in a dropdown |
| `updated_by`, `updated_at` | | every change writes an AuditEvent |

**Resolution order — most specific wins:**
```
FactorBinding override  →  Question override  →  Template override
  →  Site-type override  →  Organisation override  →  System default
```
`scope_key` encodes the level: `binding:<id>`, `question:<id>`, `template:<id>`, `site_type:<code>`, `org`, or `system`.

A single pure function does the lookup:
```ts
resolveLabel(entityKind, code, context, locale): ResolvedLabel
```
`context` carries the binding, question, template and site-type in play. It is called by a `<Label>` component and by the report builders — **never by hand-written string literals in components.** A hardcoded user-visible string is a bug, caught by a lint rule.

**Worked example.** The system code is `STATIONARY_COMBUSTION`.
- System default label: *"Stationary combustion"*
- Manufacturer's org override: *"Fixed fuel burning"*
- Their `site_type:OFFICE` override: *"Building heating"*
- On question Q1 specifically: *"Generator fuel"*

Four different words on screen, one code underneath. Every emission record, every factor resolution, every CSV export still says `STATIONARY_COMBUSTION`. Change the label mid-year and last year's locked report is unaffected, because reports snapshot the labels they were generated with (§3.12 `figures_snapshot` carries a `labels` map).

**Multi-language** falls out of the same table: `locale` is part of the key, so a French site sees French labels while the codes and the arithmetic stay identical.

**Where the user does this:** Settings → Labels (see `UX.md` §11.1), plus an inline pencil icon beside any label for an admin, which opens the same editor scoped to wherever they clicked.

### 3.20 Vocabulary — org-extensible code lists

Some taxonomies are not just relabelled, they're extended. `SITE_TYPE`, `ASSET_TYPE`, `ASSET_CATEGORY`, `DOCUMENT_TYPE`, `DENOMINATOR` and `FUEL_OR_MATERIAL` are **open vocabularies**: seeded with neutral defaults, extensible per org.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `organization_id` | fk, nullable | null = system-seeded entry |
| `kind` | enum | as above |
| `code` | string | slug; org-created codes are prefixed `org_` to guarantee no collision with future system codes |
| `label`, `description` | | the initial label; later edits go through `LabelOverride` |
| `parent_code` | string, nullable | asset type → asset category |
| `metadata` | jsonb | e.g. an asset type's default fuel and unit dimension |
| `is_active` | bool | |

Scopes, Scope 3 categories, methods and data-quality levels are **closed** — they're defined by the GHG Protocol and ESRS, so they can be relabelled but never added to or removed. Trying to would break the report mapping.

**Custom denominators** are the most valuable open vocabulary: an org adds `org_units_produced`, `org_tonnes_shipped`, `org_rack_kw`, or `org_room_nights`, sets it on each site's profile, and gets its own intensity metric on the dashboard and in E1 reporting — without the product ever having to know what industry they're in.

---

## 4. Scope coverage

### Scope 1
| Category | Activity types | Typical units |
|---|---|---|
| Stationary combustion | boilers, generators, furnaces | L, m³, kg, kWh, GJ |
| Mobile combustion | owned fleet, forklifts, plant vehicles | L, km, kg |
| Fugitive | refrigerants (HFCs), medical gases (N₂O, desflurane), SF₆ | kg recharged |
| Process | on-site chemical/industrial processes | t |

> Fugitive emissions are modelled by the **top-up/recharge method** (kg of refrigerant added during the year), not by leak-rate estimation, in v1. Refrigerant top-ups are the most commonly missed Scope 1 source across every industry — sites treat them as maintenance, not fuel.

### Scope 2 — both bases are mandatory
Every purchased-energy ActivityRecord generates **two** EmissionRecords:
- **Location-based** — grid average factor for `site.grid_region`, from the active grid factor set.
- **Market-based** — in resolution order: (1) supplier-specific contractual rate, (2) EAC/REC/GO certificate retired for the site, (3) residual mix factor for the country, (4) if none exist, fall back to location-based **and flag it** in the record's `notes` and in the report footnote.

ESRS E1-6 requires disclosing both. The UI never lets a user "pick one".

### Scope 3 — all 15 categories in the schema
| # | Category | v1 primary method | Fallback |
|---|---|---|---|
| 1 | Purchased goods & services | supplier-specific | spend-based (EEIO) |
| 2 | Capital goods | supplier-specific | spend-based |
| 3 | Fuel- & energy-related (not in S1/S2) | fuel-based (WTT + T&D losses) | average data |
| 4 | Upstream transport & distribution | distance × mass | spend-based |
| 5 | Waste generated in operations | waste-type-specific (incl. hazardous streams) | average data |
| 6 | Business travel | distance-based (with RFI for air) | spend-based |
| 7 | Employee commuting | survey + distance-based | average data by headcount |
| 8 | Upstream leased assets | as Scope 1/2 of the asset | average data |
| 9 | Downstream transport & distribution | distance × mass | screening |
| 10 | Processing of sold products | supplier-specific | screening |
| 11 | Use of sold products | usage model | screening |
| 12 | End-of-life of sold products | waste-type-specific | screening |
| 13 | Downstream leased assets | as Scope 1/2 of the asset | screening |
| 14 | Franchises | as Scope 1/2 of franchisee | screening |
| 15 | Investments | PCAF attribution factor | screening |

Categories with no data still get a row in the report: **"not material — screening basis, rationale: …"**. ESRS requires the explicit statement, not silence.

---

## 5. Emission factors: the versioning contract

1. A factor is identified by (`factor_set`, `activity_type`, `method`, `fuel_or_material_code`, `region`, `gas`, `basis`, `valid_from`).
2. Factors are **never edited in place** once any EmissionRecord references them. Corrections create a new version.
3. Every EmissionRecord snapshots `factor_value`, `factor_unit_*`, `factor_source`, `factor_version`, `factor_valid_from/to`, `gwp_value`, `gwp_set`, `unit_conversion_factor`, `consolidation_share`.
4. **Recalculation is always explicit and always logged.** A user must click "Recalculate period with factor set X"; this writes `RECALCULATE` AuditEvents and, if the period is `LOCKED`, is refused.
5. Mid-year factor changes split the activity pro-rata by days (§3.6).

**Canonical acceptance test:**
> Create a diesel stationary-combustion record for 2026-03-01 using DEFRA 2026 v1.0 (2.68 kgCO₂e/L). Publish DEFRA 2026 v1.1 (2.71). Do not recalculate. Assert the record still reports at 2.68 and its `factor_version` reads "2026 v1.0". Then recalculate explicitly and assert it moves to 2.71 **and** an AuditEvent exists with both before and after values.

---

## 6. Units are a type, not a string

A `UnitCode` enum with an explicit dimension. Conversion goes through one module; nothing else in the codebase multiplies by 1000.

| Dimension | Codes |
|---|---|
| Volume | `L`, `M3`, `GAL_US`, `GAL_UK` |
| Mass | `KG`, `TONNE`, `LB`, `G` |
| Energy | `KWH`, `MWH`, `GJ`, `MJ`, `THERM`, `MMBTU` |
| Distance | `KM`, `MI`, `NM` |
| Mass-distance | `TONNE_KM`, `KG_KM` |
| Passenger-distance | `PASSENGER_KM` |
| Currency | `INR`, `EUR`, `USD`, `GBP`, `CAD` (spend-based only; carries a `currency_year` for deflation) |
| Emissions | `KG_CO2E`, `T_CO2E`, `KG_CO2`, `KG_CH4`, `KG_N2O` |

Rules:
- Conversion **within** a dimension is a fixed ratio table. Conversion **across** dimensions (L of diesel → GJ) is **not** a unit conversion — it is a fuel property (net calorific value, density) and lives on a `FuelProperty` table, versioned and snapshotted like a factor. Conflating the two is the classic failure mode.
- Currency conversion is never silent: a spend record in INR matched to a EUR-denominated EEIO factor requires an explicit, stored FX rate with a date.
- A record whose `unit` dimension doesn't match the factor's `unit_denominator` dimension is a **hard error at write time**, not a runtime surprise.

---

## 7. Calculation engine

Lives in `/lib/calc/`. Pure TypeScript functions. No Prisma imports, no `fetch`, no `Date.now()` — every input is an argument.

```ts
calculateEmissions(input: CalcInput): CalcResult[]
```

Two more pure functions live here and follow the same rules:
- `evaluateVisibility(question.visible_if, siteProfile, siteAssets, answers)` → boolean. Same function on client and server; the client uses it to render, the server uses it to compute completeness. Divergence between the two is a bug class this eliminates.
- `projectAnswer(answer, question, binding, site, period)` → `ActivityRecord[]`. Turns what a human typed into an accounting record. Repeating tables produce many.

`CalcInput` carries the activity, the resolved factor(s), the GWP set, the consolidation share, and the fuel properties. `CalcResult` carries the emissions plus **every snapshot field** listed in §3.5. The function that resolves factors (`resolveFactor`) is separate and also pure — it takes a candidate list, not a database.

Core formula:
```
emissions_kg_co2e =
  quantity_normalised
  × factor_value
  × gwp_value
  × consolidation_share
```

Test requirements — a change to `/lib/calc/` without tests is not accepted:
- Golden-value tests against published worked examples (DEFRA, EPA).
- The superseded-factor test (§5).
- Mid-year factor split: 365-day activity across a factor change on day 200 → two EmissionRecords, day-weighted, summing to the correct total.
- Unit-mismatch throws.
- Scope 2 dual-basis: one activity → exactly two EmissionRecords.
- Equity-share: 40% share halves→ 0.4× the emissions, and the share is snapshotted.
- Rounding: all arithmetic in `decimal.js` or Prisma `Decimal`. Rounding happens **only at display and export**, never in storage.

---

## 8. CSV import

80% of real usage. Design accordingly.

- Per-scope templates, downloadable, with an example row and a data dictionary.
- Column mapping UI with saved mappings per org (users' exports don't change month to month).
- **Dry-run first, always.** Import produces a preview: rows valid / rows warned / rows rejected, with per-row reasons. Nothing is written until the user confirms.
- Every import creates an `ImportBatch` (`id`, `filename`, `sha256`, `row_count`, `uploaded_by`, `status`, `error_report_key`). Every created ActivityRecord points back to it. **A batch is reversible in one click** while the period is unlocked.
- Duplicate detection on (site, fuel, activity_start, activity_end, quantity) → warn, let the user tick "yes, genuinely two invoices".
- Targets: 10,000 rows imported in under 60s; the file is streamed, not loaded into memory.

---

## 9. Period lifecycle, locking, restatement

```
DRAFT ──submit──> IN_REVIEW ──approve+lock──> LOCKED ──assurance──> ASSURED
                      │                          │
                      └────── reject ────────────┘ (unlock: ADMIN only, logged, requires reason)
```

- `LOCKED`/`ASSURED`: activity data is immutable. Full stop.
- A correction to a locked period is a **Restatement**: a new record set with `restates_id` pointing at the original, a mandatory `restatement_reason`, and a report that shows both the original and restated figure. ESRS requires restatements to be disclosed, not quietly applied.
- Base-year recalculation is triggered by structural change (acquisition, divestment, methodology change) crossing a stated significance threshold (default 5%). The system flags it; a human decides.

---

## 10. Reporting outputs (built last)

1. **Inventory report** — totals by scope, by category, by site, by gas; location- and market-based Scope 2 side by side.
2. **ESRS E1 datapoint pack** — E1-4 (targets), E1-5 (energy consumption & mix), E1-6 (gross Scopes 1/2/3 and total), E1-7 (removals, if any), E1-8 (internal carbon price, if any).
3. **Intensity metrics** — tCO₂e per m², per FTE, per unit of output, per unit revenue — denominators are org-defined.
4. **Audit pack (XLSX)** — one row per EmissionRecord with all snapshot columns, so an assurer can recompute the whole inventory in Excel without the app. This is the single most useful export; treat it as a first-class deliverable, not a debug dump.
5. **Year-on-year comparison** with restatements flagged.

Every export carries **both** the org's labels and the underlying codes — labels in the header a human reads, codes in a machine-readable column an assurer or a downstream system maps against. A report renders with the labels in force when it was generated, not today's.

---

## 11. Build order

1. Prisma schema + migrations + seed (a handful of real DEFRA/grid factors, one org, two sites, the neutral asset-type library, the system label defaults)
2. Auth + org membership + tenant scoping (Prisma middleware + Postgres RLS)
2b. **Label layer** — `Vocabulary`, `LabelOverride`, `resolveLabel()`, the `<Label>` component and the no-hardcoded-strings lint rule. Do this before any UI, or you will retrofit hundreds of strings.
3. Unit conversion layer + `FuelProperty` table — **before** any calculation code
4. Site Profile + SiteAsset CRUD — nothing downstream resolves without them
5. Factor Lab: factor sets, factors table, CSV factor import
6. Questionnaire Builder: template/section/question CRUD + FactorBinding + **Test binding**
7. Calculation engine — pure functions, tests written alongside
8. Data Collection screen: render assignment, `visible_if` evaluation, answers, autosave, live result chip
9. `projectAnswer` → ActivityRecord → EmissionRecord, plus the "show the maths" expander
10. CSV activity import (dry-run first)
11. Document storage (S3/R2 + metadata rows + sha256)
12. Review queue, approvals, tasks
13. Period lock + audit log surfacing
14. Dashboards
15. Report exports

See `UX.md` for the screen-by-screen design of steps 4–14.

---

## 12. Open questions to resolve before coding

- [ ] Which entity is the reporting org — a single site, or a group with several?
- [ ] Consolidation approach: operational control (most common) or equity share?
- [ ] Base year: which FY, and is data available for it?
- [ ] Primary factor sources: DEFRA + IEA, EPA, ADEME, a national grid publisher, or a mix?
- [ ] Currency and reporting units: tCO₂e assumed; confirm.
- [ ] Is external assurance planned? (Limited vs reasonable changes how strict §9 must be.)
- [ ] Object storage: S3, R2, or Supabase Storage?
