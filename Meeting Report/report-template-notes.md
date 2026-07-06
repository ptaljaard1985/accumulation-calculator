# Report Template Notes

This document explains how the HTML report template is structured and how future agents should edit it safely.

Current template:

`report_master.html`

**Ported into the tool (2026-07-03):** `report_master.html` now also lives inside the planning tool as the scoped `.review-report` 9-page deck, data-bound and rendered from a loaded `sw-review-data` file plus the live projection, with the estate page rebuilt to schema 1.3.0. `report_master.html` remains the standalone design reference.

Current local logo assets:

- `assets/simple-wealth-logo-standard.png`
- `assets/simple-wealth-logo-white.png`

## Template Role

The HTML template is the presentation layer. It should receive prepared data and render a PDF-like report. It should not become the source of truth for client facts, planning assumptions, or calculation logic.

## Current Page Structure

| Page | Key | Purpose |
|---:|---|---|
| 1 | `cover` | Title page. |
| 2 | `agendaPrimary` | Life planning, cash flow, investment, and retirement agenda sections. |
| 3 | `agendaSecondary` | Risk, estate, tax, other, and seasonal check-ins. |
| 4 | `accounts` | Investment account and contribution detail. |
| 5 | `netWorth` | Net worth / balance sheet: four summary cards plus a balance-sheet table (investment portfolio row, one row per held-away item, and a household net-worth total). |
| 6 | `retirementProjection` | Projection chart, planning snapshot, capital events, and contribution leverage. |
| 7 | `risk` | Policy benefit summary and risk comment. |
| 8 | `estate` | Wills, powers of attorney, and trusts as three stacked sections. |
| 9 | `notes` | Methodology, limitations, regulatory wording, and confidentiality. |

Notes:

- The report renders inside the planning tool from a loaded `sw-review-data` file plus the live projection; `report_master.html` is the standalone design reference.
- Net-worth / balance-sheet items (business, property, debt) render on their own `netWorth` page rather than in a strip under the accounts table.
- The estate page presents Wills, powers of attorney, and trusts as three separate stacked sections (the earlier estate-readiness box was removed).
- The import mapping modal captures the projection assumptions (expected return, expected inflation, monthly income goal, retirement age), pre-filled from the CRM assumption seeds or tool defaults and applied on confirm, so the advisor does not need to open the Edit-info drawer before generating the report.

## Design System

Main CSS variables live near the top of the HTML file:

| Variable | Current Use |
|---|---|
| `--brand` | Simple Wealth navy: main brand colour and dark page background. |
| `--gold` | Muted gold accent used for special blocks. |
| `--paper` | Outer page background. |
| `--surface` | White cards. |
| `--surface-2` | Alternate agenda item shading. |
| `--ink` | Main text colour. |
| `--muted` | Secondary text colour. |
| `--line` | Borders and rules. |

## Logo Rules

Use the standard logo on white/light pages:

```html
<img class="brand-logo" src="assets/simple-wealth-logo-standard.png" alt="Simple Wealth">
```

Use the white logo on the dark cover page:

```html
<img class="brand-logo" src="assets/simple-wealth-logo-white.png" alt="Simple Wealth">
```

The logo assets have been cropped and copied locally so the report does not depend on Dropbox paths.

## Typography

The report uses the system sans-serif stack for all text and numbers.

Financial values use tabular number settings rather than a monospaced font. This keeps figures aligned without the slashed-zero look.

Relevant CSS pattern:

```css
font-variant-numeric: tabular-nums lining-nums;
font-feature-settings: "tnum" 1, "lnum" 1;
```

## Agenda Layout Rules

Agenda sections are two-column cards:

- Left column: section label.
- Right side: agenda items in two columns.
- Agenda rows are fixed at `13mm`.
- Section height should be content-driven by the number of agenda rows.
- Alternating shading should work both down and across the two-column agenda grid.

Special case:

- `Life planning` uses the gold label style.
- `Other` uses the normal dark label style.
- `Seasonal check-ins` uses a gold first column and three equal-width reminder columns.

## Table Rules

Table pages use full-width table headers. The wrapper class `table-body` removes the white padding around tables so header and total-row backgrounds run edge-to-edge inside the card.

Use `table-body` only on table-containing detail cards:

```html
<div class="detail-body table-body">
  <table class="simple-table account-table">
```

Do not use `table-body` on free-text comment boxes.

## Comment Box Rules

Comment boxes use the `planner-comment` class.

Only comment-style boxes should receive the soft coloured heading treatment. Do not apply coloured headings globally to all detail cards.

Current comment boxes:

- Risk page: `Comments`
- Estate page: `Estate liquidity`
- Estate page: `Comments`

## Report Data Rules

Do not hard-code final client data into the template once integration begins.

The template should eventually render from a `reviewSnapshot` object matching `docs/report-data-contract.md`. This rendering happens **inside the planning tool** — the tool opens a CRM-exported review-data file, the advisor confirms the per-account mapping, and the tool assembles the report snapshot and renders these pages. The CRM only exports the source-data file; it does not render the report.

Until the rendering layer is built, sample values inside the HTML are acceptable for design work only.

## Editing Guidance for Future Agents

1. Preserve the A4 landscape page size.
2. Keep all printable pages inside `.page`.
3. Keep logo paths relative to the HTML file.
4. Keep page count/footer numbers in sync if pages are added or removed.
5. Avoid adding live calculations to the report template.
6. Do not change the CRM data model from the report template.
7. If a new displayed value is added, update `docs/report-data-contract.md` and `docs/sample-report-data.json`.
8. If a new mapping assumption is added, update `docs/crm-to-planning-mapping.md`.

## Design Decisions (resolved 2026-07-01)

- **Transfer is file-based.** The CRM exports a review-data JSON file (`kind: "sw-review-data"`) to the family's Dropbox folder; the planning tool opens it. No live/injected hydration.
- **The planning tool renders the report** from the loaded file plus its own projection. The CRM only exports the source-data file; it does not orchestrate report generation.
- **Per-account mapping lives in the tool**, not a CRM screen — each account is set to Retirement / Discretionary / Ignore there.
- **Records live as files in Dropbox**, not a database table: the exported review-data file is the dated source-data record, and the report PDF is the deliverable. No `planning_review_snapshots` table.
