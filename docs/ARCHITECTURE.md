# Architecture

This document describes the internal structure of `retirement_accumulation.html`. Read this if you're about to modify the code. Math and conventions are in `CALCULATIONS.md`; visual choices are in `DESIGN.md`.

## Primary file: V2 cockpit (`retirement_accumulation_v2.html`)

**`retirement_accumulation_v2.html` is now the active deliverable.** It is the "Private Client Planning Cockpit" re-skin of the original — same `project()` engine and projection math, restyled: Inter font (replacing Fraunces/Inter Tight on the chrome), a cockpit brand-blue palette, a full-bleed sticky top bar, and card shadows. The original `retirement_accumulation.html` is retained but secondary (kept for reference / fallback). The JS test harness (`tests/js/run.js`) now reads v2 (it extracts `project()` and the pure helpers from `retirement_accumulation_v2.html`).

The bulk of this document still describes the **original** file (with its approximate line ranges and the `data-view` three-state tree). v2 keeps that architecture; the sections below summarise where v2's State-2 structure now diverges. When a description here conflicts with v2, v2 wins — but most of the engine, render-pipeline, and naming conventions are shared verbatim.

### Session changes to State 2 (v2; some in both files)

1. **`clearBaseline()` true revert (BOTH files).** New pure helper `baselineRestoreFields(bi)` returns `{ money: { id→number, … }, plain: { id→number, … } }` partitioning the locked `baseline.inputs` into money fields (written back via `setHpFormatted`) and plain fields (written back via `.value`). `clearBaseline()` now writes those values onto the canonical DOM inputs and restores the anchor via `setAnchor(bi.anchor)` **before** nulling `baseline`, so on clear State 2 shows the originally-locked plan rather than the scenario-lever adjustments that drifted the inputs while compare was open.

2. **Edit button is a static label.** The plan-bar `#btn-edit-plan` reads "Edit info ↓" in every state. `wireDrawer` toggles `data-open` on the plan-bar but no longer swaps the button text (previously cycled "Advisor view" / "Edit plan ↓" / "Close ↑").

3. **State-2 toolbar row removed.** The `#canvas-head-filled` row (Real/Nominal seg + "Lock as baseline" button) is deleted. The Real/Nominal toggle (`#btn-pv` / `#btn-fv`, same ids) moved **into** `.chart-card-head` inside a new `.chart-head-toggles` flex group, to the left of the Income/Capital/Breakdown/Table view seg. `#btn-lock` is gone. The top-bar "Compare" button `#btn-compare-top` is now wired in the main IIFE: `if (!baseline) lockBaseline(); else` scroll to `.compare`. The separate second `<script>` bridge IIFE was deleted.

4. **New `updateRecapCard(p)` render function.** Called in `refresh()` immediately after `updatePlanBar(p)`. Paints the new "Current plan" recap card from `p.inputs` using `fmtR` / `fmtPct` and the null-safe `set()`. The card's spouse-name column headers carry `data-spouse` + `data-spouse-template="header"` so `renderSpouseLabels()` keeps them synced. Ids: `recap-ret-A/B`, `recap-disc-A/B`, `recap-contrib-ret-A/B`, `recap-contrib-disc-A/B`, `recap-return`, `recap-cpi`, `recap-esc`.

5. **Appendix collapsed; `updatePrintSummary` deleted.** The `#print-summary` block lost its "Detail tables" accordion (and the events + baseline-comparison subsections inside it, and the `<h2>`). The single `#appendix-toggle` ("Methodology & disclaimer") now shows methodology + disclaimer directly via `<h3>` subheads, with no inner accordions. The whole `updatePrintSummary(p)` function was **deleted** and its `refresh()` call removed — every `s-*` id it wrote lived in the removed Detail-tables block. The print-forcing handlers still iterate `details.accordion` generically, so the remaining outer accordion forces open in print as before.

6. **Foot buttons removed.** The State-2 and State-3 `.canvas-foot-actions` blocks (Table view + Print/PDF in State 2; Print/PDF in State 3) are gone from the markup; the "Illustrative only…" foot text remains. (The `.canvas-foot-actions` CSS rule survives but is now unused.) The Report button (`#btn-export-report` → `startExport`) is the export path and is independent of the foot.

