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
        logo + client name + 5 fact cells + Save plan + Open plan + Export report + Edit plan toggle
      </div>
      <div class="plan-bar-drawer">
        col I: household (both spouses with editable names + ages + 4 fields)
        col II: retirement (anchor row + retire-age) + capital events
        col III: market assumptions (3 thin sliders) + meeting (client-name + date edit fields)
      </div>
    </div>

    <!-- STATE 2 canvas head -->
    <div class="canvas-head" data-view-only="filled">
      eyebrow + serif headline "Retirement plan" + factual sub-line
      ("[Name] retires at age 65 with R ___ per month starting retirement
      income, in today's money.") + Real/Nominal toggle + Lock as baseline
    </div>

    <!-- STATE 3 canvas head (compact) -->
    <div class="canvas-head compact" data-view-only="compare">
      eyebrow + serif headline "Compare scenarios"
      + sub-line "Baseline locked. Move the levers below to test alternatives."
      + Real/Nominal toggle + Clear baseline + Re-lock
    </div>

    <!-- STATE 2 body -->
    <div data-view-only="filled">
      <div class="chart-card">
        legend + Income/Capital/Breakdown/Table seg + #chart-income / #chart-capital / #chart-breakdown / #year-table
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

    <!-- Compliance appendix — same for all states. On screen it collapses to
         ONE outer accordion (Session 16); the three sub-accordions live inside
         its body. Print forces every details.accordion open and flattens them. -->
    <div class="print-summary">
     <details class="accordion appendix-toggle" id="appendix-toggle">
      <summary>Methodology & disclaimer</summary>
      <div class="accordion-body">
        <h2>Summary of assumptions and outcome</h2>
        <details class="accordion" data-accordion="tables">Detail tables ...</details>
        <details class="accordion" data-accordion="methodology">Methodology ...</details>
        <details class="accordion" data-accordion="disclaimer">Disclaimer ...</details>
      </div>
     </details>
    </div>

    <!-- Export deck — hidden on screen + portrait-print; shown when
         startExport() sets data-export-mode on #calc-root. 12 pages,
         2 conditional (events, compare). See §13 for details. -->
    <section class="export-deck">
      <section class="export-page" data-export-page="cover">...</section>
      <section class="export-page" data-export-page="answer">...</section>
      ... 10 more pages ...
    </section>

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
var chartView = 'income';    // 'income' | 'capital' | 'breakdown' | 'table' (Income is the default first view)
var anchor = 'youngest';     // 'youngest' | 'oldest'
var baseline = null;         // { inputs, p, monthlyIncomeReal, finalTotalReal } snapshot when locked
var chartIncome = null;
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

`newEvent()` produces a default (inflow, age = reference + 10, R500k PV). `renderEvents()` paints the DOM — the markup uses a 4-column grid (kind · age · amount+basis+year · delete). It iterates TWO container IDs (`events-list` in the drawer, `empty-events-list` in State 1), painting the same rows into both from the same `eventsStore`. Event delegation is attached once per container (guarded by `dataset.wired`) so edits from either surface mutate the same state. `readEvents()` returns the sanitised list.

Cross-container sync: `onEventInput` updates the year-label inline in the container the user is typing in (preserving focus); it does NOT touch the other container, since only one of the two is visible at a time (State 1 vs States 2/3 via `data-view-only`). When the adviser clicks the `#btn-see-projection` CTA, the handler calls `renderEvents()` before `refresh()`, so the drawer (about to become visible in State 2) picks up any events added/edited in State 1.

The helper-prose span ("Ages anchored to {name}'s age.") uses `class="events-ref-spouse"` on both drawer and State 1 copies. `renderSpouseLabels()` and `updatePlanBar(p)` both update via `querySelectorAll('.events-ref-spouse')`.

### 4. `project(inputs)` — the core function

**Unchanged from Session 3.** Takes an inputs dict, returns a result object with per-year series. Always called with fresh inputs on every `refresh()`. Math details live in `CALCULATIONS.md`. The shape of its return value is the stable contract consumed by every rendering function.

`readInputs()` gathers every canonical input in one dict — ages, balances, contributions, `rNom` / `cpi` / `esc`, `anchor`, `retirementAge`, `incomeGoal` (monthly rand target in today's money, rendering-only — `project()` does not consume it), and `events`.

**Client-input defaults + clamps (Session 11).** Spouse ages, retirement age, the four balance inputs, and the four monthly contribution inputs ship with **no HTML `value=""` defaults and no `min`/`max`/`step` constraints** — they render blank with a `placeholder="—"` until the adviser types. `parseAge(id, fallback)` is now a straight `isFinite(n) ? n : fallback` with no 18/64 clamp; every call site still passes `40` as the fallback, which is an internal NaN backstop (invisible because the HTML input is blank). The retirement-age block in `readInputs()` reads the raw integer and falls back to 65 only when the field is truly blank — no 50/75 clamp. The `retirement-age` blur handler calls `refresh()` directly (previously it was snapping values back into 50-75). Market assumption defaults (5% return / 5% CPI / 5% escalation) and the `project()` horizon-minimum (`years = max(1, retirementAge − refAge)`) are unchanged.

**`data-goal-active` hide pattern.** Any surface that displays goal-progress (outcome-strip sub-line, compare-card meta row, plan-bar fact cell, print-summary row, export-deck answer slot) carries `data-goal-active="false"` in the markup. A single CSS rule `[data-goal-active="false"] { display: none !important; }` collapses them all. Renderers flip the attribute via the shared `setGoalActive(id, bool)` helper, driven by `computeGoalProgress(p)` which returns `null` when the goal is blank or zero.

### 5. Rendering functions

Each pulls from the `project()` result and updates the DOM:

- `updateSummary(p)` — outcome strip (Monthly income · Household capital · Years to retirement) plus the State 2 sub-line (`#headline-age` and the `#headline-anchor-name` reference-spouse span — Session 16 trimmed the income figure out of the sub-line, so `#headline-income` no longer exists), and the goal-progress sub-line (`#sum-income-goal`) inside the primary cell when `incomeGoal > 0`. The State 2 `<h1>` is static ("Retirement plan"). The income and capital numbers are rendered only in the outcome strip (`#sum-income` / `#sum-capital`), the single loud source.
- `updatePlanBar(p)` — populates the 5 core plan-bar fact cells plus the 6th **Income goal** cell (`#fact-goal-cell` / `#fact-goal`), the drawer meta labels (household completion, retire-at, market-summary, events count, goal), the events helper's ref-spouse name, and the plan-bar "Prepared for" line.
- `updateViewVisibility()` — computes `deriveViewState()`, writes `data-view` on the root, toggles display on every `[data-view-only]` node. Called first in every `refresh()` so chart builds see correct visibility.
- `swrForAge(age)` — age-based safe withdrawal rate (decimal fraction), replacing the former flat 5% income rule (Session 13). Table (held inside the function so the Node harness extracts it alongside `project`) covers ages 55-100; below 55 drops 0.1pp/yr from 4.2% floored at 3.5%; above 100 held at 25%. `fmtSwr(age)` formats it as a one-decimal percent for labels. Used by `project()` (headline `monthlyIncomeReal = finalTotalReal * swrForAge(refAge + years) / 12`), `incomeCurveData` (per candidate age), and the income display surfaces.
- `incomeCurveData(inputs, extraYears)` — pure helper for the Income view. Clones `inputs`, sets `retirementAge` to `retirementAge + extraYears` (optional, **default 10**; the gap solver passes `20`), runs `project()` once, and returns `{ ages, incomeReal, markerIndex, markerAge }` where `incomeReal[i] = real.total[i] * swrForAge(ages[i]) / 12` (today's-money starting income if retiring at year `i`, using that age's SWR) and `markerIndex = retirementAge − refAge`. Because `project()` positions are independent of horizon length and the marker age equals the reference age there, `incomeReal[markerIndex]` equals the base run's `monthlyIncomeReal` exactly. Pure (given `project`), so the Node test harness extracts and exercises it directly.
- `bumpContribs(inputs, deltaTotal)` / `marginalIncomePer1000(inputs)` / `solveGapRoutes(inputs)` — pure helpers for the closing-the-gap card (live next to `incomeCurveData`, so the Node harness extracts them). `bumpContribs` raises total monthly contribution by `deltaTotal` while preserving the household split (even split when the base total is 0). `marginalIncomePer1000` is the income added per extra R1 000/month (two `project()` runs). `solveGapRoutes` returns `null` (no goal / goal met / degenerate horizon) or `{ shortfall, contribPerMonth, contribReachable, retAge, retYears, retReachable }`: the contribution route is closed-form off the affine slope (rounded up to R100); the retire-later route scans `incomeCurveData(inputs, 20)` for the first age past the planned retirement age that clears the goal. Math in `CALCULATIONS.md` ("Closing the gap").
- `updateGapSolver(p)` — renders the "Closing the gap" card (a `.narrative`-shelled section between the outcome strip and the narrative, State 2 only). Shows the contribution-leverage line whenever the horizon is valid (eyebrow "Contribution leverage"); when a goal is set and there is a shortfall it switches the eyebrow to "Closing the gap" and adds the two route rows. Uses `setGoalActive` (the generic `data-goal-active` hide flag) to collapse the whole card on a degenerate horizon and to toggle the routes block. Copy is em-dash-free (a JS test scans the function body).
- `buildIncomeCurveChart(p)` — State 2 **Income** chart (the default first view). A single `type: 'line'` dataset (navy line, faint navy fill) of `incomeCurveData(p.inputs).incomeReal` vs candidate age. **Always real** — ignores `mode` (nominal future-rand income at a future age is misleading). The dashed vertical "planned retirement age" marker is drawn by `retAgeMarkerPlugin`, a chart-local inline plugin (a plain hook object in the config's `plugins: [...]` array — NOT chartjs-plugin-annotation) reading `chart.$markerIndex` / `chart.$markerAge` in `afterDatasetsDraw`. On first build it calls `chartIncome.update('none')` so the marker paints (the initial `new Chart` draw runs before the marker props are set).
- `buildCapitalChart(p)` — State 2 capital chart. Gold discretionary on bottom, navy retirement on top. No baseline-overlay line (State 3 replaces that entire idea).
- `buildBreakdownChart(p)` — three-layer stacked bars (greys + gold).
- `buildYearTable(p)` — HTML table inside the chart-card slot, sticky year column.
- `buildCompareCharts(p)` → `ensureCompareChart(...)` — State 3's two independent Chart.js instances. Both share the same y-ceiling (`max(baseline.total, scenario.total) × 1.05`) so bars line up visually. Baseline chart renders at 0.35 opacity (alpha applied to the rgba fills, not via a CSS filter — filter would wreck Chart.js hover).
- `updateCompareCards(p)` — populates the hero numbers, sub-lines, meta rows, and the delta chip on the scenario card. `setMetaDelta(id, delta, kind)` writes the inline `em` deltas beside changed meta values; `kind` supports `currency`, `pct`, `years`, and `pp` (percentage-point delta used by the goal-progress row). A fifth meta-row on each card (`#cmp-baseline-goal-row` / `#cmp-scenario-goal-row`) renders `Goal progress · N% of R X` when the adviser-level `incomeGoal` is set; both cards read against the same current goal, not a baseline-frozen snapshot. The N% is wrapped in a `goal-progress-on-track` (green) or `goal-progress-behind` (red) span so the traffic-light tone matches the outcome strip.
- `updatePrintSummary(p)` — compliance-appendix tables plus the conditional goal row (`#s-goal-row`) gated on `computeGoalProgress(p)`. The print cell wraps the % in the same `goal-progress-*` class span so printed PDFs carry the green/red signal.
- `updateNarrative(p)` — the "In plain terms" card. Two layouts: no baseline → CURRENT POSITION; baseline locked → BASELINE POSITION + PLANNED SCENARIO. In State 3 the narrative is hidden by `data-view-only="filled"` so these writes go to invisible DOM, which is fine. Session 16 shortened `describeCurrentPosition(p)` to a single em-dash-free sentence ("Projected R x a month in today's money, before tax[, covering y% of the R z monthly goal]") with the goal clause appended only when `incomeGoal > 0` — the outcome strip, gap card, and plan-bar already carry the numbers. `describeBaselinePosition` / `describePlannedScenario` (State 3, still multi-sentence) are unchanged and still use `eventsSentence`. The former `goalSentence` helper was removed when the short narrative dropped its only caller.
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
updateGapSolver(p);
updatePlanBar(p);
updateViewVisibility();
if (!baseline) {
  if (chartView === 'income') buildIncomeCurveChart(p);
  else if (chartView === 'capital') buildCapitalChart(p);
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
- **Retirement age**: `±10 years` around the anchor. Step 1y. Session 11 removed the `#retirement-age` input's 50/75 bounds, so the lever now spans `anchor ± 10` without clipping (previously `Math.max(50, …)` / `Math.min(75, …)` collapsed the range when the locked retirement age sat near an old limit). `applyScenarioRetAge()` no longer clamps the written-back value for the same reason.

Moving a slider invokes `applyScenarioContrib('ret'|'disc')`, `applyScenarioReturn()`, or `applyScenarioRetAge()`, which write back into the underlying household / return / retirement-age inputs and kick `refresh()`. Contribution deltas split proportionally between spouses by baseline share.

`updateScenarioReadouts()` re-reads the current underlying inputs on every `refresh()` and syncs each slider's thumb + delta pill. The return slider's readout also carries an inline `· baseline X.XX%` annotation since its fixed scale means the anchor is no longer at centre — this is a special case inside `setScenarioReadout`'s `kind === 'percent'` branch (the only call site in scenario-readouts).

### 9. State 1 → canonical input sync

Empty-state fields carry `data-sync-to="hp-ret-A"` etc. — on blur, their value (cleaned of non-digit chars) is written into the canonical drawer input, which fires its own `input` + `blur` events so the normal refresh pipeline kicks in. Spouse first-name inputs carry `data-sync-spouse-name="A"` and write into `spouseNames` directly.

The family-name editable span (`#family-name`) is a `contenteditable` in the title plate. On focus, the placeholder class is stripped. On blur, if empty it reverts to the placeholder; otherwise it writes the trimmed text into the hidden `#client-name` (stripping a leading "the " and trailing " family" if present) and mirrors into the drawer's `#client-name-edit`.

State 1 also hosts three "shadow" sliders (`#empty-return`, `#empty-cpi`, `#empty-esc`) that mirror the canonical `#return` / `#cpi` / `#esc` inputs. For range elements with `data-sync-to`, a second sync branch listens on `input` (not `blur`) and pipes the live value into the canonical input + dispatches `input` on the target — the canonical listener then fires `refresh()`. `updateSliderLabels()` writes the formatted percent into both the drawer readouts (`#return-out` / `#cpi-out` / `#esc-out`) AND the State 1 readouts (`#empty-return-out` / `#empty-cpi-out` / `#empty-esc-out`), and sets the shadow-thumb positions from the canonical values *unless* the shadow slider is currently focused (prevents a feedback fight while dragging).

The two State 1 retire-when chips (`.empty-name-chip`) click-to-anchor. On click, the handler reads the current ages, determines whether the clicked spouse is younger-or-equal to the other, and calls `setAnchor('youngest')` or `setAnchor('oldest')` accordingly — delegating to the shared path the drawer Youngest/Oldest toggle already uses. `updateAnchorChips()` (called from `refresh()`) keeps the `.is-on` class in sync regardless of which surface drove the anchor change.

**CTA gate (Session 11).** `updateSeeProjectionEnabled()` disables `#btn-see-projection` unless both `#hp-age-A` and `#hp-age-B` parse as finite integers. Wired once to the existing `input` listener on each age input (so State 1 shadow ages — which dispatch `input` on the canonical target via `data-sync-to` blur — and direct drawer edits both trigger it) and called once at init. No gate on retirement age, balances, or contributions: those can stay blank and the projection reads them as 0 (money fields) or 65 (retirement-age fallback in `readInputs`). CSS: `.empty-cta .btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }`.

### 10. Drawer toggle

A small IIFE at the bottom wires `#btn-edit-plan` to toggle `data-open` on the plan-bar. The CSS rule `.plan-bar[data-open="true"] .plan-bar-drawer { display: grid; }` does the rest. No animation — the drawer appears/vanishes instantly.

### 11. Chart resize (print)

`resizeChartsToWrap()` iterates three chart containers: the main `.chart-wrap` (holding `chartIncome`, `chartCapital`, `chartBreakdown`), `#chart-compare-baseline`'s parent, and `#chart-compare-scenario`'s parent. For each, it reads `clientWidth`/`clientHeight` and calls `chart.resize(w, h)` with explicit dimensions — inside `requestAnimationFrame` so the browser has flushed the `@media print` layout before Chart.js measures. Null-safe on every chart variable (they can be null in the state that's not active).

Called by the `beforeprint` / `afterprint` / `matchMedia('print') change` handlers. The matchMedia path is what catches headless `--print-to-pdf` flows, which do not fire `beforeprint`.

### 12. Event wiring

At the bottom: input listeners on all household fields, age inputs, retirement-age; slider listeners; scenario-slider listeners; `data-sync-to` blur handlers; `data-sync-spouse-name` blur handlers; drawer toggle; anchor buttons; view switcher (`btn-view-income/capital/breakdown/table`); mode toggles (both `#btn-pv/fv` and `#btn-pv-cmp/fv-cmp` wired to the same `setMode`); Lock / Re-lock / Clear baseline; Add event; **Export report** (`#btn-export-report` → `startExport()`); and a dev-only **Load sample data** button (`#btn-load-sample` → `loadSampleData()`, see below). Everything ends by calling `refresh()`.

**`loadSampleData()` (test scaffolding).** A convenience on the State-1 `.empty-cta`: populates a representative household and sets `projectionRequested = true` so one click lands in State 2, avoiding re-typing during testing. It writes the canonical inputs (via `setHpFormatted` for money, direct `.value` for ages/age/sliders), sets `spouseNames` + the family/client name, then calls `refresh()`. Not a product feature — hidden in print via `.empty-cta`; strip or gate it before a client-facing release.

### 13. Export deck (A4 landscape, 12 pages)

An opt-in print mode that turns the calculator into a 12-page client-facing deliverable. Triggered by `#btn-export-report` in the plan-bar. The deck never appears in the normal portrait print path (canvas-foot Print/PDF or plain Cmd+P) — it's fully gated on two flags that only `startExport()` sets.

**Gating model.** `startExport()` sets three things before calling `window.print()`:

1. `#calc-root[data-export-mode="true"]` — CSS rule hides every `#calc-root > :not(.export-deck)` and reveals `.export-deck`. This is the on-screen visibility swap.
2. `<html class="export-printing">` — used only to scope the `html.export-printing .export-page { ... }` print-size overrides.
3. A dynamically-injected `<style id="export-page-sheet">@page { size: A4 landscape; margin: 0; }</style>` in `<head>`. `@page` rules can't live inside selector scopes, so this is the only reliable way to change page size per print pass.

`afterprint` calls `teardownExport()`, which strips all three gates and destroys the export Chart.js instances. The existing portrait `@media print` rules at lines ~1143–1169 are unchanged and continue to win for non-export prints because none of these gates are set in that flow.

**The 12 pages** (in `<section class="export-deck">`, a direct sibling of `.print-summary`):

1. Cover — family name (derived by `deriveFamilyName()` from last whitespace token of `#client-name`), prepared-for, date, adviser (FSP 50637).
2. The Answer — eyebrow + Fraunces headline with `gold-under` accent on the monthly-income number + real capital stacked chart + three-cell outcome strip (primary cell also carries the `answer-goal` sub-line when the adviser has set an income goal). 6-row grid (topbar / eyebrow / headline / chart-card[1fr] / outcome-strip / foot); the narrative block was dropped in Session 10 because a 7-child grid was paginating across two physical sheets in Chrome print, leaving page 2 blank. The narrative is retained on the State 2 portrait print (working-copy PDF).
3. Household — two-column editorial grid (balances, contributions, combined total per spouse) divided by a 1px hairline.
4. Assumptions — two-column layout: 5-row editorial table (return / CPI / escalation / retirement trigger / safe withdrawal rate, the last bound to `a-drawrate`) + "Note to the household" aside.
5. Projection — nominal stacked chart, full-width + three-cell foot strip (starting / real final / nominal final).
6. Breakdown — two-column: 3-layer decomp chart + three slab cards (starting-compounded, cumulative contributions, growth on contributions), all in today's money.
7. Capital events — **conditional on `eventsStore.length > 0`**. Summary strip (count, inflow total, outflow total) + itemised list (kind badge, age, year, basis, amount). Out-of-horizon events are muted but still listed for completeness.
8. Compare — **conditional on `baseline !== null`**. Two side-by-side cards (baseline paper-2, scenario white with navy ring) with shared y-ceiling, gold delta chip on the scenario card, inline gold deltas on changed meta rows.
9. Year-by-year — full-width table: year 0, every 5th year, and the retirement row (highlighted in navy). Columns: year label, Age A, Age B, retirement (nominal), discretionary (nominal), total (nominal), total (real).
10. Methodology — two-column prose: how capital grows, PV conversion, the age-based safe withdrawal rate (dynamic `method-swr` bind), the three-part breakdown, capital events note (dynamic based on `eventsStore.length`), what the projection is not.
11. Compliance — two-column prose: not-advice disclaimer, FSP 50637 + POPIA, scope of document, risk/market assumptions, tax treatment (pre-tax), review cadence.
12. Next steps — closing page: "From projection to plan" eyebrow + `Let's turn this into your plan.` headline with gold-under + three cells (review / action / next review cadence) + branding foot.

**Conditional-page logic.** Pages 7 and 8 carry `data-export-page-active="false"` in the markup. `buildExportDeck()` toggles that attribute based on `eventsStore.length` and `baseline`. CSS: `.export-page[data-export-page-active="false"] { display: none; }` hides them both on screen and in print. `renumberExportPages()` walks visible `.export-page` nodes, assigns lowercase roman numerals (`i.` `ii.` ...) and `NN / TT` page counts, so the document always reads as a coherent sequence (10, 11, 11, or 12 pages depending on state).

**Dedicated export Chart.js instances.** Five new canvases (`export-chart-answer`, `export-chart-projection-nom`, `export-chart-breakdown`, `export-chart-compare-baseline`, `export-chart-compare-scenario`), held in module-scoped `exportCharts = { answer, proj, breakdown, cmpBase, cmpScen }`. Built in `buildExportCharts()` on button click against the (now visible, landscape-sized) DOM. Destroyed in `destroyExportCharts()` on `afterprint`. Chose dedicated canvases over reusing the screen charts because State 2/3 instances are sized for ~280–1000px card widths; landscape A4 content area is ~1588×1123px; `chart.resize()` on live screen instances is the fragile path that burned Sessions 2 and 3.

**Shared y-ceiling on compare charts.** `padSeries(series, targetLen)` extends the shorter baseline-year series with its last value so the two compare charts line up on the x-axis. The y-axis ceiling is `max(peak(baseReal.total), peak(planReal.total)) * 1.05` shared across both.

**JS entry points (all in the `Export deck` block in the script IIFE).**

- `startExport()` — guard on `lastProjection`, ensure `<style id="export-page-sheet">`, set gates, `buildExportDeck(...)`, `buildExportCharts(...)`, double-rAF → `window.print()`.
- `teardownExport()` — strip gates, remove `<style>`, `destroyExportCharts()`.
- `buildExportDeck(p, baseline, events, names)` — populates every `[data-bind="..."]` slot. Calls `populateEventsPage`, `populateComparePage`, `populateYearTable` for the three data-heavy pages, then `renumberExportPages()`.
- `buildExportCharts(p, baseline)` — 3 or 5 Chart.js instances depending on whether `baseline` is locked.
- `setBind(name, html)` / `setBindText(name, txt)` — bulk-assign innerHTML/textContent to every `[data-bind="name"]` node inside `.export-deck`.
- Helpers: `toRoman(n)`, `deriveFamilyName(full)`, `escapeHtml(s)`, `renumberExportPages()`, `padSeries`, `peak`, `fadedStackedDatasets`, `stackedDatasets`, `exportBarOptions`, `exportCompareOptions`, `setMetaWithDelta`, `ensureExportPageSheet`, `removeExportPageSheet`.

**Refresh integration.** `refresh()` does NOT touch the export deck. The deck is populated only on button click; otherwise it holds placeholder text (`R —`, `——`, etc.) that never reaches print. This keeps per-keystroke cost unchanged.

**Em-dash rule.** Static deck prose (methodology, compliance, next-steps, assumptions aside, events list header) is em-dash-free. Placeholder slots like `<span data-bind="compliance-date">——</span>` contain em-dashes but are guaranteed to be overwritten by `setBindText()` from an em-dash-free source before print. JS tests enforce the static-prose invariant with zone-scoped regexes that strip `data-bind` spans before scanning.

### 14. Save / Open plan (file-based persistence)

Lets the adviser save the current client's **inputs** to a `.json` file on disk and restore them later (accidental-refresh recovery; multi-client filing; drop the files in iCloud/Dropbox and the roster syncs for free). Buttons: **Save plan** + **Open plan** in the plan-bar nav (next to Export report), plus an **Open a saved plan** ghost button in the State 1 `.empty-cta` so a fresh page (where the plan-bar is hidden) can still restore.

**Safety property — opt-in restore only.** A plain page refresh always lands on the blank/default tool. Nothing is auto-rehydrated; restoring is an explicit Open click. There is **no** `localStorage`/`sessionStorage` — files are the transport precisely because loading one is a deliberate user action, which is what stops one client's numbers leaking into the next session. A JS test asserts the persistence layer never touches web storage. Each tab is its own sandbox (no shared state across tabs).

**The file stores INPUTS, not OUTPUTS.** The projection is re-derived on restore, so the file is small, portable, and forward-compatible with engine changes (e.g. the SWR schedule). Schema:

```json
{
  "schemaVersion": 1,
  "kind": "sw-accumulation-plan",
  "savedAt": "2026-06-03T10:30:00.000Z",
  "familyName": "Nkosi",
  "spouseNames": { "A": "Thabo", "B": "Amara" },
  "anchor": "youngest", "mode": "pv", "chartView": "income",
  "projectionRequested": true,
  "baselineInputs": null,
  "inputs": { "hp-age-A": "40", ... },
  "stores": { "events": [ { "id": "ev-1", "age": 55, ... } ] }
}
```

- `kind` is a guard: Open refuses any file whose `kind` !== `sw-accumulation-plan` with a clear alert.
- `schemaVersion` starts at 1 and the restorer is tolerant in both directions; only bump it for a breaking shape change (and branch on it). Additive stores restore with an **empty default** (`Array.isArray(s.x) ? deepClone(s.x) : []`) so an old file that omits a key restores empty rather than inheriting stale in-memory state.

**Allowlist.** `PLAN_INPUT_IDS` is an explicit array of every client-data input id (the 15 ids `readInputs()` reads + the 3 hidden meeting fields `client-name`/`client-date`/`adviser-name`). Checkboxes would save `.checked`; everything else saves `.value`. A JS test asserts the allowlist covers every id `readInputs()` reads, so it can't silently drift.

**`buildPlanFile()`** reads the allowlist + the `eventsStore` (deep-cloned) + top-level state (`spouseNames`, `anchor`, `mode`, `chartView`, `projectionRequested`, and `baseline.inputs` if locked).

**`applyPlanFile(obj)`** restores in this order: (1) reject wrong `kind`; (2) set `anchor`/`mode`/`chartView`/`projectionRequested`; (3) write `spouseNames` + the family-name span; (4) write each `inputs[id]` onto its element (skip absent ids) + mirror the meeting hidden fields into their drawer edit fields; (5) replace `eventsStore` via deep clone (empty default) and advance `eventSeq` past the restored ids; (6) `renderEvents()`; (7) rebuild `baseline` from `baselineInputs` (re-running `project()` to re-derive `baseline.p`) + `captureScenarioAnchors`/`configureScenarioSliders`/`showScenarioRow`, then re-sync derived UI and the `setAnchor`/`setMode`/`setView` toggle states; (8) `refresh()` LAST.

**IO with graceful fallback.** `savePlan()` uses `window.showSaveFilePicker` (Chrome/Edge native Save As, remembers folder, `suggestedName = <family-slug>-<YYYY-MM-DD>.json`) when present, else anchor-downloads a `Blob`. `openPlan()` uses `window.showOpenFilePicker` when present, else a hidden `<input type="file">`; either path reads the text, `JSON.parse`es inside a try/catch that alerts on malformed input, and hands to `applyPlanFile`. Feature-detected with `'showSaveFilePicker' in window`. `AbortError` (user cancelled the dialog) is swallowed silently; any other error alerts. These promise chains are the sole async code in the file (see "What not to add").

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
- **Async/promises.** The projection, rendering, and all UI wiring are synchronous — keep them that way. The **one** exception is the Save/Open plan IO (§14), which uses the inherently promise-based File System Access API. Async stays quarantined to those handlers; nothing in the engine or render path awaits.
- **TypeScript.** Would fight the no-build rule.
- **Auto-rehydrating persistence (localStorage/sessionStorage/IndexedDB/cookies).** Banned by the safety property in §14: a plain refresh must land on the blank/default tool so one client's numbers can never leak into the next session. File-based Save/Open (§14) is the sanctioned persistence — restore is always an explicit user action. Anything that needs a shared/synced datastore goes to the CRM, not here.
- **A fourth view state.** Three is the contract. If a new flow is needed, fold it into one of the existing three.
