# Report Integration Plan

This document describes the practical integration path between the CRM, the retirement planning tool, and the pre-meeting report.

## Target Architecture

The clean target is:

The transfer is **file-based** (decided 2026-07-01). The CRM exports a review-data file; the tool opens it; the report is generated in the tool. Nothing writes back to the CRM.

```text
CRM data
  ↓  CRM "Export report data" button
Review-data file  →  saved to the family's Dropbox folder (compliance snapshot of source data)
  ↓  planning tool "Open"
Per-account mapping screen  (each account → Retirement / Discretionary / Ignore)
  ↓
Planning inputs  (aggregated from the confirmed mapping)
  ↓
Projection + scenario play  (in the tool)
  ↓
Report renderer  (in the tool)
  ↓
PDF report  →  saved to the family's Dropbox folder (the deliverable)
```

## Why Use a Snapshot

A snapshot prevents the report from changing after it is prepared.

Without a snapshot, opening a report tomorrow could silently show different account values, policy benefits, or projection results because CRM data changed.

**The snapshot is the exported review-data file in Dropbox — not a database table.** The dated file fixes the CRM facts at export time; the report PDF (also in Dropbox) fixes the finished deliverable. Between them they answer "what data did we use, and what did we produce, on this date."

The exported review-data file stores:

- The export date + who exported it.
- The CRM facts used (members, accounts with suggested buckets, held-away items, risk, estate, planner comments).

The advisor's confirmed per-account mapping, the tool's assumptions, and the projection outputs are produced **in the tool** and captured in the generated report itself (and, optionally, an archived report snapshot alongside the PDF). They are not written back to the CRM.

## Stage 1: Keep the Report Static but Documented

This is the current stage.

Deliverables:

- HTML report design.
- `report-data-contract.md`.
- `sample-report-data.json`.
- `crm-to-planning-mapping.md`.
- `report-template-notes.md`.

Goal:

Make it clear what data the finished report will eventually need.

## Stage 2: Build a Data Renderer

Create a small render function that accepts the sample JSON and fills the HTML.

Options:

1. Client-side JavaScript inside the HTML file.
2. A small Node script that produces a filled HTML file.
3. A tiny Next.js route/page if the report becomes part of a web app.

Recommended first attempt:

Use a Node script because it keeps the report deterministic and easy to test.

Example flow:

```text
sample-report-data.json
  ↓
render-report.js
  ↓
pre_meeting_report_output.html
  ↓
browser print / PDF export
```

## Stage 3: CRM Review-Data Export → Dropbox

**Built (Session 157, 2026-07-01):** shipped as the **Reporting** tab (the renamed Prep Notes tab, moved to the financial nav row). The "Export report data" button downloads the `sw-review-data` file and fail-soft pushes a copy to `<client folder>/Reports/CRM/`, logging each export to the `report_exports` table (with the payload) for on-screen history. See `lib/reports/pre-meeting-report-data.ts` + `components/reporting/`.

Add a CRM export function + an "Export report data" button on the client group.

The function (a new `lib/reports/` module, mirroring `lib/reports/compliance-report.ts`) gathers, for one group:

- client group + members (with ages)
- `assets` (managed) ∪ `balance_sheet_items` (held-away / property / business / debt) — the **only** sanctioned place this union happens
- a **suggested** planning bucket per investment account
- insurance policies + benefits (mapped via `lib/risk/benefit-columns.ts`)
- estate plans (will rows, beneficiaries, POA, trust)
- the three planner comments (risk / estate liquidity / estate)

It writes the result as the **review-data JSON file** (`kind: "sw-review-data"`, see `crm-report-integration-status-2026-07-01.md` §7.1) to the family's Dropbox folder via the existing `lib/dropbox/client.ts` `uploadFile()`, fail-soft (record the error, don't block). That written file is the dated compliance snapshot of the source data.

## Stage 4: Tool Opens the Review-Data File

**Built (2026-07-03):** the Open flow now dispatches on file `kind`: an `sw-review-data` file routes to the mapping screen (Stage 5) instead of the plan-restore path.

The planning tool's existing "Open a saved plan" flow (`applyPlanFile`) learns a second file `kind`: `sw-review-data`.