7. **`buildYearTable(p)` rewritten to a reconciliation flow.** Columns: Year · Age A · Age B · Opening · Contributions · Growth · [Capital events — only when `p.events.length > 0`] · Closing. Respects the Real/Nominal `mode` (the chosen series is `real` or `nominal`). Per row: `opening = series.total[i-1]`; `contrib` = the `series.cumulContribs` diff; `event` = mode-deflated `p.eventImpactNom[i]`; `growth = closing − opening − contrib − event` (a residual, so every row reconciles by construction). The old per-pot and baseline/delta columns are dropped — the table only renders in State 2.

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
        logo + client name (left) + .plan-bar-actions (right): Save plan + Open plan + Export report + Edit plan (primary)
      </div>
      <div class="plan-bar-drawer">
        col I: household (both spouses with editable names + ages + 4 fields)
        col II: retirement (anchor row + retire-age) + capital events
        col III: market assumptions (3 thin sliders) + meeting (client-name + date edit fields)
      </div>
    </div>

    <!-- STATE 2 canvas head -->
    <!-- ORIGINAL file: this head held a Real/Nominal toggle + "Lock as baseline".
         v2: that #canvas-head-filled toolbar row is REMOVED. Real/Nominal
         (#btn-pv/#btn-fv) moved into .chart-card-head's .chart-head-toggles;
         #btn-lock is gone; the top-bar #btn-compare-top now drives lock/compare. -->
    <div class="canvas-head" data-view-only="filled">
      eyebrow + serif headline "Retirement plan" + factual sub-line
      ("[Name] retires at age 65 with R ___ per month starting retirement
      income, in today's money.")
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
        primary (Monthly income) + .outcome-gap #gap-solver (Closing the gap / Contribution leverage)
      </div>
      <div class="canvas-foot">illustrative line (v2: Table view + Print/PDF foot buttons removed)</div>
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
      <div class="canvas-foot">illustrative line (v2: Print/PDF foot button removed)</div>
    </div>

    <!-- Compliance appendix — same for all states. One outer accordion.
         ORIGINAL: its body held an <h2> + three sub-accordions (Detail tables /
         Methodology / Disclaimer). v2: the "Detail tables" accordion (and the
         events + baseline-comparison subsections + the <h2>) is removed;
         methodology + disclaimer now render directly as <h3> subheads (no inner
         accordions). updatePrintSummary was deleted with the tables block.
         Print still forces every details.accordion open and flattens them. -->
    <div class="print-summary">
     <details class="accordion appendix-toggle" id="appendix-toggle">
      <summary>Methodology & disclaimer</summary>
      <div class="accordion-body">
        <h3>Methodology ...</h3>     <!-- v2: direct subheads, no inner accordions -->
        <h3>Disclaimer ...</h3>
      </div>
     </details>
    </div>

    <!-- Report deck — hidden on screen + portrait-print; shown when
         runReportExport() sets data-export-mode on #calc-root. 4 pages,
         1 conditional (scenario). See §13 for details. -->
    <section class="report-deck">
      <section class="report-page cover-page" data-page="cover">...</section>
      <section class="report-page" data-page="projection">...</section>
      <section class="report-page scenario-page" data-page="scenario" data-enabled="false">...</section>
      <section class="report-page methodology-page" data-page="methodology">...</section>
    </section>
    <div class="report-modal-backdrop" id="report-scenario-modal">...</div>

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

**`data-goal-active` hide pattern.** Any surface that displays goal-progress (outcome-strip sub-line, compare-card meta row, print-summary row) carries `data-goal-active="false"` in the markup. (The report deck shows the income goal as an amount, not a progress percentage, so it doesn't use this pattern.) A single CSS rule `[data-goal-active="false"] { display: none !important; }` collapses them all. Renderers flip the attribute via the shared `setGoalActive(id, bool)` helper, driven by `computeGoalProgress(p)` which returns `null` when the goal is blank or zero.

### 5. Rendering functions

Each pulls from the `project()` result and updates the DOM:

- `updateSummary(p)` — outcome strip primary cell (Monthly income `#sum-income` + safe-withdrawal sub-line + the goal-progress sub-line `#sum-income-goal` when `incomeGoal > 0`) plus the State 2 headline sub-line (`#headline-age` and the `#headline-anchor-name` reference-spouse span — Session 16 trimmed the income figure out of the sub-line, so `#headline-income` no longer exists). The State 2 `<h1>` is static ("Retirement plan"). **Session 17** removed the Household-capital and Years-to-retirement cells, so this no longer writes `#sum-capital` / `#sum-years`.
- `updatePlanBar(p)` — populates the drawer meta labels (household completion, retire-at, market-summary, events count, goal), the events helper's ref-spouse name, and the plan-bar "Prepared for" line (`#plan-bar-for`). Session 16 removed the six summary fact cells from the strip (the header now carries only identity + actions), so the `set('fact-*', …)` / `setGoalActive('fact-goal-cell', …)` calls here are deliberately left as null-safe no-ops rather than ripped out.
- `updateRecapCard(p)` — *(v2 only)* paints the "Current plan" recap card from `p.inputs` (balances, contributions, return/CPI/escalation) via `fmtR` / `fmtPct` and the null-safe `set()`. Called right after `updatePlanBar(p)`. Its spouse-name column headers carry `data-spouse` + `data-spouse-template="header"` so `renderSpouseLabels()` syncs them. Ids: `recap-ret-A/B`, `recap-disc-A/B`, `recap-contrib-ret-A/B`, `recap-contrib-disc-A/B`, `recap-return`, `recap-cpi`, `recap-esc`.
- `updateViewVisibility()` — computes `deriveViewState()`, writes `data-view` on the root, toggles display on every `[data-view-only]` node. Called first in every `refresh()` so chart builds see correct visibility.
- `swrForAge(age)` — age-based safe withdrawal rate (decimal fraction), replacing the former flat 5% income rule (Session 13). Table (held inside the function so the Node harness extracts it alongside `project`) covers ages 55-100; below 55 drops 0.1pp/yr from 4.2% floored at 3.5%; above 100 held at 25%. `fmtSwr(age)` formats it as a one-decimal percent for labels. Used by `project()` (headline `monthlyIncomeReal = finalTotalReal * swrForAge(refAge + years) / 12`), `incomeCurveData` (per candidate age), and the income display surfaces.
- `incomeCurveData(inputs, extraYears)` — pure helper for the Income view. Clones `inputs`, sets `retirementAge` to `retirementAge + extraYears` (optional, **default 10**; the gap solver passes `20`), runs `project()` once, and returns `{ ages, incomeReal, markerIndex, markerAge }` where `incomeReal[i] = real.total[i] * swrForAge(ages[i]) / 12` (today's-money starting income if retiring at year `i`, using that age's SWR) and `markerIndex = retirementAge − refAge`. Because `project()` positions are independent of horizon length and the marker age equals the reference age there, `incomeReal[markerIndex]` equals the base run's `monthlyIncomeReal` exactly. Pure (given `project`), so the Node test harness extracts and exercises it directly.
- `bumpContribs(inputs, deltaTotal)` / `marginalIncomePer1000(inputs)` / `solveGapRoutes(inputs)` — pure helpers for the closing-the-gap card (live next to `incomeCurveData`, so the Node harness extracts them). `bumpContribs` raises total monthly contribution by `deltaTotal` while preserving the household split (even split when the base total is 0). `marginalIncomePer1000` is the income added per extra R1 000/month (two `project()` runs). `solveGapRoutes` returns `null` (no goal / goal met / degenerate horizon) or `{ shortfall, contribPerMonth, contribReachable, retAge, retYears, retReachable }`: the contribution route is closed-form off the affine slope (rounded up to R100); the retire-later route scans `incomeCurveData(inputs, 20)` for the first age past the planned retirement age that clears the goal. Math in `CALCULATIONS.md` ("Closing the gap").
- `updateGapSolver(p)` — renders the "Closing the gap" content, which **Session 17** moved into the outcome strip as its right-hand cell (`.outcome-gap #gap-solver`, State 2 only; previously a standalone card below the strip). Shows the contribution-leverage line whenever the horizon is valid (eyebrow "Contribution leverage"); when a goal is set and there is a shortfall it switches the eyebrow to "Closing the gap" and adds the two route rows. Uses `setGoalActive` (the generic `data-goal-active` hide flag) to collapse the whole cell on a degenerate horizon and to toggle the routes block. Copy is em-dash-free (a JS test scans the function body).
- `buildIncomeCurveChart(p)` — State 2 **Income** chart (the default first view). A single `type: 'line'` dataset (navy line, faint navy fill) of `incomeCurveData(p.inputs).incomeReal` vs candidate age. **Always real** — ignores `mode` (nominal future-rand income at a future age is misleading). The dashed vertical "planned retirement age" marker is drawn by `retAgeMarkerPlugin`, a chart-local inline plugin (a plain hook object in the config's `plugins: [...]` array — NOT chartjs-plugin-annotation) reading `chart.$markerIndex` / `chart.$markerAge` in `afterDatasetsDraw`. On first build it calls `chartIncome.update('none')` so the marker paints (the initial `new Chart` draw runs before the marker props are set).
- `buildCapitalChart(p)` — State 2 capital chart. Gold discretionary on bottom, navy retirement on top. No baseline-overlay line (State 3 replaces that entire idea).
- `buildBreakdownChart(p)` — three-layer stacked bars (greys + gold).
- `buildYearTable(p)` — HTML table inside the chart-card slot, sticky year column. **v2: rewritten to a reconciliation flow.** Columns: Year · Age A · Age B · Opening · Contributions · Growth · [Capital events, only when `p.events.length > 0`] · Closing. Respects the Real/Nominal `mode`. Per row `growth = closing − opening − contrib − event` is a residual so each row reconciles by construction; the old per-pot and baseline/delta columns are dropped. Renders in State 2 only.
- `buildCompareCharts(p)` → `ensureCompareChart(...)` — State 3's two independent Chart.js instances. Both share the same y-ceiling (`max(baseline.total, scenario.total) × 1.05`) so bars line up visually. Baseline chart renders at 0.35 opacity (alpha applied to the rgba fills, not via a CSS filter — filter would wreck Chart.js hover).
- `updateCompareCards(p)` — populates the hero numbers, sub-lines, meta rows, and the delta chip on the scenario card. `setMetaDelta(id, delta, kind)` writes the inline `em` deltas beside changed meta values; `kind` supports `currency`, `pct`, `years`, and `pp` (percentage-point delta used by the goal-progress row). A fifth meta-row on each card (`#cmp-baseline-goal-row` / `#cmp-scenario-goal-row`) renders `Goal progress · N% of R X` when the adviser-level `incomeGoal` is set; both cards read against the same current goal, not a baseline-frozen snapshot. The N% is wrapped in a `goal-progress-on-track` (green) or `goal-progress-behind` (red) span so the traffic-light tone matches the outcome strip.
- `updatePrintSummary(p)` — *(original only)* compliance-appendix tables plus the conditional goal row (`#s-goal-row`) gated on `computeGoalProgress(p)`, wrapping the % in a `goal-progress-*` span. **v2 deletes this function entirely** — the Detail-tables block it wrote (every `s-*` id) was removed and the call dropped from `refresh()`; v2's "Current plan" recap card (`updateRecapCard`) covers the on-screen starting-position readout instead.
- *(removed Session 17)* `updateNarrative(p)` — the "In plain terms" card renderer is gone, along with the card markup; State 2 no longer shows a narrative (the outcome strip carries the headline number + goal progress; State 3's compare cards carry the story). The `describeCurrentPosition` / `describeBaselinePosition` / `describePlannedScenario` helpers stay in the source (they are extracted by name in the JS test suite and kept for potential reuse) but have no on-screen renderer now. They remain em-dash-free and still use `eventsSentence`.
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
updateRecapCard(p);    // v2 — paints the "Current plan" recap card from p.inputs
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
// (v2: updatePrintSummary(p) removed — the function was deleted with the Detail-tables block)
renderSpouseLabels();
updateAnchorChips();
updateScenarioReadouts();
```

The chart branch is skipped for the view that isn't active — main charts only build in State 2, compare charts only build in State 3. This avoids Chart.js measuring a `display:none` parent and painting a blank bitmap.

### 7. Baseline lock

`lockBaseline()` captures `{ inputs, p, monthlyIncomeReal, finalTotalReal }` AND captures scenario anchors. `clearBaseline()` (BOTH files, this session) now does a **true revert**: it writes the locked `baseline.inputs` back onto the canonical DOM inputs (money via `setHpFormatted`, plain via `.value`, partitioned by the pure helper `baselineRestoreFields(bi)`) and restores `setAnchor(bi.anchor)` **before** nulling `baseline` — so State 2 shows the originally-locked plan, not the scenario-lever drift. The two compare Chart.js instances persist across lock/clear cycles — re-locking just updates their data and animates.

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

A small IIFE at the bottom (`wireDrawer`) wires `#btn-edit-plan` to toggle `data-open` on the plan-bar. The CSS rule `.plan-bar[data-open="true"] .plan-bar-drawer { display: grid; }` does the rest. No animation — the drawer appears/vanishes instantly. **v2:** the button is a static "Edit info ↓" label — `wireDrawer` no longer swaps its text (the original cycled "Advisor view" / "Edit plan ↓" / "Close ↑").

### 11. Chart resize (print)

`resizeChartsToWrap()` iterates three chart containers: the main `.chart-wrap` (holding `chartIncome`, `chartCapital`, `chartBreakdown`), `#chart-compare-baseline`'s parent, and `#chart-compare-scenario`'s parent. For each, it reads `clientWidth`/`clientHeight` and calls `chart.resize(w, h)` with explicit dimensions — inside `requestAnimationFrame` so the browser has flushed the `@media print` layout before Chart.js measures. Null-safe on every chart variable (they can be null in the state that's not active).

Called by the `beforeprint` / `afterprint` / `matchMedia('print') change` handlers. The matchMedia path is what catches headless `--print-to-pdf` flows, which do not fire `beforeprint`.

### 12. Event wiring

At the bottom: input listeners on all household fields, age inputs, retirement-age; slider listeners; scenario-slider listeners; `data-sync-to` blur handlers; `data-sync-spouse-name` blur handlers; drawer toggle; anchor buttons; view switcher (`btn-view-income/capital/breakdown/table`); mode toggles (both `#btn-pv/fv` and `#btn-pv-cmp/fv-cmp` wired to the same `setMode`); Lock / Re-lock / Clear baseline; Add event; **Export report** (`#btn-export-report` → `startExport()`); and a dev-only **Load sample data** button (`#btn-load-sample` → `loadSampleData()`, see below). Everything ends by calling `refresh()`.

**`loadSampleData()` (test scaffolding).** A convenience on the State-1 `.empty-cta`: populates a representative household and sets `projectionRequested = true` so one click lands in State 2, avoiding re-typing during testing. It writes the canonical inputs (via `setHpFormatted` for money, direct `.value` for ages/age/sliders), sets `spouseNames` + the family/client name, then calls `refresh()`. Not a product feature — hidden in print via `.empty-cta`; strip or gate it before a client-facing release.

### 13. Report deck (A4 landscape, 3–4 pages) — Session 19

An opt-in print mode that turns the calculator into a compact client-facing deliverable. Triggered by `#btn-export-report` ("Report") in the plan-bar. The deck never appears in the normal portrait print path (canvas-foot Print/PDF or plain Cmd+P) — it's fully gated on flags that only `runReportExport()` sets. The Session-19 redesign replaced the previous 12-page editorial deck (and its 5 print-time Chart.js canvases) with this 3–4 page deck whose income chart is **inline SVG** (sharp at any PDF zoom). The projection engine is untouched — this is a render/markup layer over `project()` / `incomeCurveData()`.

**Gating model.** `runReportExport(includeScenario)` sets three things before calling `window.print()`:

1. `#calc-root[data-export-mode="true"]` — CSS hides every `#calc-root > :not(.report-deck)` and reveals `.report-deck`. The on-screen visibility swap.
2. `<html class="export-printing">` — scopes the `html.export-printing .report-page { ... }` print-size overrides.
3. A dynamically-injected `<style id="export-page-sheet">@page { size: A4 landscape; margin: 0; }</style>` in `<head>` (`ensureExportPageSheet()`). `@page` rules can't live inside selector scopes, so this is the only reliable per-pass page-size override.

`afterprint` calls `teardownExport()`, which strips all three gates. There are no Chart.js instances to destroy now (the chart is inert SVG). The existing portrait `@media print` rules are unchanged and continue to win for non-export prints.

**The pages** (scoped CSS under `.report-deck` with report-local `--r-*` custom properties; deck is a direct child of `#calc-root`, with the include-scenario modal as a sibling):

1. **Cover** (`data-page="cover"`, dark navy) — kicker, `cover-title` ("Retirement Income Projection for …"), and two stat cells: date prepared + "R X /mo · age N" projected income. No goal progress on the cover (per spec).
2. **Projection** (`data-page="projection"`) — top navy `.income-chart-panel` holding `<svg id="report-income-chart" viewBox="0 0 940 350">`; bottom `.projection-summary` = a 4-box `.assumption-grid` (Income goal / Safe withdrawal rate / Expected return / Assumed inflation) + a 2-spouse `.household-grid` (age, retirement balance, discretionary balance, retirement contrib, discretionary contrib).
3. **Scenario** (`data-page="scenario"`, **conditional**) — `.scenario-hero` two tiles (Current projection = baseline, Plan scenario = live `lastProjection` + signed income delta) and `.scenario-detail` = a `.change-table` (lever / current / planned / delta) plus three `.note` blocks (result / changed inputs / unchanged assumptions). Unchanged levers render **"unchanged"** explicitly; no attribution is inferred.
4. **Methodology** (`data-page="methodology"`, dark navy, full-width) — two `.text-block`s (Methodology + Compliance note) with live assumptions interpolated into the first two methodology paragraphs.

Every page repeats the `.page-foot` brand line ("Simple Wealth Pty Ltd is a financial services provider. FSP number 50637.") and a `.page-count` slot.

**Conditional-page logic.** The scenario page carries `data-enabled="false"` in the markup. `runReportExport(includeScenario)` sets it to `"true"` only when `includeScenario && baseline`. CSS `.report-page[data-enabled="false"] { display: none; }` hides it on screen and in print. `renumberReportPages()` walks visible `.report-page` nodes and writes `NN / TT` page counts, so the document reads as 3 pages (no scenario) or 4 (with scenario).

**Include-scenario flow.** `#btn-export-report` → `startExport()`: if `baseline` is locked, open the styled modal `#report-scenario-modal` (Cancel / Export without scenario / Include scenario); otherwise call `runReportExport(false)` directly. The modal's two export buttons call `runReportExport(false|true)`. The modal is a `position: fixed` sibling of the deck, shown before export mode is entered (so the normal screen UI is still visible behind it).

**Inline SVG income chart.** `renderReportIncomeChart(chartData)` rebuilds `#report-income-chart` from scratch each export: 5 gridlines + y labels, a dashed gold income-goal line (only when goal > 0), the white income path, a vertical marker + gold dot at the selected retirement age, a white callout (Age N + "R X /mo"), and ~6 x-axis age labels. Coordinates use a fixed `viewBox 0 0 940 350` with `xForAge`/`yForValue` and `niceChartMax` for the y-ceiling. Chose SVG over a print-time canvas because a viewBox is resolution-independent and needs no measurement/`resize()` dance — that fragility burned Sessions 2/3.

**JS entry points (in the `Report deck` block in the script IIFE).**

- `startExport()` — guard on `lastProjection`; if `baseline`, open the modal, else `runReportExport(false)`.
- `runReportExport(includeScenario)` — close modal, `ensureExportPageSheet()`, set gates, toggle the scenario page's `data-enabled`, `populateReportDeck(buildReportData(...))`, `renumberReportPages()`, double-rAF → `window.print()`.
- `teardownExport()` — strip gates, `removeExportPageSheet()`.
- `buildReportData(p, baseline, events, names)` — **pure formatting adapter, no math.** Maps live state to report slots: names (spouse first names, family-name fallback via `deriveFamilyName(#client-name)` when both are defaults), cover income, the 4 assumptions, per-spouse household figures, chart points from `incomeCurveData(p.inputs)`, methodology prose with live assumptions, and (when `baseline`) the scenario comparison.
- `buildScenarioComparison(p, baseline)` — deterministic `baseline.inputs` vs `p.inputs` lever table (retirement/discretionary contribs A+B, return, inflation, escalation, income goal, retirement age) + goal-progress pp via `computeGoalProgress`. Unchanged rows → "unchanged"; changed/unchanged note copy is derived from the same comparison.
- `populateReportDeck(d)` — writes every `[data-bind="…"]` slot via `setBind`/`setBindText`, builds the scenario table rows, and calls `renderReportIncomeChart`.
- `renderReportIncomeChart(chartData)`, `createSvgEl`, `niceChartMax`, `renumberReportPages` — SVG + numbering helpers.
- `setBind(name, html)` / `setBindText(name, txt)` — bulk-assign innerHTML/textContent to every `[data-bind="name"]` node inside `.report-deck`.
- Kept from the old deck: `deriveFamilyName`, `escapeHtml`, `ensureExportPageSheet`, `removeExportPageSheet`.

**Refresh integration.** `refresh()` does NOT touch the report deck. The deck is populated only on export; otherwise it holds placeholder text (`—`) that never reaches print. Per-keystroke cost is unchanged.

**Em-dash rule.** Static deck prose (methodology, compliance, chart intro) is em-dash-free. `data-bind` slots hold `—` placeholders but are overwritten by `setBind`/`setBindText` from em-dash-free sources before print. A JS test scans the whole `.report-deck` markup for em-dashes after stripping `data-bind` nodes.

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

- *(original only)* `updatePrintSummary(p)` needs `p`; don't call it with a stale projection. `refresh()` always produces a fresh `p` and passes it through. **v2 deletes this function** (see §5) — the equivalent on-screen readout is `updateRecapCard(p)`.
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
