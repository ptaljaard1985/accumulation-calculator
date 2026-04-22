# Architecture

This document describes the internal structure of `retirement_accumulation.html`. Read this if you're about to modify the code. Math and conventions are in `CALCULATIONS.md`; visual choices are in `DESIGN.md`.

## The one-file principle

Everything lives in one HTML file. The `<head>` holds design tokens in a `:root` block and roughly 600 lines of component CSS. The `<body>` holds the page structure. A single `<script>` block at the bottom holds all the logic.

There is no module system, no build, no bundler. The cost is that the file is ~1,800 lines. The benefit is that anyone can open it, edit it, and understand it without any tooling. Pierre uses it in meetings and sometimes emails it to clients. Breaking the single-file property breaks the product.

Chart.js is the only runtime dependency, loaded from `cdnjs.cloudflare.com`.

## Top-to-bottom page structure

```
<header>              Simple Wealth brand + document title + print button
<title-block>         H1, subtitle
<client-bar>          Prepared for / Meeting date / Adviser
<household-position>  Collapsible. Per-spouse ages, balances, contributions.
<anchor-row>          Youngest/oldest toggle + retirement age input (50-75)
<capital-events>      Collapsible. Default empty. Inflow/outflow event list.
<market-assumptions>  Sliders: return, CPI, contribution escalation
<summary-cards>       Projected monthly income, capital at retirement, years to go
<delta-bar>           Appears when baseline locked; shows planned vs baseline
<controls-row>        View toggle (Capital/Breakdown/Table) + Real/Nominal + Lock button
<chart-card>          One of three views at a time: capital bars, breakdown bars, year table
<print-summary>       Compliance-ready tables: inputs, outputs, methodology, disclaimer
<footer>
```

The household-position and capital-events sections are collapsible via click on their section header. Each shows a summary chip when collapsed (e.g. "40/40 · R3.5m capital · R20k/mo in" on household, "2 inflows · 1 outflow" on events).

## The JS, bottom to top

The `<script>` block contains one IIFE. Inside it, in roughly this order:

### 1. Formatting helpers

`fmtR(n)` produces rand-formatted strings with spaces as thousand separators. `fmtShort(n)` produces "R4.3m" / "R450k" abbreviations for axis labels and tooltips. `fmtPct`, `parseCurrency`, `parseAge`, `set(id, value)`, `read(id)` — pure utility, no state.

### 2. State variables

```js
var mode = 'pv';             // 'pv' | 'fv' — real vs nominal display
var chartView = 'capital';   // 'capital' | 'breakdown' | 'table'
var anchor = 'youngest';     // 'youngest' | 'oldest' — which spouse anchors retirement
var baseline = null;         // snapshot when user clicks "Lock as baseline"
var chartCapital = null;
var chartBreakdown = null;
var eventsStore = [];        // [{ id, age, amount, todaysMoney, kind }]
var eventSeq = 1;
```

### 3. Events store

`newEvent()` produces a sensible default (inflow, age = reference + 10 years, R500k PV). `renderEvents()` paints the DOM from `eventsStore`. Event delegation on `#events-list` handles input/change/delete via `onEventInput` and `onEventClick`. `readEvents()` returns a sanitised list for the projection.

The events list re-renders only the year label on each input change, not the whole list — otherwise typing in the amount field would lose focus every keystroke.

### 4. `project(inputs)` — the core function

Takes an inputs dict, returns a result object with per-year series. Always called with fresh inputs on every `refresh()`.

The loop iterates `y = 1` through `years` (where `years = retirement_age − reference_spouse_age`, with a minimum of 1).

Each iteration:

1. 12 monthly compoundings: `retA = retA × (1 + rMonth) + contribRetA`, same for retB, discA, discB.
2. Escalate all four monthly contributions by the annual escalation rate for next year.
3. Apply any events scheduled at this year's end (inflow → proportional add to disc; outflow → proportional remove from disc, capped at available).
4. Push all four per-spouse balances, household totals, cumulative contributions, and the starting-balance-compounded tracker to the series.