- The tool's current guard rejects any file whose `kind` isn't its own plan kind — so this new branch is required.
- On opening a review-data file, the tool routes to the **mapping screen** (Stage 5) rather than the plan-restore path.
- No CRM-side review screen exists. Mapping is done in the tool, per account, and is **not** saved back to the CRM — the one-directional flow means the CRM re-emits its default suggestions on the next export and the advisor re-confirms.

## Stage 5: Per-Account Mapping Screen (in the tool)

**Built (2026-07-03):** a mapping modal renders each account and aggregates the confirmed choices per (spouse, bucket) into the planning inputs, with child/dependant-owned accounts defaulting to Ignore (a fix over the 2-slot brief).

The tool renders every account from the loaded file with its owner and its CRM-suggested bucket. The advisor sets each account to one of:

- **Retirement assets** — feeds the retirement projection
- **Discretionary assets** — feeds the discretionary projection
- **Ignore** — excluded from the projection (`planningBucket: 'excluded'`, `includeInProjection: false`)

On confirm, the tool aggregates per (owner, bucket) into the planning inputs it already uses (`hp-ret-A/B`, `hp-disc-A/B`, contributions). The advisor then plays scenarios as normal (return, inflation, retirement age, income goal, capital events).

The non-planning data (per-account detail, risk, estate, comments) is retained in tool memory to feed the report pages. The tool's projection produces: projected starting income, goal progress, chart series, capital at retirement, contribution leverage.

## Stage 6: Report Generation → Dropbox

**Built (2026-07-03):** the `.review-report` 8-page deck is rendered in the tool from the loaded CRM facts plus the live projection, with the estate page rebuilt to schema 1.3.0. Save-to-Dropbox remains manual print-to-PDF.

Once the advisor is happy with the mapping and scenario:

1. The tool merges its live projection with the loaded facts and renders the 8-page report HTML (`report_master.html` structure): projection page from the tool's own series; accounts / risk / estate pages from the loaded file.
2. The advisor prints to PDF (MVP: browser print, same as the estate-planner and compliance-export flows).
3. The advisor saves the PDF to the family's Dropbox folder (the deliverable). A Dropbox auto-push can follow later.

The already-in-Dropbox review-data file is the source-data record; this PDF is the finished report. Together they are the audit trail — no database snapshot table is needed.

## Stage 7: Bulk Scheduled Export (later)

A CRM cron runs the Stage 3 export for every active client family on a schedule and writes each file to its Dropbox folder, so a fresh review-data file is always waiting. Meeting prep then becomes "open the file" with no CRM step at meeting time — the workflow at ~100 families with support staff.

## File or Database?

**Decided: file in Dropbox, no database table.**

The exported review-data file (source data) and the report PDF (deliverable) both live in the family's Dropbox folder — the same place every other client record lives, and the agreed system of record. This is enough for the compliance requirement ("what data did we use on this date") without a `planning_review_snapshots` table.

- **Review-data file** — `kind: "sw-review-data"` JSON, named with the family + export date (e.g. `bennett-review-data-2026-07-01.json`).
- **Report PDF** — named with the family + prepared date.
- No `planning_review_snapshots` DB table. (If a searchable export history is ever wanted, a thin `compliance_exports`-style log row could point at the Dropbox path — a later, optional enhancement, not part of this flow.)

## Practical Build Order

1. Finalise the report design (`report_master.html`).
2. Finalise the review-data file shape (`crm-report-integration-status-2026-07-01.md` §7.1) + `sample-report-data.json`.
3. Build the CRM review-data export function (`lib/reports/`) + "Export report data" button + Dropbox write.
4. Extend the tool's "Open" to recognise `kind: "sw-review-data"` and route to the mapping screen.
5. Build the tool's per-account mapping screen (Retirement / Discretionary / Ignore) → aggregate into planning inputs.
6. Build the tool's report renderer (loaded facts + live projection → 8-page HTML) + print-to-PDF.
7. Save the report PDF to Dropbox (manual MVP; auto-push later).
8. (Later) Bulk scheduled export for every active family.

## Important Rule

The planning tool should not need to understand the full CRM.

The CRM should not need to understand every visual detail of the report.

The snapshot is the contract between them.
