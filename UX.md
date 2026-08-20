# UX.md — Green Ledger: what the product looks like

**Companion to SPEC.md.** This document describes every screen, and the three-layer model that makes the questionnaire work.

---

## 0. The core idea, in one paragraph

There are three layers, and keeping them separate is the whole design:

| Layer | Question it answers | Who touches it | Screen |
|---|---|---|---|
| **1. Site Profile** | *What exists at this site?* — building type, floor area, beds, boilers, generators, chillers, vehicles, refrigerant charge | Site admin, once a year | Site → Profile |
| **2. Questionnaire** | *What do we ask about it?* — plain-language questions, one per data point | Sustainability lead, in the Builder | Site → Data Collection |
| **3. Factor Lab** | *How does an answer become kgCO₂e?* — each question is bound to a factor lookup rule | Carbon expert / admin | Factor Lab |

> **The person filling the form never sees an emission factor.** They see *"How much diesel did the backup generator consume in FY2026?"* with a box and a unit dropdown. The binding underneath turns that into `activity_type=STATIONARY_COMBUSTION, fuel=diesel, method=FUEL_BASED, region=site.country` → resolves a factor → writes an ActivityRecord and its EmissionRecords.
>
> **The Site Profile drives which questions appear.** If a site has no diesel generator in its asset list, the diesel question never renders. This is why the profile comes first — it's not decoration, it's the conditional-logic input.

---

## 1. Global shell

Every screen shares:

- **Left sidebar (collapsible, 240px):** Dashboard · Sites · Data Collection · Factor Lab · Tasks · Documents · Reports · Settings
- **Top bar:** organisation switcher · **reporting period selector (FY2026 ▾)** · global search · notifications · avatar
- **Period selector is global and sticky.** Everything on every screen is filtered to it. When a period is `LOCKED`, a slim amber band sits under the top bar: *"FY2026 is locked. Data is read-only. Corrections require a restatement."*

Light and dark mode both first-class. Sans-serif throughout, tabular figures in tables.

---

## 2. Dashboard — "where does everyone stand?"

The landing screen. Its job is **progress by site**, not vanity totals.

### 2.1 Header row — four stat tiles
```
Total emissions        Data completeness      Sites reporting        Overdue tasks
12,480 tCO₂e           68%                    7 of 11                4
▲ 4.2% vs FY2025       ▲ 12 pts this month    2 in review            2 past due 7+ days
```
Each tile: label (muted), big proportional figure, delta line with an ↑/↓ icon **and** a word — never colour alone.