The starting-balance tracker is a separate scalar that compounds at `rMonth` with no contributions. Used for the growth-breakdown decomposition.

### 5. Rendering functions

Each pulls from the `project()` result and updates the DOM:

- `updateAnchorRow(p)` — horizon years + retirement calendar year
- `updateSummary(p)` — three summary cards
- `updateDelta(p)` — the delta bar when baseline is locked (hidden otherwise)
- `updateHeaderChips()` — summary chips on collapsible headers
- `buildCapitalChart(p)` — stacked bar chart (retirement + disc), with optional baseline line
- `buildBreakdownChart(p)` — stacked bar chart (starting-compounded + contribs + growth)
- `buildYearTable(p)` — HTML table with sticky year column
- `updatePrintSummary(p)` — all the print-only tables

All are idempotent. `refresh()` calls them in sequence.

### 6. `refresh()`

The main update loop. Called on any input change. Sequence:

```js
updateSliderLabels();
var inputs = readInputs();
var p = project(inputs);
updateAnchorRow(p);
updateSummary(p);
updateDelta(p);
updateHeaderChips();
if (chartView === 'capital') buildCapitalChart(p);
else if (chartView === 'breakdown') buildBreakdownChart(p);
else if (chartView === 'table') buildYearTable(p);
updatePrintSummary(p);
```

### 7. Baseline lock

`lockBaseline()` captures a full snapshot of the current `{ inputs, project-result, monthlyIncomeReal, finalTotalReal }`. `clearBaseline()` resets to null. When `baseline` is non-null, the delta bar renders, the chart shows a dashed baseline line, and the print summary adds a "Comparison to baseline" section.

**Hard freeze semantics**: the baseline includes return and CPI assumptions, so changing them after lock moves the planned line but not the baseline line. This was a deliberate decision — a "lock" that doesn't lock everything would be confusing in a meeting.

### 8. Collapsible sections

`toggleCollapse(headerId, bodyId)` animates max-height transitions. Opening a collapsed section is slightly tricky: you can't transition to `max-height: auto`, so the function sets `max-height: <scrollHeight>` and then clears it after the transition ends to avoid capping legitimate height growth later.

### 9. Event wiring

At the end: slider listeners, text-input listeners with blur-to-format, toggle listeners, view switcher, baseline lock, add-event button, section collapse listeners. Everything ends by calling `refresh()`.

## Data flow on a user interaction

1. User moves a slider or changes an input.
2. `input` listener fires → `refresh()`.
3. `project()` re-reads all inputs and re-runs the full year loop.
4. Rendering functions pull from the fresh `p` object.
5. Chart.js `update('none')` call (if chart exists) or a fresh chart is built.

There is no caching, no debouncing, no animation. The whole projection re-runs in a few milliseconds; for a 25–35 year horizon it's imperceptible.

## Things worth knowing

- `updatePrintSummary(p)` needs `p`; don't call it with a stale projection. `refresh()` always produces a fresh `p` and passes it through.
- The `baseline.p` object is a full projection snapshot. Chart access is `baseline.p.real.total` or `baseline.p.nominal.total`.
- Chart.js dataset visibility for the baseline line is toggled by pushing/removing the dataset entirely on each rebuild, not by `hidden: true`. Simpler and avoids colour-assignment drift.
- The collapsible-body's `max-height` inline style is manipulated by `toggleCollapse`; don't override it from elsewhere.
- Event IDs are prefixed `ev-N` where N is a monotonically incrementing counter. Don't rely on N — treat them as opaque.
- Events are applied at the END of each year, AFTER growth and contributions for that year. This means a year-5 event lands on a balance that has already grown 5 times and received 5 years of contributions.

## What not to add

- **State management libraries.** Global mutable state with `refresh()` is fine for a single-page tool.
- **Component frameworks.** Rendering is under 200 lines total.
- **Async/promises.** Nothing here is async. Keep it that way.
- **TypeScript.** Would fight the no-build rule.
- **Persistence.** Calculator is session-only by design. Anything that needs to persist goes to the CRM.
