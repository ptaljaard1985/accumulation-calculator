# Architecture

This document describes the internal structure of `retirement_accumulation.html`. Read this if you're about to modify the code. Math and conventions are in `CALCULATIONS.md`; visual choices are in `DESIGN.md`.

## The one-file principle

Everything lives in one HTML file. The `<head>` holds two `<link>` tags (Google Fonts preconnect + stylesheet) and a `<style>` block with design tokens + ~1100 lines of component CSS. The `<body>` holds the page structure. A single `<script>` block at the bottom holds all the logic.

There is no module system, no build, no bundler. The cost is that the file is ~3,300 lines. The benefit is that anyone can open it, edit it, and understand it without any tooling. Pierre uses it in meetings and sometimes emails it to clients. Breaking the single-file property breaks the product.

External runtime dependencies:

- Chart.js 4.4.1 from `cdnjs.cloudflare.com` (charts).
- Fraunces / Inter Tight / JetBrains Mono from `fonts.googleapis.com` (typography).

Both fail gracefully offline — the page computes without Chart.js (you just see the canvases blank) and renders in system fallback fonts without the webfont CSS.

## Three states, one tree

The root `<div class="calc" data-view="empty|filled|compare" id="calc-root">` wraps every state. Nodes that belong to a specific state carry `data-view-only="empty|filled|compare"` (or `"filled+compare"` for the shared plan-bar). `updateViewVisibility()` runs on every `refresh()`: it reads `deriveViewState()`, writes `data-view` on the root, and sets `display` on every `[data-view-only]` node accordingly.

`deriveViewState()` logic:

```js
if (baseline) return 'compare';
if (projectionRequested) return 'filled';
return 'empty';
```

`projectionRequested` is a module-scoped boolean that starts false and flips to true when the adviser clicks the `#btn-see-projection` CTA at the bottom of State 1. Once set, it stays true for the rest of the session — clearing a baseline returns the view to State 2, not back to State 1. A fresh page load always lands on `empty`; the transition is user-initiated, not data-driven. Typing names/balances into the State 1 fields does NOT transition — the sync-to handlers still run and populate the canonical inputs, but the view stays put until the button is clicked.

## Top-to-bottom page structure

```
<div class="page">
  <div class="calc" data-view="filled" id="calc-root">

    <!-- Hidden canonical meta fields (print summary uses these) -->
    <input type="hidden" id="client-name">
    <input type="hidden" id="client-date">
    <input type="hidden" id="adviser-name">

    <!-- STATE 1 · Empty title plate -->
    <section class="canvas-empty" data-view-only="empty">
      ... title plate, two-column spouse setup, foot band, dashed preview ...
    </section>

    <!-- STATE 2 & 3 shared · Plan-inputs bar -->
    <div class="plan-bar" data-view-only="filled+compare" data-open="false">
      <div class="plan-bar-row">
        logo + client name + 5 fact cells + Edit plan toggle
      </div>
      <div class="plan-bar-drawer">
        col I: household (both spouses with editable names + ages + 4 fields)
        col II: retirement (anchor row + retire-age) + capital events
        col III: market assumptions (3 thin sliders) + meeting (client-name + date edit fields)
      </div>
    </div>

    <!-- STATE 2 canvas head -->
    <div class="canvas-head" data-view-only="filled">
      eyebrow + serif headline "At 65, R ___ a month — comfortably" + sub
      + Real/Nominal toggle + Lock as baseline button
    </div>

    <!-- STATE 3 canvas head (compact) -->
    <div class="canvas-head compact" data-view-only="compare">
      eyebrow + one-line headline
      + Real/Nominal toggle + Clear baseline + Re-lock
    </div>

    <!-- STATE 2 body -->
    <div data-view-only="filled">
      <div class="chart-card">
        legend + Capital/Breakdown/Table seg + #chart-capital / #chart-breakdown / #year-table
      </div>
      <div class="outcome-strip">
        primary (Monthly income) + Household capital + Years to retirement
      </div>
      <section class="narrative">gold rule + "In plain terms"</section>
      <div class="canvas-foot">illustrative line + Table view + Print/PDF</div>
    </div>

    <!-- STATE 3 body -->
    <div data-view-only="compare">
      <div class="compare big">
        <div class="compare-card baseline">
          hero number (muted) + #chart-compare-baseline (faded) + meta rows
        </div>
        <div class="compare-card scenario">
          hero number (navy) + delta chip + #chart-compare-scenario + meta rows
        </div>
      </div>
      <div class="compare-legend">retirement fund · discretionary</div>
      <div class="scenario-levers">4-column slider grid</div>
      <div class="canvas-foot">illustrative line + Print/PDF</div>
    </div>

    <!-- Compliance appendix — same for all states -->
    <div class="print-summary">
      <details class="accordion" data-accordion="tables">Detail tables ...</details>
      <details class="accordion" data-accordion="methodology">Methodology ...</details>
      <details class="accordion" data-accordion="disclaimer">Disclaimer ...</details>
    </div>

    <div class="footer-meta">Simple Wealth · Retirement Accumulation · {date}</div>
  </div>
</div>
```