### 2.2 Progress by site — the main event
A table, one row per site, sorted by completeness ascending (worst first — that's who needs chasing).

| Site | Type | Owner | Scope 1 | Scope 2 | Scope 3 | Overall | Status |
|---|---|---|---|---|---|---|---|
| Northgate Plant | Manufacturing | R. Okafor | ▓▓▓▓▓▓▓░ 88% | ▓▓▓▓▓▓▓▓ 100% | ▓▓▓░░░░░ 34% | **71%** | In review |
| Riverside Office | Office | A. Lindqvist | ▓▓▓▓░░░░ 45% | ▓▓▓▓▓▓░░ 72% | ░░░░░░░░ 0% | **38%** | Draft |
| Central Warehouse | Warehouse | — | ░░░░░░░░ 0% | ░░░░░░░░ 0% | ░░░░░░░░ 0% | **0%** | Not started |

- Completeness = answered required questions ÷ applicable required questions, **per scope**. Applicability comes from the site's asset profile, so a site with no vehicles isn't punished for an empty mobile-combustion section.
- Bars are thin, 4px rounded ends, one hue with a light track. Not a rainbow.
- Status is a pill with an icon + label: `Not started` · `In progress` · `In review` · `Approved` · `Locked`.
- **Row click → that site's Data Collection screen.** Hover reveals a "Send reminder" button that creates a Task.

### 2.3 Emissions breakdown — two charts side by side
- **Left: stacked bar, emissions by scope over the last 5 periods.** Three series (Scope 1 / 2 / 3), fixed hue order, 2px gap between stacked segments, legend always present. One y-axis. Never dual-axis.
- **Right: horizontal bar, top 10 emission sources this period,** direct-labelled with values. Sorted descending. This is the "where do I actually act" chart.

Below: **Scope 2 dual-basis callout** — a small two-value tile showing location-based vs market-based side by side, because ESRS E1-6 requires both and people forget one exists.

### 2.4 Data quality strip
A single 100%-width stacked bar: Measured / Calculated / Estimated / Proxy. Hover gives counts. This is the number an assurer asks about first.

---

## 3. Sites

### 3.1 Site list
Cards or table (toggle). Each: name, code, type icon, country, completeness ring, open task count, last activity. Filters: type, country, status, owner. `+ Add site`.

### 3.2 Site detail — tabs

```
[ Profile ] [ Assets ] [ Data Collection ] [ Emissions ] [ Documents ] [ Tasks ] [ History ]
```

#### Tab: Profile
The site's identity card. Editable form, grouped:

- **Identity** — name, code, legal entity, cost centre
- **Location** — address, city, state, country, lat/long, **grid region** (drives the location-based electricity factor), timezone
- **Classification** — site type (from an org-editable vocabulary, seeded with Manufacturing / Office / Warehouse / Data centre / Retail / Logistics / Lab / Mixed use / Other), ownership (Owned / Leased-operational / Leased-finance / Franchise), operating hours, shifts
- **Size & denominators** — floor area (m²), FTE headcount, annual revenue, plus **org-defined custom denominators** (units produced, operating hours, tonnes shipped, rack-kW — whatever the business actually measures) → these are the intensity-metric denominators, and ESRS wants at least one
- **Boundary** — consolidation share, in-scope from / to, `parent_site_id` for campuses
- **Contacts** — data owner, approver, finance contact

Right rail: a **completeness meter for the profile itself** — "6 of 9 required fields". An incomplete profile is flagged on the dashboard, because it silently breaks factor resolution (a site with no grid region can't get an electricity factor).

#### Tab: Assets — "what appliances does it have"
This is the inventory that drives the questionnaire. A table plus an `+ Add asset` drawer.

| Asset | Category | Fuel / Refrigerant | Capacity | Qty | Installed | Status |
|---|---|---|---|---|---|---|
| Backup generator DG-1 | Stationary combustion | Diesel | 500 kVA | 1 | 2019-04 | Active |
| Boiler B-2 | Stationary combustion | Natural gas | 2 t/h steam | 1 | 2016-11 | Active |
| Chiller CH-1 | Refrigeration | R-410A, 120 kg charge | 300 TR | 2 | 2021-02 | Active |
| Forklift fleet | Mobile combustion | LPG | — | 6 | — | Active |
| Paint booth PB-1 | Process | Solvents (VOC) | 12 k units/yr | 1 | 2020-05 | Active |
| Rooftop solar | On-site generation | — | 180 kWp | 1 | 2023-08 | Active |

Asset fields: `asset_type`, `category`, `fuel_or_refrigerant_code`, `capacity` + unit, `quantity`, `refrigerant_charge_kg`, `commissioned_on`, `decommissioned_on`, `serial/tag`, `sub_location`, `notes`, `status`.

**Why this table earns its keep:** adding "Chiller CH-1, R-410A" makes the fugitive-emissions question for R-410A appear in the questionnaire automatically, pre-labelled with the asset name. Remove the asset and the question disappears. The user never picks a category from a GHG Protocol taxonomy — they describe their building, and the taxonomy is inferred.

Asset types ship as **one industry-neutral starter library** — generators, boilers, chillers, HVAC, fleet vehicles, forklifts, compressors, process equipment, IT/UPS, on-site generation, waste handling. Every entry is renamable and the org can add its own (§11.1). A manufacturer, a landlord, and a logistics operator each end up with a vocabulary that matches how they already talk, without the product having guessed at a vertical.

#### Tab: Data Collection
The questionnaire for this site and period. See §4.

#### Tab: Emissions
Read-only. Every EmissionRecord for the site, with a **"show the maths" expander** on each row:

```
Diesel — Backup generator DG-1
  Quantity              14,200 L
  → normalised          14,200 L
  × Factor              2.68000000 kgCO₂e / L     DEFRA 2026 v1.0, Table 5  (valid 2026-01-01 → 2026-12-31)
  × GWP                 1.0                        IPCC AR6
  × Consolidation share 1.00
  = Emissions           38,056 kgCO₂e  =  38.06 tCO₂e
  Calculated 2026-08-14 by engine v1.2.0 · Source: invoice_DG1_FY26.pdf
```
This expander is the trust surface of the whole product. Build it early.

#### Tab: Documents / Tasks / History
Documents: drag-drop, thumbnail grid, linked entity chip, sha256 shown on hover.
History: filtered audit log — who changed what, before → after, when.

---

## 4. Data Collection — the questionnaire (the screen people spend their time in)

### 4.1 Layout
Three columns:

```
┌────────────┬─────────────────────────────────────┬──────────────┐
│ Section    │  Questions                          │ Context rail │
│ nav        │                                     │              │
│            │  Scope 1 › Stationary combustion     │ Progress 88% │
│ ▸ Scope 1  │  ──────────────────────────────────  │              │
│   • Stat…✓ │  Q1. How much diesel did the backup  │ Help text    │
│   • Mobile │      generator (DG-1) consume in     │              │
│   • Fugit… │      FY2026?                         │ Attachments  │
│ ▸ Scope 2  │      [ 14,200 ] [ Litres ▾ ]         │  invoice.pdf │
│ ▸ Scope 3  │      Data quality: [ Measured ▾ ]    │              │
│   • 3.1 …  │      📎 Attach evidence  💬 Comment   │ Comments (2) │
│   • 3.5 …  │      ✓ Answered · 38.06 tCO₂e        │              │
└────────────┴─────────────────────────────────────┴──────────────┘
```

- **Left:** section tree, mirroring scopes and Scope 3 categories 1–15. Each node shows a tiny completeness ring. Sections with zero applicable questions are hidden, not shown empty.
- **Middle:** the questions. One question = one data point = one future ActivityRecord.
- **Right:** contextual rail — progress, the question's help text, its evidence attachments, and a comment thread (this is how a reviewer says "this looks like it double-counts Q3").

### 4.2 Anatomy of a question
- **Label** in plain language, with the asset name interpolated where relevant
- **Help text** — "Find this on your fuel delivery invoices. If you only have spend, switch to the spend-based version below."
- **Input** — the type is set in the Builder: number + unit, number only, text, single-select, multi-select, date, date range, file upload, yes/no, or a **repeating table** (e.g. one row per business-travel leg)
- **Unit dropdown** restricted to the question's declared dimension. A volume question offers L / m³ / gal. It cannot offer kWh. That restriction is enforced by the type system, not by a validation message.
- **Data quality selector** — Measured / Calculated / Estimated / Proxy
- **Evidence** — attach one or more documents. If the Builder marked the question `evidence_required`, it can't reach Approved without one.
- **Live result chip** — the moment a valid answer is entered, the binding resolves and the chip shows the computed tCO₂e. Immediate feedback is what makes people trust the form.
- **State** — Unanswered / Draft / Answered / Flagged / Approved, shown as an icon + word.

### 4.3 Behaviours
- **Autosave** on blur; "Saved 12:04" in the header. Nobody loses an hour of typing.
- **Conditional visibility** — a question renders only if its condition passes: the site has a matching asset, the site type matches, or a previous answer had a given value ("Do you purchase renewable energy certificates?" → yes → reveal the EAC questions).
- **Not-applicable with a reason.** Every question can be marked N/A, but the reason box is mandatory and it lands in the report. This is how ESRS's "explain the omission" requirement gets satisfied by construction instead of by a scramble in March.
- **Prior-period prefill** — a ghost value showing last year's answer, one click to copy. Biggest single time-saver in year two.
- **Bulk import** — a `Import from CSV` button per section maps a spreadsheet onto the same questions, with the dry-run preview from SPEC.md §8.
- **Submit section for review** → moves to `IN_REVIEW`, creates a Task for the approver, locks the section for the contributor.

### 4.4 Review queue (approver view)
A cross-site inbox: every submitted section, sorted by due date. Each item opens the same questionnaire in review mode — answers read-only, with **Approve** / **Request changes** per question and a comment box. Approving writes AuditEvents and moves the section to `APPROVED`.

---

## 5. Questionnaire Builder — "flexibility to build and map"

Admin-only. This is what makes the product a platform instead of a hardcoded form.

### 5.1 Layout — three panes
```
┌──────────────┬──────────────────────────┬────────────────────────┐
│ Question     │  Canvas                  │  Inspector             │
│ library      │  (sections + questions,  │  (selected question)   │
│              │   drag to reorder)       │                        │
│ Search…      │                          │  Label                 │
│ ▸ Scope 1    │  ▸ Scope 1               │  Help text             │
│  Diesel qty  │    ▸ Stationary comb.    │  Input type            │
│  Gas qty     │      ⠿ Q1 Diesel qty     │  Unit dimension        │
│  LPG qty     │      ⠿ Q2 Natural gas    │  Required / evidence   │
│ ▸ Scope 2    │    ▸ Fugitive            │  Visibility rule       │
│  Grid kWh    │      ⠿ Q3 R-410A top-up  │  ── FACTOR BINDING ──  │
│ ▸ Scope 3    │  ▸ Scope 2               │  Activity type         │
│  …           │      ⠿ Q4 Grid kWh       │  Method                │
│              │                          │  Fuel/material code    │
│ + New        │  + Add section           │  Region strategy       │
│              │                          │  Factor set            │
│              │                          │  [ Test binding ▸ ]    │
└──────────────┴──────────────────────────┴────────────────────────┘
```

### 5.2 The Inspector's factor-binding panel — the heart of the mapping
Selecting a question shows, under a divider labelled **Factor binding**:

| Field | Example | Notes |
|---|---|---|
| Scope / category | Scope 1 › Stationary combustion | |
| Scope 3 category | — | required only for Scope 3 |
| Activity type | `STATIONARY_COMBUSTION` | |
| Method | `FUEL_BASED` | drives which factors are candidates |
| Fuel / material code | `diesel` | from the controlled vocabulary |
| Unit dimension | Volume | restricts the answer's unit dropdown |
| Region strategy | Site country → grid region → GLOBAL | most-specific-first |
| Factor set | *Period default* (DEFRA 2026 v1.1) or pinned | |
| GWP set | *Org default* (AR6) | |
| Multiplier | 1.0 | for e.g. a question answered per-month |
| Output basis | Single / Dual (location + market) | electricity questions use Dual |

**`Test binding ▸`** opens a panel: enter a sample answer and a sample site, and it shows the resolved factor, the full arithmetic, and the result — or a red explanation of why resolution failed (*"No factor matches fuel=diesel, region=IN, method=FUEL_BASED in DEFRA 2026 v1.1. Add one in the Factor Lab, or change the region strategy."*). **No question can be published with a failing binding.** That single rule prevents the most common failure mode in this class of product: a beautiful form that silently produces zeros.

### 5.3 Versioning and rollout
- Templates are versioned: `Standard Operations v3`. Editing a published template creates a **draft version**; nothing changes for people currently filling forms.
- **Publish** shows a diff: questions added / removed / re-bound, and which sites and periods are affected.
- Assignment: a template version is assigned to a **set of sites** for a **period**. Different site types can run different templates (Standard Operations v3 for plants, Light Site v1 for small offices).
- An assigned template version is **frozen for that period**. Changing a binding next year never rewrites last year's answers — same principle as factor snapshots.
- Library questions are reusable across templates; editing a library question offers "update everywhere / just here".

---

## 6. Factor Lab — the backend factor library

Where the carbon expert lives. Four tabs.

### 6.1 Tab: Factor sets
Cards for each set: publisher, name, version, published date, region scope, licence, active/archived, factor count, **and how many questions currently bind to it**. Actions: import from CSV, clone, archive, set as period default.

### 6.2 Tab: Factors
A dense, filterable table — the reference workhorse.

| Fuel / material | Activity type | Method | Region | Gas | Value | Unit | Valid from | Valid to | Source | |
|---|---|---|---|---|---|---|---|---|---|---|
| diesel | Stationary comb. | Fuel-based | GLOBAL | CO₂e | 2.68000 | kgCO₂e / L | 2026-01-01 | 2026-12-31 | DEFRA 2026 v1.0 T5 | ⋯ |
| diesel | Stationary comb. | Fuel-based | GLOBAL | CO₂e | 2.71000 | kgCO₂e / L | 2027-01-01 | — | DEFRA 2027 v1.0 T5 | ⋯ |
| grid_electricity | Purchased elec. | Location |  GB-NAT | CO₂e | 0.71000 | kgCO₂e / kWh | 2026-04-01 | 2027-03-31 | NG ESO 2026 v2026.1 | ⋯ |

Filters across the top: set · scope · category · region · fuel · validity date · gas. Search by fuel name.

A superseded row shows a small "superseded by →" link. **Rows are never edited in place** — the edit drawer says so and offers "Create new version" instead.

### 6.3 Tab: Bindings map — the answer to "which question uses which factor"
A two-column mapping view: questions on the left, resolved factors on the right, with lines between. Filter by template, scope, or set. Health indicators per row:

- ✅ resolves cleanly
- ⚠ resolves via a fallback region (using GLOBAL where a country factor would be better)
- ⛔ no factor matches — **broken binding**, blocks publish
- ⚠ ambiguous — two factors match equally well; resolution is an error, not a coin flip

A **"Broken bindings"** count sits on the Factor Lab nav item as a badge. Fixing these is the admin's morning job.

### 6.4 Tab: Unit & fuel properties
The conversion table (within-dimension ratios) and the `FuelProperty` rows — density, net calorific value — each versioned and dated like a factor. Explicitly separate from unit conversion, per SPEC.md §6, with an on-screen note saying why.

### 6.5 Recalculation
A button, never automatic: **"Recalculate FY2026 with DEFRA 2026 v1.1"**. Shows a preview diff — old total, new total, per-record deltas — before committing. Refused outright on locked periods. Writes an AuditEvent per record.

---

## 7. Tasks
Kanban (Open / In progress / Blocked / Done) plus a list view. Each card: title, site chip, assignee avatar, due date, linked entity. Created manually, by "Send reminder" on the dashboard, by a rejected review, or by rules ("30 days before period close, create a submission task for every site with <100% completeness").

## 8. Documents
Grid with filters by type, site, period, linked entity. Preview pane. sha256 and uploader shown. An **orphan filter** — documents linked to nothing — because those are the ones that go missing at audit time.

## 9. Reports
Period picker → report type → generate. Types per SPEC.md §10. Each generated report appears in an immutable list with its timestamp, generator, engine version, factor sets used, and a download button. Side-by-side comparison of two report versions, with restatements flagged.

---

## 10. Visual language

- **Chart colours:** fixed categorical order — blue `#2a78d6`, orange `#eb6834`, aqua `#1baf7a`, yellow `#eda100`, magenta `#e87ba4`, green `#008300`, violet `#4a3aa7`, red `#e34948`. Assigned in order, never cycled. Scope 1/2/3 always get slots 1/2/3 so the colours mean the same thing on every screen.
- **Status colours are reserved** and never used for a data series: good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b` — always with an icon and a word.
- **Surfaces:** light `#fcfcfb` on page plane `#f9f9f7`; dark `#1a1a19` on `#0d0d0d`. Hairline borders at 10% ink.
- **Marks:** thin bars, 4px rounded data-ends, 2px lines, 2px surface gap between stacked segments, recessive gridlines.
- **Progress bars use one hue**, not a red→amber→green gradient. Completeness is magnitude, not polarity — a gradient would imply 45% is "bad" when it may be perfectly on track in month two.
- Every chart has a legend for ≥2 series and a **"View as table"** toggle.

---

---

## 11. Labels & vocabularies — the org owns every word

**Codes are the system's. Labels are the customer's.** Every enum, taxonomy entry, status, unit and category has a stable machine code that never changes, and a display label the organisation controls. Renaming a label can never change a number — that separation is what makes this safe to hand to customers. Full data model in `SPEC.md` §3.19–3.20.

### 11.1 Settings → Labels — "call it whatever you call it"

An admin screen with a search box and a table. Every renamable thing in the product, in one place.

```
Search: [ combustion            ]     Scope: [ Organisation ▾ ]   Locale: [ English ▾ ]

Code                        System default          Your label              Used in        
─────────────────────────────────────────────────────────────────────────────────────────
STATIONARY_COMBUSTION       Stationary combustion   Fixed fuel burning      12 questions  ✎
  └ site_type:OFFICE                                Building heating        3 questions   ✎
  └ question:Q1                                     Generator fuel          1 question    ✎
MOBILE_COMBUSTION           Mobile combustion       Fleet &amp; plant fuel      6 questions   ✎
scope3_cat_5                Waste generated…        Site waste              4 questions   ✎
PROXY                       Proxy                   Rough estimate          —             ✎
org_units_produced          —                       Units produced          4 sites       ✎
```

- **Filter by scope** — Organisation / a site type / a template / a single question — so you can see exactly which layer a word is coming from.
- **"Used in" is a link.** Click it and you see every question, section and report that renders this label. Renaming is never a blind change.
- **Reset to default** on any row.
- **Import / export as CSV** — a customer with 300 relabels does it in a spreadsheet, not 300 clicks.
- **Hide** an option you'll never use (`LOGISTICS` site type, `GAL_UK` unit) so it stops cluttering dropdowns, without deleting it.
- **Reorder** dropdown options to put your common ones first.

**The pencil is everywhere.** Any admin sees a faint ✎ beside any label anywhere in the app — on a section heading, a dropdown option, a chart legend. Clicking it opens this editor pre-scoped to where they clicked, with the scope selector already set to the most useful level. Renaming happens in context, not by hunting through settings.

**What renaming never does:** change a number, change a factor, change a CSV import column key, or alter a report already generated. The code underneath is immutable; a locked report renders with the labels it was generated with. There's a permanent one-line note at the top of this screen saying exactly that, because it's the first question every customer asks.

### 11.2 Open vocabularies — adding your own entries

Site types, asset types, document types, materials and **intensity denominators** are extensible, not just renamable. `+ Add` on each list. Org-created codes get an `org_` prefix so they can never collide with a system code added in a later release.

Scopes, the 15 Scope 3 categories, methods and data-quality levels are **closed** — the GHG Protocol and ESRS define them. They can be relabelled but not added to, and the screen says so rather than silently disabling the button.

**Custom denominators pay for themselves fastest.** A manufacturer adds "Units produced", a logistics operator adds "Tonnes shipped", a landlord adds "Lettable m²". Set it on each site's profile and the dashboard grows an intensity metric in that unit. The product never has to know what industry you're in.

---

## 12. What to build first (UI order)

1. **Label layer** — `<Label>` component + Settings → Labels. First, or you retrofit hundreds of hardcoded strings.
2. Site Profile + Assets (nothing downstream works without them)
3. Factor Lab: factor sets + factors table + CSV import
4. Questionnaire Builder with the binding panel and **Test binding**
5. Data Collection screen — read the template, render questions, save answers
6. The "show the maths" expander
7. **Get started page** — the guided checklist (§13). Cheap to build, and it's what makes the first hour survivable.
8. Review queue + approvals
9. Dashboard (needs real data to be worth anything)
10. Reports

---

## 13. Get started — the page that explains the product to itself

The landing screen for a new organisation, and permanently available in the sidebar. Two halves.

### 13.1 The flow diagram
A single always-visible picture of how a number gets made:

```
   WHAT YOU HAVE            WHAT WE ASK             HOW IT'S COUNTED         WHAT COMES OUT
  ┌───────────────┐       ┌──────────────┐        ┌────────────────┐       ┌──────────────┐
  │ Sites         │       │ Questionnaire│        │ Factor Lab     │       │ Reports      │
  │ + Assets      │──────▶│ (questions   │───────▶│ (each question │──────▶│ Dashboards   │
  │               │ drives│  that apply) │ answers│  → a factor)   │ number│ Audit pack   │
  └───────────────┘       └──────────────┘        └────────────────┘       └──────────────┘
     you describe            your team fills        your expert maps          assurer reads
```
Each box is a link. Hovering one dims the others and shows one sentence of plain English.

### 13.2 The checklist
Ordered, with live state pulled from real data — not a static tour. Each row: status icon, title, one line of why, a button, and an expander with a two-minute explanation.

| # | Step | Why it matters | State |
|---|---|---|---|
| 1 | Set your organisation basics | Consolidation approach and base year decide how every later number is scoped. Changing them later means restating. | ✅ Done |
| 2 | Make the product speak your language | Rename anything to match what your teams already say. Codes underneath never change. | ⚠ Optional — 0 labels changed |
| 3 | Add your sites | Location and grid region decide which electricity factor applies. | ◐ 4 of 11 added |
| 4 | List what's at each site | Boilers, generators, chillers, vehicles. This is what makes the right questions appear and the wrong ones vanish. | ◐ 2 of 4 sites |
| 5 | Load your emission factors | The published numbers you'll multiply by. Start with one set; add more later. | ✅ 2 sets active |
| 6 | Build your questionnaire | Plain-language questions. Each one gets bound to a factor — the Builder won't let you publish a broken binding. | ◐ Draft v4 · 2 broken |
| 7 | Assign it and invite your teams | Each site gets an owner, an approver and a due date. | ○ Not started |
| 8 | Collect, review, approve | Contributors answer, approvers check, you lock the period. | ○ Not started |
| 9 | Lock and report | Locking freezes the numbers. Reports are immutable and reproducible forever. | ○ Not started |

Blocked steps are visibly blocked with the reason ("needs at least one site"), never just greyed out.

### 13.3 Concept cards
Four short expanders, in the language of someone who has never done carbon accounting:

- **"What's a scope?"** — Scope 1 is fuel you burn. Scope 2 is energy you buy. Scope 3 is everything else in your value chain. Two sentences each, with one example from *your* data once you have some.
- **"What's an emission factor?"** — A published number that converts an activity into emissions. 1 litre of diesel → 2.68 kg CO₂e. You don't invent them; you cite them.
- **"Why can't I edit last year?"** — Because a report someone relied on must still produce the same number in five years. Corrections happen as restatements, which are disclosed rather than hidden.
- **"What is my auditor going to ask for?"** — The audit pack: one row per emission record with every input that produced it. Export it any time.

### 13.4 A worked example, end to end
A collapsed panel: *"Show me one number, all the way through."* Expanded, it walks a single record from asset → question → answer → factor → arithmetic → report line, with the real screens beside each step. This is the single most effective onboarding asset in a product like this, and it costs a day to build.