## The JS, bottom to top

The `<script>` block contains one IIFE. Inside it, in roughly this order:

### 1. Formatting helpers

`fmtR(n)` — rand strings with space thousand separators (`R6 000 000`). `fmtShort(n)` — abbreviated (`R4.3m` / `R450k`) for axis labels, tooltips, and now the outcome-strip capital + headline sub-line. `fmtPct`, `parseCurrency`, `parseAge`, `set(id, value)`, `read(id)` — pure utilities.

### 2. State variables

```js
var mode = 'pv';             // 'pv' | 'fv' — real vs nominal display (internal name kept for JS-test stability)
var chartView = 'capital';   // 'capital' | 'breakdown' | 'table'
var anchor = 'youngest';     // 'youngest' | 'oldest'
var baseline = null;         // { inputs, p, monthlyIncomeReal, finalTotalReal } snapshot when locked
var chartCapital = null;
var chartBreakdown = null;
var chartCompareBaseline = null;
var chartCompareScenario = null;
var lastProjection = null;   // most recent project() result
var eventsStore = [];        // [{ id, age, amount, todaysMoney, kind }]
var eventSeq = 1;
var spouseNames = { A: 'Spouse A', B: 'Spouse B' };
var projectionRequested = false; // one-way gate: State 1 → State 2 on CTA click
var scenarioAnchors = null;  // captured from baseline.inputs on lock; drives the scenario levers
```

### 3. Events store

`newEvent()` produces a default (inflow, age = reference + 10, R500k PV). `renderEvents()` paints the DOM — the new markup uses a 4-column grid (kind · age · amount+basis+year · delete) rather than the old 6-column one. Event delegation on `#events-list` handles input/change/delete. `readEvents()` returns the sanitised list.

### 4. `project(inputs)` — the core function

**Unchanged from Session 3.** Takes an inputs dict, returns a result object with per-year series. Always called with fresh inputs on every `refresh()`. Math details live in `CALCULATIONS.md`. The shape of its return value is the stable contract consumed by every rendering function.

### 5. Rendering functions

Each pulls from the `project()` result and updates the DOM:

- `updateSummary(p)` — outcome strip (Monthly income · Household capital · Years to retirement) plus the State 2 headline numbers (`#headline-age`, `#headline-income`, `#headline-capital`). Unconditional — no baseline-delta logic here anymore.
- `updatePlanBar(p)` — populates the 5 plan-bar fact cells (`#fact-household`, `#fact-capital`, `#fact-contrib`, `#fact-retage`, `#fact-market`), the drawer meta labels (household completion, retire-at, market-summary, events count), the events helper's ref-spouse name, and the plan-bar "Prepared for" line (with placeholder styling when the client-name field is empty).
- `updateViewVisibility()` — computes `deriveViewState()`, writes `data-view` on the root, toggles display on every `[data-view-only]` node. Called first in every `refresh()` so chart builds see correct visibility.
- `buildCapitalChart(p)` — State 2 capital chart. Gold discretionary on bottom, navy retirement on top. No baseline-overlay line (State 3 replaces that entire idea).
- `buildBreakdownChart(p)` — three-layer stacked bars (greys + gold).
- `buildYearTable(p)` — HTML table inside the chart-card slot, sticky year column.
- `buildCompareCharts(p)` → `ensureCompareChart(...)` — State 3's two independent Chart.js instances. Both share the same y-ceiling (`max(baseline.total, scenario.total) × 1.05`) so bars line up visually. Baseline chart renders at 0.35 opacity (alpha applied to the rgba fills, not via a CSS filter — filter would wreck Chart.js hover).
- `updateCompareCards(p)` — populates the hero numbers, sub-lines, meta rows, and the delta chip on the scenario card. `setMetaDelta(id, delta, kind)` writes the inline `em` deltas beside changed meta values.
- `updatePrintSummary(p)` — all the compliance-appendix tables. Unchanged from earlier sessions.
- `updateNarrative(p)` — the "In plain terms" card. Two layouts: no baseline → CURRENT POSITION; baseline locked → BASELINE POSITION + PLANNED SCENARIO. In State 3 the narrative is hidden by `data-view-only="filled"` so these writes go to invisible DOM, which is fine.
- `renderSpouseLabels()` — walks `[data-spouse]` nodes and rewrites their text from `spouseNames`. Templates currently supported: `header`, `summary-pos`, `summary-contrib`, `chip` (chip renders just the name, used by the State 1 retire-when row).
- `updateAnchorChips()` — toggles `.is-on` on the two State 1 `.empty-name-chip` buttons from the current `anchor` rule plus the current ages (ties break to A, matching `resolveYoungerOlder`). Called once per `refresh()` next to `renderSpouseLabels()`, so chip selection stays correct regardless of whether the user clicked a chip, used the drawer Youngest/Oldest toggle, or changed an age field.
- `updateBaselineControls()` — now a hook (kept for future use). Button visibility is driven by `data-view-only` on the two canvas-heads, so it has no work to do.

### 6. `refresh()`

The main update loop. Called on any input change. Sequence:

```js
updateSliderLabels();
var inputs = readInputs();
var p = project(inputs);
lastProjection = p;
updateSummary(p);
updatePlanBar(p);
updateViewVisibility();
if (!baseline) {
  if (chartView === 'capital') buildCapitalChart(p);
  else if (chartView === 'breakdown') buildBreakdownChart(p);
  else if (chartView === 'table') buildYearTable(p);
} else {
  buildCompareCharts(p);
}
updateCompareCards(p);
updatePrintSummary(p);
updateNarrative(p);
renderSpouseLabels();
updateAnchorChips();
updateScenarioReadouts();
```

The chart branch is skipped for the view that isn't active — main charts only build in State 2, compare charts only build in State 3. This avoids Chart.js measuring a `display:none` parent and painting a blank bitmap.

### 7. Baseline lock

`lockBaseline()` captures `{ inputs, p, monthlyIncomeReal, finalTotalReal }` AND captures scenario anchors. `clearBaseline()` resets both. The two compare Chart.js instances persist across lock/clear cycles — re-locking just updates their data and animates.

**Hard freeze semantics**: the baseline includes return and CPI assumptions. Changing them after lock moves the planned line but not the baseline line. Deliberate — a "lock" that doesn't lock everything would be confusing in a meeting.

### 8. Scenario sliders (levers panel)

Logic from Session 3, range-widened in Session 7. `captureScenarioAnchors()` on lock. `configureScenarioSliders()` sets each slider's range:

- **Contributions** (retirement + discretionary): `±R30 000` around the anchor, floor-clamped at R0. Step R500.
- **Expected return**: fixed **0% → 15%** scale, independent of anchor. Step 0.5pp. The canonical `#return` drawer input now accepts `min=0` to match, so `applyScenarioReturn`'s clamp to `#return.min`/`#return.max` no longer produces a dead zone at the low end.
- **Retirement age**: `±10 years` around the anchor, clamped to the `#retirement-age` input's own 50–75 bounds. Step 1y.

Moving a slider invokes `applyScenarioContrib('ret'|'disc')`, `applyScenarioReturn()`, or `applyScenarioRetAge()`, which write back into the underlying household / return / retirement-age inputs and kick `refresh()`. Contribution deltas split proportionally between spouses by baseline share.

`updateScenarioReadouts()` re-reads the current underlying inputs on every `refresh()` and syncs each slider's thumb + delta pill. The return slider's readout also carries an inline `· baseline X.XX%` annotation since its fixed scale means the anchor is no longer at centre — this is a special case inside `setScenarioReadout`'s `kind === 'percent'` branch (the only call site in scenario-readouts).

### 9. State 1 → canonical input sync

Empty-state fields carry `data-sync-to="hp-ret-A"` etc. — on blur, their value (cleaned of non-digit chars) is written into the canonical drawer input, which fires its own `input` + `blur` events so the normal refresh pipeline kicks in. Spouse first-name inputs carry `data-sync-spouse-name="A"` and write into `spouseNames` directly.

The family-name editable span (`#family-name`) is a `contenteditable` in the title plate. On focus, the placeholder class is stripped. On blur, if empty it reverts to the placeholder; otherwise it writes the trimmed text into the hidden `#client-name` (stripping a leading "the " and trailing " family" if present) and mirrors into the drawer's `#client-name-edit`.

State 1 also hosts three "shadow" sliders (`#empty-return`, `#empty-cpi`, `#empty-esc`) that mirror the canonical `#return` / `#cpi` / `#esc` inputs. For range elements with `data-sync-to`, a second sync branch listens on `input` (not `blur`) and pipes the live value into the canonical input + dispatches `input` on the target — the canonical listener then fires `refresh()`. `updateSliderLabels()` writes the formatted percent into both the drawer readouts (`#return-out` / `#cpi-out` / `#esc-out`) AND the State 1 readouts (`#empty-return-out` / `#empty-cpi-out` / `#empty-esc-out`), and sets the shadow-thumb positions from the canonical values *unless* the shadow slider is currently focused (prevents a feedback fight while dragging).

The two State 1 retire-when chips (`.empty-name-chip`) click-to-anchor. On click, the handler reads the current ages, determines whether the clicked spouse is younger-or-equal to the other, and calls `setAnchor('youngest')` or `setAnchor('oldest')` accordingly — delegating to the shared path the drawer Youngest/Oldest toggle already uses. `updateAnchorChips()` (called from `refresh()`) keeps the `.is-on` class in sync regardless of which surface drove the anchor change.

### 10. Drawer toggle

A small IIFE at the bottom wires `#btn-edit-plan` to toggle `data-open` on the plan-bar. The CSS rule `.plan-bar[data-open="true"] .plan-bar-drawer { display: grid; }` does the rest. No animation — the drawer appears/vanishes instantly.

### 11. Chart resize (print)

`resizeChartsToWrap()` now iterates three chart containers: the main `.chart-wrap`, `#chart-compare-baseline`'s parent, and `#chart-compare-scenario`'s parent. For each, it reads `clientWidth`/`clientHeight` and calls `chart.resize(w, h)` with explicit dimensions — inside `requestAnimationFrame` so the browser has flushed the `@media print` layout before Chart.js measures. Null-safe on every chart variable (they can be null in the state that's not active).

Called by the `beforeprint` / `afterprint` / `matchMedia('print') change` handlers. The matchMedia path is what catches headless `--print-to-pdf` flows, which do not fire `beforeprint`.

### 12. Event wiring

At the bottom: input listeners on all household fields, age inputs, retirement-age; slider listeners; scenario-slider listeners; `data-sync-to` blur handlers; `data-sync-spouse-name` blur handlers; drawer toggle; anchor buttons; view switcher (`btn-view-capital/breakdown/table`); mode toggles (both `#btn-pv/fv` and `#btn-pv-cmp/fv-cmp` wired to the same `setMode`); Lock / Re-lock / Clear baseline; Add event. Everything ends by calling `refresh()`.

## Data flow on a user interaction

1. User moves a slider or changes an input.
2. `input` listener fires → `refresh()`.
3. `project()` re-reads all inputs and re-runs the full year loop.
4. `updatePlanBar` + `updateViewVisibility` run before any chart build.
5. Rendering functions pull from the fresh `p` object.
6. Chart.js `update('none')` call (if chart exists) or a fresh chart is built.

No caching, no debouncing, no animation.

## Things worth knowing

- `updatePrintSummary(p)` needs `p`; don't call it with a stale projection. `refresh()` always produces a fresh `p` and passes it through.
- `baseline.p` is a full projection snapshot. Chart access is `baseline.p.real.total` or `baseline.p.nominal.total`.
- Compare Chart.js instances persist across lock/clear cycles — `ensureCompareChart` updates in place when the chart already exists.
- Empty-state input sync is one-way (State 1 → canonical). There's no reverse — if the user somehow lands back in State 1 after entering data, the State 1 fields won't pre-populate. Not a real flow today.
- The hidden `#client-name`/`#client-date`/`#adviser-name` inputs are the source of truth for the print-summary appendix. The drawer's `-edit` fields and the title-plate family-name span both write into them.
- Both the `#btn-pv`/`#btn-fv` pair (State 2) and `#btn-pv-cmp`/`#btn-fv-cmp` pair (State 3) exist in the DOM simultaneously but only one is visible via `data-view-only`. `setMode` updates class state on all four so the toggles stay in sync.
- Internal state variable `mode` is kept at `'pv'` / `'fv'` rather than the spec's `'real'` / `'nominal'` — the JS test harness extracts and exercises this variable by name.

## What not to add

- **State management libraries.** Global mutable state with `refresh()` is fine for a single-page tool.
- **Component frameworks.** Rendering is under 300 lines total.
- **Async/promises.** Nothing here is async. Keep it that way.
- **TypeScript.** Would fight the no-build rule.
- **Persistence.** Calculator is session-only by design. Anything that needs to persist goes to the CRM.
- **A fourth view state.** Three is the contract. If a new flow is needed, fold it into one of the existing three.
