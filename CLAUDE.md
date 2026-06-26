# CLAUDE.md

This file is read first by Claude Code on every session. It tells you what this project is, how it's built, and the conventions that matter.

## What this is

A standalone HTML retirement accumulation calculator for Simple Wealth (Pty) Ltd, a South African authorised financial services provider (FSP 50637). A single HTML file opens by double-click, prints to PDF cleanly, and is used by the adviser (Pierre) with pre-retiree clients in real meetings.

**Primary file (since Session 18): `retirement_accumulation_v2.html`** — the "Private Client Planning Cockpit" redesign (Inter font, cockpit brand-blue palette, sticky full-bleed top bar). It shares the original's projection engine but is the file all active work now targets. The original `retirement_accumulation.html` is retained as a secondary reference. Below, "the file" / "the calculator" means the v2 file unless a section is explicitly about the original. The same non-negotiable constraints apply to both.

The calculator projects household capital from today to a configurable retirement age, for a two-spouse household with both retirement-fund and discretionary portfolios. Primary output is projected monthly income in today's money, computed by applying an age-based safe withdrawal rate (a schedule that rises with the retirement age, e.g. 4.8% at 65) to the combined capital at retirement, divided by twelve, before tax. Secondary outputs: capital at retirement (real and nominal), cumulative contributions, year-by-year trajectory, "lock as baseline" comparison, and an optional capital-events mechanism for one-off inflows and outflows.

This calculator is a **sibling** of the drawdown calculator (in a separate repo). The two are conceptually linked: the accumulation calculator's output is what the drawdown calculator takes as input when the client retires. They do not share code — the adviser moves the retirement-capital number across manually at the handoff, which is deliberate (forces attention at a point where details like "did we include her preservation fund?" tend to come up).

The target audience for this code is whoever (adviser or Claude) needs to refine the calculator in response to real client meeting feedback, or add a feature the adviser decides is worth having. Anything not strictly necessary to that goal has been resisted by design.

## Non-negotiable design constraints

These are not preferences. Breaking any of them is a regression:

1. **Single file.** Everything — HTML, CSS, JS — lives in `retirement_accumulation.html`. No build step, no npm, no React. External runtime deps are limited to: Chart.js from `cdnjs.cloudflare.com` and the Fraunces / Inter Tight / JetBrains Mono webfonts from `fonts.googleapis.com`. Adding any other runtime dep needs an explicit conversation. The file must open with `file://`; webfonts and Chart.js degrade gracefully when offline (system fallback fonts kick in; charts stay blank but inputs + numbers still compute).
2. **Prints to PDF cleanly.** Browser print dialog produces a compliance-ready document with inputs, outputs, methodology, and FSP disclaimer. Never break `@media print`.
3. **Math is auditable.** Any change to a calculation must come with a Python test in `tests/python/` that implements the same logic from scratch and agrees to within R1 with the JS. If you cannot write a closed-form or manual trace that matches, the change is unsafe.
4. **Warm paper aesthetic, not SaaS.** Background `--paper: #faf7f0`, primary accent `--navy: #1f2d3d`, accent `--gold: #b8893c`, hairline borders, serif editorial headlines (Fraunces), no gradients, no shadows beyond the scenario card's navy ring, no animations, no emoji, no em-dashes in narrative prose. Details in `docs/DESIGN.md`.
5. **South African context.** Rands with space separators (`R6 000 000`), no tax modelling during accumulation, FSP 50637 disclaimer in the print summary. The income figure uses an **age-based safe withdrawal rate** (the `swrForAge()` schedule, replacing the former flat 5% rule in Session 13) and is before-tax by design — don't add tax assumptions.
6. **Three states, one tree.** The UI is a single component tree (`<div class="calc" data-view="empty|filled|compare">`) with `[data-view-only]` flags on state-specific nodes, not three separate pages. View is derived, not manually set. Don't add a fourth state; fold new flows into the existing three.

## How the code is organised

Inside the single HTML file (approximate line ranges; file is currently ~3,300 lines):

- **Lines 1–10**: `<head>` meta, Google Fonts preconnect + `<link>`, `<style>` opens.
- **Lines 10–1130**: CSS. `:root` design tokens; shared primitives (buttons, seg toggle, delta chip, headline + gold-under accent); per-state classes (`.canvas-empty`, `.plan-bar` + drawer, `.chart-card`, `.outcome-strip`, `.compare` grid + `.compare-card`, `.scenario-levers`, `.narrative`); form primitives (`.field`, thin slider); capital events row; print summary / accordion; `@media print`; and responsive breakpoint.
- **Lines 1130–1700**: HTML structure — `.calc` root with `data-view` + hidden meta inputs; State 1 (title plate, two-column spouse setup, foot band, dashed preview); plan-bar + drawer; State 2 canvas head + chart-card + outcome-strip + narrative + canvas-foot; State 3 canvas head (compact) + compare grid + legend + scenario-levers + canvas-foot; print-summary accordions; footer meta.
- **Lines 1700–2000**: JS helpers, state variables (`spouseNames`, `baseline`, `chartView`, `mode`, …), `renderSpouseLabels()` (walks `[data-spouse]` nodes), events store + `renderEvents()` / `buildEventRow()`.
- **Lines 2000–2145**: `project()` — the core projection function. Monthly compounding, contribution escalation, growth breakdown decomposition, capital events application.
- **Lines 2145–2850**: Rendering — `updateSummary` (outcome strip + headline), `updatePlanBar` (fact cells + drawer meta), `updateViewVisibility`, `buildCapitalChart`, `buildBreakdownChart`, `buildYearTable`, `buildCompareCharts` + `ensureCompareChart`, `updateCompareCards` + `setMetaDelta`, `updatePrintSummary`, `updateNarrative`.
- **Lines 2850–end**: `refresh()`, State 1 → canonical sync wiring (`data-sync-to`, `data-sync-spouse-name`, family-name edit), drawer toggle, chart resize + print handlers, button / toggle listeners, init.

See `docs/ARCHITECTURE.md` for more detail on any section.

## Labels and print conventions

Two patterns worth knowing:

1. **Spouse-name label binding.** The two spouse headers on the household panel are editable (`contenteditable` spans). Names live in one JS object (`spouseNames = { A, B }`) and flow to every downstream label via nodes tagged `[data-spouse="A"|"B"]` with a `data-spouse-template` saying how to interpolate (`header`, `summary-pos`, `summary-contrib`). `renderSpouseLabels()` is the single source of truth — it runs on init, on every `refresh()`, and on every rename commit. When adding a new place that displays a spouse name, tag it with `data-spouse` + an appropriate template instead of hard-coding the string, and extend `renderSpouseLabels()` if you need a new template.

2. **On-screen collapsibles, print-always-open.** The appendix below the chart (detail tables / methodology / disclaimer) uses native `<details class="accordion">`. On screen they're closed by default. For PDF output we force them open two ways: a `beforeprint` listener sets `open=true` on every accordion (for interactive Cmd+P), and a `window.matchMedia('print')` listener does the same (for headless `--print-to-pdf`, which does not fire `beforeprint`). The same matchMedia listener calls `chart.resize()` so Chart.js picks up the print-only `.chart-wrap { height: 200px }` rule. If you add a third appendix block, wrap it in `<details class="accordion">` and both handlers will pick it up automatically.

The print layout has two conceptual zones: page 1 is client-facing (header, client bar, outcome cards, chart, narrative) and pages 2+ are the compliance appendix (the accordions). The `@media print` block hides input panels (`.collapsible-body`, `.market-assumptions-panel`, `.anchor-row`, the input section headers) and forces the appendix to start on a new page via `page-break-before: always` on `.print-summary`. When adding new on-screen input surfaces, add them to the hide list; when adding new output surfaces, decide which zone they belong in.

## Core calculation conventions

- **Monthly compounding** on all balances. `r_month = (1 + r_nom)^(1/12) − 1`. `(1 + r_month)^12 = 1 + r_nom` exactly, so annual growth matches the nominal input.
- **Contribution escalation** happens at the start of each 12-month block (year 1 uses the base amount; year 2 uses base × (1+esc); etc). This matches the drawdown calculator's convention.
- **PV conversion**: `real[i] = nominal[i] / (1 + cpi)^i`, applied to final values and to series. Position 0 is unscaled.
- **Starting-balance breakdown**: the starting capital line in the growth-breakdown chart compounds at the nominal return with no contributions applied to it. The three breakdown components (starting-compounded, cumulative contributions, growth-on-contributions) sum to the total every year.
- **Income calculation**: `monthly_income_today = final_real × swrForAge(retirement_age) / 12`. The safe withdrawal rate is age-based (4.2% at 55 rising to 25% at 100; below 55 drops 0.1pp/yr from 4.2% floored at 3.5%; above 100 held at 25%) — see `docs/CALCULATIONS.md` for the full schedule. Before tax. This is a rule-of-thumb, not a drawdown simulation — the methodology note says so explicitly.

## Capital events

One-off inflows or outflows. Each event has:
- age (in the reference spouse's age — which spouse depends on the youngest/oldest anchor toggle)
- amount
- today's-money flag
- kind (inflow | outflow)

Applied at the end of the designated year:
- **Inflows** add to discretionary proportionally to existing balance between spouses. If both spouses have zero disc, the inflow lands entirely on spouse A (arbitrary but deterministic).
- **Outflows** come from discretionary, proportionally, capped at available balance. If the outflow exceeds discretionary, it zeroes disc and does not touch the retirement fund. This is deliberate — it surfaces the "you cannot fund a house purchase from your RA" reality.
- Events outside the horizon (before year 1 or after retirement) are silently ignored.
- Today's-money events are inflated by CPI to the application year: `nominal = amount × (1 + cpi)^(year − 1)`.

Recurring events are not modelled in v1. If clients need them, consider a separate "recurring expense stream" UI — do not cram it into the events list.

## Working style (what Pierre wants)

- **Direct, concise communication.** Push back when you see something wrong. No filler.
- **Scope discipline.** If asked to change X, change X. Do not refactor Y "while you're in there" unless Y is broken in a way that blocks X.
- **Ask one sharp question when ambiguous**, not three safe ones. Use the `ask_user_input_v0` tool if available.
- **Audit the math before shipping.** Never declare a calculation change finished without a passing Python test.
- **Don't narrate the design system** back. Just build to spec.
- **No emoji anywhere in the product**, not in the UI, not in generated documents.

## When you're asked to make a change

Run through this checklist:

1. **Is it a math change?** Write or update the Python test in `tests/python/` FIRST. Make sure it fails with the current code (i.e. you've correctly captured the desired new behaviour). Then change the JS. Then verify the test passes. Then run the JS audit too — it tests the actual shipped HTML.
2. **Is it a UI change?** Check it renders on screen AND in the print dialog. The print stylesheet is at the bottom of the `<style>` block.
3. **Is it a design-system change?** Almost always no. The palette, typography, and spacing are deliberate. If you think they need to change, stop and ask.
4. **Does it break the print output?** Open the file in a browser, hit Cmd+P, check the preview. The print summary must be a complete, self-contained record of the projection.
5. **Does it change the hydration contract (defaults) or add a field?** Any new input field needs a matching default, a Python test, and an update to the print summary.

## Running tests

```bash
# Python tests (math audits) — 47 tests
cd tests/python
pytest -v

# JS tests (actual shipped JS) — 54 tests
cd tests/js
node run.js
```

Both must pass before any change ships. See `tests/README.md`. The JS harness reads `retirement_accumulation_v2.html` (the current primary file — see below).

## File inventory

- `retirement_accumulation_v2.html` — **the current primary deliverable.** The "Private Client Planning Cockpit" redesign (Inter font, cockpit brand-blue palette, sticky top bar). Same projection engine as the original; all active work targets this file.
- `retirement_accumulation.html` — the original warm-paper deliverable. Retained but secondary; only the `clearBaseline` revert fix has been mirrored into it this session.
- `README.md` — human-readable project overview, for GitHub.
- `CLAUDE.md` — this file.
- `docs/ARCHITECTURE.md` — code structure in detail.
- `docs/CALCULATIONS.md` — the maths and conventions.
- `docs/DESIGN.md` — visual system and interaction patterns.
- `tests/python/` — math audits in Python (47 tests).
- `tests/js/` — JS tests in Node against the shipped HTML, now `retirement_accumulation_v2.html` (54 tests).

## What not to do

- **Don't bundle.** No webpack, no rollup, no esbuild. The file is the file.
- **Don't add dependencies beyond Chart.js + Google Fonts.** No plugins, no lodash, no moment. If a new external dep is genuinely needed, it's a conversation, not a commit.
- **Don't introduce a backend.** The calculator is stateless and client-side. Anything that needs persistence goes somewhere else.
- **Don't add analytics, tracking, or telemetry.** Client financial data must stay in the browser.
- **Don't add tax modelling.** The income calculation applies an age-based safe withdrawal rate, before tax, by design. If the adviser wants tax, they use the drawdown calculator after retirement.
- **Don't rename `retirement_accumulation.html`.** The file might be linked from elsewhere.
- **Don't reformat the whole file in one commit.** Diff review is how regressions get caught; a 1300-line whitespace change defeats that.
- **Don't try to share code with the drawdown calculator.** They are deliberately separate repos. Revisit if a third calculator appears and shared infrastructure becomes worth the overhead.

## When in doubt

Ask. Pierre would rather answer one question now than fix a silent regression later.

## Session Log

### Session 19 — 2026-06-26

**Shipped (report redesign):** replaced the 12-page A4-landscape export deck with a compact **3–4 page report** (`new_report.html` was the visual reference; its hardcoded sample data was NOT shipped). Pages: **Cover → Projection → (optional Scenario) → Methodology/Compliance**. The projection page's income chart is now **inline SVG** (sharp at any PDF zoom) instead of a print-time Chart.js canvas. No engine change — `project()`/`readInputs()`/`incomeCurveData()`/`swrForAge()`/`computeGoalProgress()` and all state are untouched; this is a render/markup swap. Python suite unchanged (47 green); JS suite updated (still 54 green).

- **Removed:** the entire `.export-deck` CSS (old lines ~1279–2032), the 12-page `.export-deck` markup + 5 `export-chart-*` canvases, and the export JS (`buildExportDeck`, `buildExportCharts`, `destroyExportCharts`, `populate{Events,Compare,YearTable}`, `padSeries`, `toRoman`, `renumberExportPages`, `setMetaWithDelta`, `exportCharts` var). Kept + reused: `escapeHtml`, `deriveFamilyName`, `ensureExportPageSheet`/`removeExportPageSheet`, `setBind`/`setBindText` (selector retargeted `.export-deck`→`.report-deck`).
- **Added markup:** `<section class="report-deck">` with 4 `.report-page`s (scoped CSS under `.report-deck` with report-local `--r-*` custom properties so nothing leaks into the screen UI). The scenario page carries `data-enabled` (starts `"false"`). Plus an include-scenario modal (`#report-scenario-modal`) — a sibling of the deck inside `#calc-root`.
- **`buildReportData(p, baseline, eventsStore, spouseNames)`** — pure formatting adapter, no math. Names = spouse first names joined ("David and Sarah"), falling back to `deriveFamilyName(#client-name)` → "the Nkosi household" when both are defaults. Chart points come from `incomeCurveData(inputs)` (single source; marker income == `p.monthlyIncomeReal`). Scenario = deterministic `baseline.inputs` vs `p.inputs` lever table (retirement/discretionary contribs A+B, return, inflation, escalation, income goal, retirement age, goal-progress pp); unchanged levers render **"unchanged"** explicitly, no attribution inferred.
- **`renderReportIncomeChart()`** — SVG generator ported from the reference (`createSvgEl`/`niceChartMax`/`xForAge`/`yForValue`, gridlines, dashed goal line drawn only when goal>0, white income path, vertical marker + gold dot at the selected age, white callout box, x-axis age labels). Targets `#report-income-chart` (viewBox `0 0 940 350`).
- **Flow:** `#btn-export-report` → `startExport()` → if `baseline` exists, open the modal (Cancel / Export without scenario / Include scenario); else `runReportExport(false)`. `runReportExport(includeScenario)` injects the `@page` landscape sheet, sets `data-export-mode`/`export-printing`, toggles the scenario page, `populateReportDeck(buildReportData(...))`, `renumberReportPages()`, then the double-rAF → `window.print()`. `afterprint` → `teardownExport()` (no Chart.js to destroy now — SVG is inert).

**Decisions (and why):**

- **SVG over canvas** — a print-time canvas rasterises at screen DPI and the old deck spent effort fighting that; SVG with a viewBox is resolution-independent and needs no measurement/resize dance.
- **Report CSS scoped under `.report-deck` with `--r-*` tokens** — the v2 palette already matches the design (`--navy: #323E5D`, `--gold: #b98936`, Inter), but a self-contained token set keeps the report visually exact and immune to future screen-token changes.
- **Styled modal, not `confirm()`** (Pierre's pick) — on-brand 3-button prompt.
- **Cover names: spouse-first with family fallback** (Pierre's pick).

**Tests:** 54 JS (export-deck assertions rewritten for the report deck: 4-page sequence, scenario `data-enabled`, SVG chart, modal wiring, `buildReportData` is a formatting adapter, static-prose em-dash audit; dropped the `toRoman` test) + 47 Python (unchanged), all green. Also ran an out-of-harness runtime smoke (fake DOM) through `buildReportData`→`populateReportDeck`→`renderReportIncomeChart` on the sample household: cover income R87 210/mo · age 65, scenario delta +R26 819, SVG renders, marker income == headline.

**Known caveat:** No headless browser available this session, so layout (clipping/overflow on each page, page-count `NN / TT`, footer on every page) needs a browser eyeball. `new_report.html` (the prototype reference, untracked) was left in place. Regression to check: plain Cmd+P without clicking Report still produces the portrait working-copy; save/open plan still round-trips.

### Session 18 — 2026-06-26

**Context:** V2 (`retirement_accumulation_v2.html`, the cockpit redesign merged in PR #17) is now Pierre's primary file. This session worked almost entirely in V2 (one fix mirrored into the original), repointed the JS harness to V2, and made it the documented primary across `CLAUDE.md` / `README.md` / `tests/README.md` / `docs/*`. No math change all session — every change is markup/render/UX over the unchanged engine.

**Shipped (branch off `main`; one PR):**

1. **`clearBaseline` is now a true revert (BOTH files).** Bug: the scenario levers write their adjustments back onto the canonical inputs as you drag them, so clearing a baseline dropped you into State 2 showing the *adjusted scenario*, not the locked plan (`readInputs()` reads the live DOM). Fix: new pure helper `baselineRestoreFields(bi)` returns `{ money: {id→number…}, plain: {id→number…} }`; `clearBaseline()` writes the locked `baseline.inputs` back onto the canonical inputs (money via `setHpFormatted`, plain via `.value`) and restores the anchor via `setAnchor(bi.anchor)` **before** nulling `baseline`. Events are untouched (the levers never touch `eventsStore`). Applied to **both** `retirement_accumulation_v2.html` and `retirement_accumulation.html` (identical latent bug; and the JS harness needed the tested function present in whatever file it reads). Known cosmetic: a field blank at lock-time (read as 0) restores as "0" rather than blank, consistent with the lever writeback.

2. **JS harness repointed to V2.** `tests/js/run.js` now reads `retirement_accumulation_v2.html`. Verified by an Explore audit that every math test (engine byte-identical bar chart colours) and every markup/string assertion passes against V2.

3. **Plan-bar edit button → static "Edit info ↓" in all states.** The `wireDrawer` handler still toggles `data-open` but no longer swaps the label (was "Advisor view" / "Edit plan ↓" / "Close ↑").

4. **Removed the State-2 toolbar row; folded Real/Nominal into the chart head; deleted the Lock button.** Deleted `#canvas-head-filled` (held a redundant Real/Nominal seg + "Lock as baseline →"). The Real/Nominal toggle (`#btn-pv`/`#btn-fv`, same ids) moved into `.chart-card-head` inside a new `.chart-head-toggles` group, left of the Income/Capital/Breakdown/Table seg. `#btn-lock` deleted; the top-bar **Compare** button (`#btn-compare-top`) is now wired in the main IIFE (`if (!baseline) lockBaseline(); else scroll to .compare`) and the separate bridge `<script>` IIFE was deleted. Pierre confirmed Compare and Lock were functionally identical in State 2.

5. **New "Current plan" recap card (State 2).** A `.plan-recap` card between the outcome strip and the foot: two columns per spouse (names via `data-spouse`/`renderSpouseLabels()`) showing Retirement balance, Discretionary balance, Monthly retirement contributions, Monthly discretionary contributions; a divider; then an assumptions row (Expected return · Assumed inflation · Escalation). New `updateRecapCard(p)` reads `p.inputs` via the null-safe `set()` + `fmtR`/`fmtPct`, called in `refresh()` after `updatePlanBar(p)`. Split-by-pot + escalation were Pierre's picks. Projected capital-at-retirement is deliberately excluded (that's the chart + outcome strip).

6. **Collapsed the appendix to one box; deleted `updatePrintSummary`.** The `#print-summary` "Detail tables" accordion (client/meeting, starting position, contributions & assumptions, projected outcome, plus the events + baseline-comparison subsections and the `<h2>`) was removed; the single `#appendix-toggle` ("Methodology & disclaimer") now expands directly to methodology + disclaimer via `<h3>` subheads (no inner accordions). `updatePrintSummary(p)` was deleted entirely (every `s-*` id it wrote lived in the removed block; its events/baseline blocks used non-null-safe `.style.display`) and its `refresh()` call removed. Detail now lives in the on-screen recap card + the 12-page Report deck.

7. **Removed the canvas-foot action buttons.** State-2 ("Table view", "Print / PDF") and State-3 ("Print / PDF") `.canvas-foot-actions` removed; the "Illustrative only…" foot text stays. Table view is reachable from the chart-head Table toggle; the top-bar gold **Report** button (`#btn-export-report` → `startExport`, independent) is the export path.

8. **Year table → reconciliation flow.** `buildYearTable(p)` rewritten to `Year · Age A · Age B · Opening · Contributions · Growth · [Capital events] · Closing`, respecting the Real/Nominal toggle. Per row: `opening = series.total[i-1]`, `contrib = series.cumulContribs` diff, `event = ` mode-deflated `p.eventImpactNom[i]`, `growth = closing − opening − contrib − event` (residual, so each row reconciles by construction; nominal mode → nominal growth, real mode → real growth net of inflation). The Capital-events column appears only when `p.events.length > 0`. Old per-pot and baseline/delta columns dropped (the table only renders in State 2).

**Decisions (and why):**

- **Fix mirrored into the original file too.** The harness can only test a function it can read, and the bug was real in both. Low risk — `baselineRestoreFields` is pure and identical.
- **Compare rewired in the main IIFE, not via a hidden Lock button.** `lockBaseline`/`baseline` are in that closure; deleting the bridge IIFE and calling `lockBaseline()` directly is cleaner and honours "delete the button altogether."
- **Year table reconciles in the displayed unit.** Growth as the residual guarantees Opening+Contrib+Growth(+Events)=Closing in whatever unit the toggle selects — the adviser can trace totals start to finish, and the Real/Nominal toggle meaningfully shows nominal-vs-real growth.

**Tests:** 54 JS (50 + 2 `clearBaseline` + 1 recap + 1 year-table; two `s-goal*` assertions removed in place) + 47 Python (unchanged — no math change), all green. Harness now reads V2.

**Docs updated:** `CLAUDE.md` (this entry + V2-primary note in "What this is" + File inventory + test counts + "Running tests"), `README.md`, `tests/README.md`, `docs/ARCHITECTURE.md` (new "Primary file: V2 cockpit" section + in-place fixes to `clearBaseline`, the `refresh()`/render list, the page schematic, the drawer toggle), `docs/DESIGN.md` (new "Primary file: V2 cockpit" section + State-2 / Table / Print "(v2)" notes).

**Known caveat / compliance flag:** Removing the Detail tables thins the **portrait Cmd+P** output (it loses the assumptions/outcome tables). The portrait print still carries inputs (recap card, page 1), outputs (outcome strip + chart), methodology and disclaimer; the **Report** deck remains the full client deliverable. This is a deliberate, Pierre-directed trim that softens non-negotiable #2 for the portrait path — flagged here so it isn't read as an accidental regression. None of the V2 changes are browser-verified yet (no headless browser this session); eyeball State 2 (no toolbar row; Real/Nominal in the chart head; recap card; reconciling year table) and the single appendix box.

### Session 17 — 2026-06-25

**Shipped:** further thinned State 2 below the chart — from three blocks (3-cell outcome strip → "Closing the gap" card → "In plain terms" card) down to a single two-cell outcome strip. No math change; all renderer logic for the gap solver is untouched, only relocated.

- **Outcome strip → two cells.** Removed the **Household capital** and **Years to retirement** cells (advisers don't reference them in meetings). The strip is now the navy **Monthly income** primary cell (unchanged — income + safe-withdrawal sub-line + goal-progress sub-line) plus a new right-hand cell `.outcome-gap` that holds the relocated closing-the-gap content. CSS: `.outcome-gap { flex: 2 }` so the navy hero keeps ~its original one-third width; `.outcome-gap .narrative-body { font-size: 14px }` to sit in the shorter strip cell.
- **"Closing the gap" moved into the strip.** The `#gap-solver` section (with all its IDs: `gap-eyebrow`, `gap-routes`, `gap-routes-intro`, `gap-route-contrib/-retage/-none`, `gap-leverage`) moved verbatim from a standalone `.narrative`-shelled card below the strip into the strip as `.outcome-cell.outcome-gap`. It keeps its inner `narrative-eyebrow` / `narrative-body` classes for typography but drops the `.narrative` wrapper (no gold left-rule inside the strip). `updateGapSolver(p)` is unchanged — the contribution-leverage line is still always shown whenever the horizon is valid (eyebrow "Contribution leverage"), and the two routes appear only on a goal shortfall (eyebrow "Closing the gap"). On a degenerate horizon `setGoalActive('gap-solver', false)` collapses the cell and the navy cell spans full width.
- **"In plain terms" narrative removed from State 2.** The `#narrative-summary` card markup was deleted and `updateNarrative(p)` (plus its `refresh()` call) removed — the single-sentence current-position summary (Session 16) just restated the income number + goal progress the navy cell already shows. `describeCurrentPosition` / `describeBaselinePosition` / `describePlannedScenario` are **kept in the source** (the JS suite extracts them by name; State 3 never rendered them on screen anyway — the compare cards carry the story) with a comment noting they now have no renderer.
- **`updateSummary(p)`** dropped the four now-dead `set('sum-capital'…)` / `set('sum-years'…)` calls.

**Decisions (and why):**

- **Drop "In plain terms" entirely rather than move it in too.** Pierre's call mid-task — with the navy cell already showing income + "Goal R x / mo · on track to y% of target", the plain-terms sentence was pure restatement. Moving it beside the navy cell would have repeated the same number twice in one strip.
- **Keep the gap helpers' three `describe*` functions despite no caller.** Removing them would churn the JS test bundle (it extracts and exercises all three by name). They're cheap to keep and a comment flags them as renderer-less. The alternative (delete functions + their tests) is more change than the task warrants.
- **`flex: 2` on the gap cell, not `flex: 1`.** Preserves the navy hero's ~one-third dominance from the old three-cell strip; a 50/50 split made the strip read as two equal halves and over-weighted the prose. Flagged in the plan as a browser-eyeball tuning.

**Tests:** 50 JS + 47 Python, all green (no changes — every ID the suite checks survives: `gap-solver`, `gap-routes`, `gap-leverage`, `gap-route-contrib/-retage`, `sum-income-goal`, and the three `describe*` functions).

**Docs updated:** `docs/DESIGN.md` (Filled-state intro, Outcome strip, Narrative section now "removed from State 2", Closing-the-gap "content" not "card"), `docs/ARCHITECTURE.md` (State 2 body schematic, `updateSummary` drops capital/years, `updateGapSolver` location, `updateNarrative` removed from render list + `refresh()` snippet), `CLAUDE.md` (this entry).

**Known caveat:** Visual verification needs a browser. Eyeball: (a) State 2 shows chart → one strip (navy income left ~1/3, closing-the-gap right ~2/3) → foot, with no capital/years cells and no "In plain terms" card; (b) goal above projection → right cell "Closing the gap" + two routes + leverage line; (c) goal met or blank → "Contribution leverage" + leverage line only; (d) Cmd+P keeps the strip on page 1. Check the `flex: 2` width and the 14px body read well at meeting distance.

### Session 16 — 2026-06-25

**Shipped (close-the-gap-solver, same branch/PR #15):** trimmed State 2 density. The screen had grown to eight stacked blocks with the income figure repeated 4-5x; three targeted cuts, no math change.

- **Compliance appendix → one collapsed toggle.** `#print-summary` (the "Summary of assumptions and outcome" + Detail tables / Methodology / Disclaimer accordions) is now wrapped in a single outer `<details class="accordion" id="appendix-toggle">` whose summary reads "Methodology & disclaimer". On screen it's one quiet closed line; expanding reveals the three sub-accordions. Print is unchanged — the `onbeforeprint` / `matchMedia('print')` handlers force **every** `details.accordion` open (the new outer one included), and `@media print .accordion > summary { display:none }` flattens it all with the `<h2>` as the section title. CSS: `.print-summary` lost its card chrome on screen (border/padding) so the toggle reads as a line; the `@media print .print-summary` rule already zeroed those.
- **Narrative → one sentence.** `describeCurrentPosition(p)` rewritten from a multi-sentence paragraph (which restated return/CPI/contributions/capital/income/goal — ~75% duplicated elsewhere) to a single line: "Projected R x a month in today's money, before tax[, covering y% of the R z monthly goal]." Goal clause only when `incomeGoal > 0`. `describeBaselinePosition` / `describePlannedScenario` (State 3) untouched.
- **Headline sub-line trimmed.** "[Name] retires at age 65 with R x per month…" → "[Name] retires at age 65." Removed `#headline-income` span + the `set('headline-income', …)` call in `updateSummary`. The outcome strip's `#sum-income` is the single loud source.
- **Dead code removed.** `goalSentence()` lost its only caller (the old narrative), so it and its two direct JS tests were deleted, and it was dropped from the narrative test bundle. `eventsSentence()` stays (still used by the State 3 narratives).
- **Plan-bar header stripped to identity + action.** The persistent `.plan-bar` strip crammed ~eleven equal-weight elements into one row (logo + six fact cells + four buttons). Removed the entire `.plan-bar-facts` block (the six cells only echoed back setup numbers shown elsewhere) and its CSS + the dead `@media` rule; wrapped the four buttons in a new `.plan-bar-actions` cluster (`flex:1; justify-content:flex-end`) and promoted `Edit plan` from ghost to the **navy primary** button as the strip's anchor. Save/Open/Export stay as ghosts. JS untouched per the task: `updatePlanBar`'s `set('fact-*', …)` / `setGoalActive('fact-goal-cell', …)` calls are deliberately left as null-safe no-ops. One JS test assertion (`#fact-goal-cell` present) was dropped since the cell is gone; the other goal-surface assertions remain.

**Decision:** narrative was *shortened*, not removed (Pierre's pick) — a brief plain-English line for reading aloud, without the wall of restated numbers. Appendix kept on screen behind one toggle rather than hidden entirely, so the detail tables stay one click away in a meeting.

**Tests:** 50 JS (52 − 2 removed `goalSentence` tests; one `describeCurrentPosition` assertion updated to the short output) + 47 Python (unchanged), all green. `<details>` tags balance 4/4.

**Docs updated:** `docs/DESIGN.md` (State 2 stack + appendix toggle + one-line narrative + trimmed headline), `docs/ARCHITECTURE.md` (`describeCurrentPosition` now short, `updateSummary` drops `headline-income`, print-summary nesting, `goalSentence` removed), `README.md` + `tests/README.md` + counts (52 → 50 JS), `CLAUDE.md` (this entry).

**Known caveat:** Visual verification needs a browser. Eyeball: (a) headline reads "David retires at age 65." with no income in the sub-line; (b) "In plain terms" is one sentence, goal clause drops when the goal is blank; (c) the bottom of the screen is a single "Methodology & disclaimer ▾" line that expands to the three sub-accordions; (d) Cmd+P still prints the full appendix (forced open, flattened, with the "Summary of assumptions and outcome" title).

### Session 15 — 2026-06-25

**Shipped (close-the-gap-solver):** the calculator now answers the question that creates a feeling of control for the persona (a 48-year-old, earning well, contributing monthly): *"so what do I do about it?"* A new **"Closing the gap"** card under the State-2 outcome strip turns the income goal into action, and a **contribution-leverage** line ties the monthly debit order to the outcome. Moves the tool from descriptive ("you're at 72% of goal") to prescriptive ("add R4 200/month, or retire 2 years later"). No change to `project()`; both features are derived readouts on top of it.

- **Feature 1 — close-the-gap solver.** When a goal is set AND there's a shortfall (`computeGoalProgress(p).pct < 100`), the card shows the two **actionable** single-lever routes to 100%: increase contributions by R x/month, or retire x years later (at age N). The "+x%/yr return" route was deliberately omitted — a client can't will a higher market return, and "feeling in control" means levers they actually hold.
- **Feature 2 — contribution leverage.** A one-line readout: "Each extra R1 000/month adds about R y/month to retirement income, in today's money." Shown whenever the horizon is valid, independent of the goal.
- **The math — affine, closed-form, no binary search.** Projected income is affine in total monthly contribution: `I(c) = I0 + k·Δc` (contributed capital, growth on it, CPI deflation, and the fixed-age SWR are all linear in the contribution; every pot shares one return/escalation/CPI, so the slope `k` is split-independent). So `k` comes from two `project()` runs (Feature 2 displays `k×1000`), and the contribution route is `Δc = (goal − I0)/k` rounded **up** to the nearest R100 so the stated figure clears the goal. The retire-later route reuses `incomeCurveData(inputs, 20)` (now takes an optional horizon, default 10) and scans for the first age beyond the planned retirement age whose today's-money income clears the goal. The one non-affine corner — an outflow capital event large enough to be capped at available discretionary — is sub-R100 in practice and absorbed by the round-up; documented in `docs/CALCULATIONS.md`.
- **New pure helpers** (next to `incomeCurveData`, extractable by the Node harness): `bumpContribs(inputs, deltaTotal)`, `marginalIncomePer1000(inputs)`, `solveGapRoutes(inputs)` (returns `null` when no goal, goal met, or degenerate horizon). **New renderer** `updateGapSolver(p)` called from `refresh()` right after `updateSummary(p)`; the card reuses the `.narrative` shell (gold rule) and the `data-goal-active` hide pattern, lives inside the State-2 `data-view-only="filled"` block (hidden in States 1/3), and carries the working-copy portrait print.

**Decisions (and why):**

- **Two actionable routes, not three.** The "earn x% more return" route was dropped: it implies return is a dial the client turns, which is false and (had the resilience band shipped) would have contradicted it. Solver = the client's decisions; market uncertainty is a separate story.
- **Resilience/stress-test band dropped from scope.** Considered (conservative 9% / optimistic 10% nominal), then cut by the user to keep this release to the two prescriptive features. The 9/10 framing surfaced a nice teaching point — real return is `(1+nom)/(1+cpi)−1`, so 9% nominal at 5% CPI is 3.81% real, not 4% — which is exactly why the engine deflates by division, not subtraction.
- **Closed-form over binary search.** The approved plan called for it; the affine property makes it exact and cheap, and keeps the helpers trivially auditable.

**Also added (test scaffolding):** a `Load sample data (test)` ghost button in the State-1 `.empty-cta`. `loadSampleData()` populates a representative household (David & Sarah Bennett, ages 48/46, R2m retirement + R0.5m discretionary each, R15k + R3k monthly contributions each, retire 65, 9% return / 5% CPI / 5% escalation, R100 000 goal) and jumps straight to State 2 — so the tool can be exercised without re-typing. The sample lands at ~R87 200/month vs the R100 000 goal (87%), which exercises the new gap card. It's a dev convenience, not a product feature (hidden in print via `.empty-cta`); no test added per the "UI verified by eye" convention. **Remove or relabel before any client-facing release** if the button shouldn't be visible in a meeting.

**Tests:** 52 JS (45 + 7 new) + 47 Python (42 + 5 new), all green. New Python module `test_gap_solver.py` (affine property, marginal-income match, solved-contribution-closes-goal with round-up correctness, retire-later-is-first-clearing-age, null cases). New JS tests extract `marginalIncomePer1000` + `solveGapRoutes` and assert the same properties + card markup/wiring + em-dash-free copy.

**Docs updated:** `docs/CALCULATIONS.md` (new "Closing the gap" section), `docs/ARCHITECTURE.md` (new helpers + `updateGapSolver` in the render list + `refresh()` snippet + `incomeCurveData` horizon param), `docs/DESIGN.md` (the new card in the State-2 section), `README.md` + `tests/README.md` + counts, `CLAUDE.md` (this entry + counts 45→52 JS / 42→47 Py).

**Known caveat:** Visual verification needs a browser (none available here). Eyeball: (a) set a goal above the projection → card titled "Closing the gap" shows both routes + the per-R1 000 line; applying the stated contribution flips the outcome-strip goal line to "on track"; (b) goal below the projection → routes hide, eyebrow reads "Contribution leverage", per-R1 000 line remains; (c) no goal → leverage line only; (d) Cmd+P → the card renders on page 1; (e) State 3 (locked baseline) → card hidden.

### Session 14 — 2026-06-03

**Shipped (save-open-plan):** file-based **Save plan** / **Open plan** — write the current client's inputs to a portable `.json` on disk and restore them later. For accidental-refresh recovery and multi-client filing (drop the files in iCloud/Dropbox and the roster syncs for free). Full detail in `docs/ARCHITECTURE.md` §14.

- **Buttons.** `Save plan` + `Open plan` ghost buttons in the plan-bar nav (next to Export report), matching the existing `.btn.ghost.no-print` vocabulary. The plan-bar is hidden in State 1, so the empty-state `.empty-cta` also carries an `Open a saved plan` ghost button beneath the primary CTA — otherwise a fresh page (the landing screen) couldn't restore anything. `.empty-cta` switched to a centred vertical stack to hold both.
- **Safety property — opt-in restore only.** A plain refresh still lands on the blank/default tool. No `localStorage`/`sessionStorage`/auto-rehydrate; files are the transport precisely because Open is a deliberate click. This is what stops one client's numbers leaking into the next session. A JS test asserts the persistence layer never touches web storage (matching actual usage, not the word in a comment).
- **Stores inputs, not outputs.** `buildPlanFile()` serialises the `PLAN_INPUT_IDS` allowlist (15 canonical input ids + the 3 hidden meeting fields) + the `eventsStore` (deep-cloned) + top-level state (`spouseNames`, `anchor`, `mode`, `chartView`, `projectionRequested`, and `baseline.inputs` if a baseline is locked). The projection is re-derived on restore, so the file is small and forward-compatible with engine changes (e.g. the Session-13 SWR schedule). Schema `{ schemaVersion: 1, kind: "sw-accumulation-plan", savedAt, familyName, ...state, inputs, stores }`.
- **`applyPlanFile(obj)` order** (matters): reject wrong `kind` → set mode state → write spouseNames + family-name span → write `inputs[id]` onto elements (+ mirror meeting hidden fields into drawer edit fields) → replace `eventsStore` via deep clone with **empty default** + advance `eventSeq` past restored ids → `renderEvents()` → rebuild `baseline` from `baselineInputs` (re-run `project()` for `baseline.p`) + scenario sliders → re-sync `setAnchor`/`setMode`/`setView` → `refresh()` LAST.
- **`kind` guard.** Open refuses any file whose `kind !== 'sw-accumulation-plan'` with a clear alert. `schemaVersion` stays 1; restore is tolerant both directions (additive stores use the `Array.isArray(s.x) ? deepClone(s.x) : []` pattern so an old file missing a key restores **empty**, not stale).
- **IO with fallback.** `savePlan()`/`openPlan()` use the File System Access API (`showSaveFilePicker`/`showOpenFilePicker`, native dialogs, `suggestedName = <family-slug>-<YYYY-MM-DD>.json` via `slugifyName`) on Chrome/Edge, and degrade to a `Blob` anchor-download / hidden `<input type="file">` on Safari/Firefox. `AbortError` (cancelled dialog) is swallowed; other errors alert. Malformed JSON is caught and alerted.

**Decisions (and why):**

- **Open affordance in State 1, not just the plan-bar.** The task said "top nav," but the plan-bar is hidden on the landing screen — so Open had to also live in the empty state or a fresh session could never restore. Save stays plan-bar-only (nothing to save before data is entered). Opening from State 1 sets `projectionRequested` from the file and transitions straight to the projection.
- **Restore the locked baseline by re-deriving, not by storing the projection.** A saved compare-state stores only `baseline.inputs`; `applyPlanFile` re-runs `project()` to rebuild `baseline.p`. Keeps the "inputs not outputs" rule intact and stays correct across engine changes.
- **Async is quarantined.** The File System Access API is promise-based, which is the one async corner in an otherwise-synchronous file. The engine/render path stays synchronous; only the two IO handlers use promise chains. `docs/ARCHITECTURE.md` "What not to add" updated to carve this out (and to ban auto-rehydrating storage explicitly).
- **`.value` for everything, `.checked` reserved for checkboxes.** No top-level checkboxes exist today (the events "today's money" flags live in the store), but `buildPlanFile`/`applyPlanFile` branch on `el.type === 'checkbox'` so the allowlist is forward-safe.

**Tests:** 45 JS (40 + 5 new) + 42 Python (unchanged — no math change), all green. New JS tests: `slugifyName` cleaning + fallback; `PLAN_INPUT_IDS` covers every id `readInputs()` reads (drift guard) + includes the 3 meeting ids; `kind` guard + empty-default store restore + `refresh()`-last in `applyPlanFile`; no `localStorage`/`sessionStorage`; Save/Open buttons wired in nav + State 1 + FS-Access feature-detect + `AbortError` handling.

**Docs updated:** `docs/ARCHITECTURE.md` (new §14, "What not to add" async + persistence carve-outs, page-structure schematic), `docs/DESIGN.md` (plan-bar buttons + empty-state Open), `README.md` (features), `tests/README.md` + counts, `CLAUDE.md` (this entry + JS count 40 → 45).

**Known caveat:** No browser/jsdom available here, so the round-trip is covered by code review + structural/unit tests rather than an end-to-end DOM test. Eyeball in a browser: (a) plain refresh → blank State 1 (no auto-restore); (b) enter a plan, Save → readable pretty-printed JSON named `<family>-<date>.json`; (c) refresh, Open the file → every input, the events ledger, names, mode/view/anchor toggles, and (if saved) the locked baseline all restore and the projection re-runs to match; (d) Open a non-matching JSON → refused with the alert; (e) cancel a picker → no error; (f) Safari/Firefox use the download + file-input fallback.

### Session 13 — 2026-06-03

**Shipped (factual-headlines):** a new **Income** chart added as the default first view of the State 2 chart card. The card now toggles Income / Capital / Breakdown / Table. Income answers the question advisers actually field in meetings — "what would my starting income be if I retired earlier or later?" — which the three bar charts (all capital-over-time) never did.

- **The chart.** A single `type: 'line'` chart (navy line, faint navy fill, no point markers). X-axis is the reference spouse's age, from their current age to the configured retirement age + 10. Y-axis is the starting monthly retirement income, in today's money, the household would draw if they retired at that age (the age-based safe withdrawal rate applied to projected real capital at each candidate age). A dashed navy vertical marker sits at the configured retirement age with a "Planned age NN" mono label.
- **One extended projection, not N.** `project()` computes each year position independently of the horizon length, so a single run to `retirementAge + 10` yields the income for every candidate age at once: `incomeReal[i] = real.total[i] * swrForAge(age[i]) / 12`, `age[i] = refAgeSeries[i]`. The value at the marker (`markerIndex = retirementAge − refAge`) equals the base run's `monthlyIncomeReal` exactly — so the chart and the outcome-strip headline never disagree. Capital events anchored after the planned retirement age naturally lift only the later candidate ages (correct for the "retire later" reading) and leave the marker untouched.
- **Age-based SWR replaces the flat 5% rule everywhere (mid-PR addition).** Real-meeting feedback: a single 5% draw is wrong across ages. Added `swrForAge(age)` — a schedule (table inside the function so the Node harness extracts it with `project`): 4.2% at 55 rising to 25% at 100; below 55 drops 0.1pp/yr from 4.2% floored at 3.5%; above 100 held at 25%. `project()`'s `monthlyIncomeReal` now uses `swrForAge(refAge + years)`; the Income chart uses `swrForAge(age[i])` per candidate age; the marker stays equal to the headline because both key off the same age. Replaced across all income surfaces: outcome-strip sub-line (`#sum-income-sub`, dynamic), narrative drawdown sentence, print summary (income row reworded + new "Safe withdrawal rate applied" `#s-swr` row + methodology paragraph), and the export deck (Assumptions "Safe withdrawal rate" row, methodology + compliance prose). The Income-chart tooltip now shows the per-age rate. Income at 65 is 4.8% (was 5%); default-scenario monthly income moved 97 138 → 93 252. Still before-tax — no tax modelling added.
- **Always real.** The Income view ignores the Real/Nominal toggle. Nominal future-rand income at a future age is a misleading number; "income in today's money" is the only meaningful framing and matches the headline. Capital/Breakdown/Table still respond to the toggle.
- **New JS.** `incomeCurveData(inputs)` (pure helper — clones inputs, extends the horizon, runs `project()`, returns `{ ages, incomeReal, markerIndex, markerAge }`) and `buildIncomeCurveChart(p)`. The dashed marker is drawn by `retAgeMarkerPlugin`, a **chart-local inline plugin** (a plain hook object in the config's `plugins: [...]` array, reading `chart.$markerIndex`/`chart.$markerAge` in `afterDatasetsDraw`) — NOT chartjs-plugin-annotation, so the no-external-plugin rule stands. Global `chartIncome`. `chartView` default flipped to `'income'`. Wired into `setView` (4-way button/slot/legend toggles + destroy-on-switch), `refresh()` (first branch), `resizeChartsToWrap` (added to the `.chart-wrap` pair), and the seg-button click listener.
- **Legend.** Each legend key now carries a `chart-legend-<view>` class and shows only in its own view (income / capital / breakdown); the two plain Retirement/Discretionary keys became `chart-legend-capital`. Income's key reads "Starting monthly income, today's money".

**Decisions (and why):**

- **Added as a 4th view, Capital kept (not a replacement).** User pick. The Capital accumulation chart is still the right answer for "how does the pot grow"; Income answers a different question. Income leads because it's the meeting-opening question.
- **X-axis current age → retirement + 10.** User pick. The left edge ("retire today") and 10 years past the plan give context on both sides of the marker without an unbounded right tail.
- **Inline draw hook over a thin vertical dataset or the annotation plugin.** The annotation plugin is an external dependency (banned). A vertical "dataset" on a category axis is awkward and fights the line interpolation. An `afterDatasetsDraw` hook scoped to this one chart is the idiomatic vanilla-Chart.js way and adds nothing to the dependency surface.
- **First-build redraw.** `new Chart(...)` draws once synchronously before `$markerIndex` is assigned, so the marker would miss the first paint; `buildIncomeCurveChart` calls `chartIncome.update('none')` after setting the props. The reuse path sets the props before its own `update('none')`, so it's already covered.
- **Math tests.** The chart leans on a real property — that a single extended run equals N dedicated per-age runs — so it gets audited, and the SWR change is a math change. `tests/python/test_income_curve.py` (5 tests) proves the extended-run-vs-dedicated equivalence (now via `monthlyIncomeReal`, which carries the per-age SWR), the marker-equals-headline identity, events-beyond-retirement, the `swr_for_age` table/floor/clamp, and a closed-form SWR cross-check. `conftest.py` gained a `swr_for_age` port and its `monthlyIncomeReal` now uses it; `test_core_math` income asserts switched from flat 5% to SWR(65). The JS suite composes `swrForAge` into the `project`/`incomeCurveData`/narrative extractions, asserts `swrForAge` values + that income at 65 is 4.8%, and updates the v1-baseline income expectation.

**Tests:** 40 JS (34 + 6 new) + 42 Python (37 + 5 new), all green.

**Docs updated:** `CLAUDE.md` (session log + non-negotiable #5 + core income convention + "don't add tax" + intro), `docs/CALCULATIONS.md` (income section rewritten with the full SWR schedule table), `docs/ARCHITECTURE.md` (state vars, `incomeCurveData` + `buildIncomeCurveChart`, `refresh()` snippet, `resizeChartsToWrap`, chart-card schematic, event-wiring view switcher), `docs/DESIGN.md` (Chart section — four views + Income line chart and marker; Filled-state intro), `README.md` + `tests/README.md` (view list + counts + new module).

**Known caveat:** Visual verification needs a browser (no headless screenshot taken). Eyeball: (a) Income is the default view on entering State 2, line rises with age, dashed marker sits at the planned retirement age and its hover income matches the outcome-strip headline; (b) changing retirement age in the drawer moves the marker and shifts the right edge (+10); (c) Real/Nominal leaves Income unchanged but still moves Capital/Breakdown; (d) Cmd+P with Income selected renders the curve + marker at print width.

### Session 12 — 2026-04-28

**Shipped (factual-headlines):** rewrote the State 2 ("Planning") and State 3 ("Compare scenarios") canvas-head h1s ahead of a real client meeting. The previous copy was editorial — the State 2 sentence-as-headline (`At Sarah's age 63, projected starting retirement income of R86 415 per month, in today's money.`) and the State 3 `The adjusted scenario vs. your baseline.` flourish — and read more like a magazine layout than a planning tool. Both are now plain section titles with the factual sentence demoted to the italic-serif sub-line.

- **State 2.** `<h1>` now reads `Retirement plan`. The sentence moved into the existing `.headline-sub` block, reworded to the user's spec: `<Name> retires at age 65 with R86 415 per month starting retirement income, in today's money.` Three bound spans inside (`#headline-anchor-name`, `#headline-age`, `#headline-income`); the latter two keep `class="num"` (mono + tabular-nums via the base rule). The `gold-under` accent on the income number is gone — the number's prominence now lives in the navy outcome cell directly underneath (34px serif on paper-white), which has been the visually loudest cell since Session 4 anyway. The capital reference (`The household reaches retirement with R 6.0m in combined capital, supporting a 5% drawdown before tax.`) is dropped; the `#sum-capital` outcome cell keeps it visible without the duplication.
- **State 3.** `<h1>` now reads `Compare scenarios`, with a new `.headline-sub` line: `Baseline locked. Move the levers below to test alternatives.` The compact head's `align-items: center` rule lets the canvas-actions cluster (Real/Nominal · Clear · Re-lock) keep its vertical centre against the now-two-line LH side without any layout work. The eyebrow above (`Scenario compare · baseline locked`) is unchanged.
- **JS cleanup.** `set('headline-capital', fmtShort(p.finalTotalReal));` removed from `updateSummary` — the DOM target is gone. `set` is null-safe so leaving it would have been harmless, but a dead call is a future-confusion magnet. The comment above the remaining two `set` calls now flags that the h1 is static and the bound numbers live in the sub-line.

**Decisions (and why):**

- **Drop `gold-under` from the income number, don't migrate it to the sub-line.** The accent was scoped via `.headline .gold-under` and would have needed a duplicate selector to work in `.headline-sub`. More importantly, gold-under at 16px italic-serif reads as fussy underline rather than a confident headline accent — the effect doesn't survive the size drop. The outcome strip's navy primary cell is already the visual anchor for the income number; the sub-line just has to confirm the figure factually.
- **Drop the capital reference from the State 2 head.** It duplicated the second outcome cell (`#sum-capital`) two lines below. In a meeting the client's eye lands on the chart and the outcome strip; making them parse the same number twice in two different fonts is friction.
- **State 3 sub-line is instructional, not descriptive.** "Baseline locked. Move the levers below to test alternatives." tells the client what's about to happen rather than what they're looking at, which matches the job that screen does in a meeting (the client *just* clicked Lock, the question is what now). A descriptive variant ("Baseline vs adjusted scenario, side by side.") would have been redundant with the eyebrow.
- **No CSS changes.** The existing `.headline-sub` rule (16px italic serif, mute, 22px bottom margin) and the compact-head's vertical centring both absorbed the new content cleanly. Adding compact-specific sub-line tightening would have been pre-emptive — revisit if the State 3 head looks heavy in the browser.
- **No tests added.** Both suites already passed and neither covers headline copy. JS tests assert structure (12 export pages, em-dash audits on narrative + export prose) and JS-level pure helpers; the canvas-head h1 is markup-and-copy with no logic underneath. Headline copy is the kind of thing that should be free to change without test churn.
- **Export deck untouched.** The user said "the planning and scenarios screen". The 12-page export deck is the *client deliverable* (different audience, different print path); its Cover and Answer pages keep their editorial Fraunces 82px / 40px headlines because those carry the document's voice. Touching them would have been scope creep.

**Tests:** 34 JS + 37 Python, all green.

**Docs updated:** `CLAUDE.md` session log (this entry), `docs/ARCHITECTURE.md` (Top-to-bottom canvas-head schematic + `updateSummary` description), `docs/DESIGN.md` (Three-states intro for Filled / Compare + typography scale entry for the new sub-line).

**Known caveat:** Visual verification needs a browser. Two things to eyeball: (a) State 2 — does the plain `Retirement plan` h1 over the italic sub-line read as confident rather than thin (concern: 44px Fraunces 300 with no number-emphasis underneath might feel under-weighted); (b) State 3 — does the compact head's added sub-line still read as compact (concern: two-line LH side could push the canvas-actions cluster out of vertical alignment on narrow viewports). Cmd+P preview also worth checking — the print rule shrinks the headline to 28px and the sub to 13px, which should be fine but is the kind of place a copy change can subtly break a layout.

### Session 11 — 2026-04-23

**Shipped (no-defaults-no-constraints):** the calculator no longer ships with pre-filled client numbers, and the age clamps are gone. Every client input (spouse ages, retirement age, four balances, four monthly contributions) renders blank until the adviser types. The 18-64 cap on spouse ages and the 50-75 window on retirement age are fully removed (HTML min/max/step, the `parseAge()` clamp, the `readInputs()` retirement-age clamp, the retirement-age blur snap-back, and the scenario-slider 50/75 clip). Market assumption defaults (5% return / 5% CPI / 5% escalation) and the horizon-minimum rule (`years = max(1, retirement_age − reference_age)`) are untouched.

- **HTML.** Stripped `value="…"` from `#hp-age-A`, `#hp-age-B`, `#retirement-age`, `#hp-ret-A/B`, `#hp-disc-A/B`, `#hp-ret-contrib-A/B`, `#hp-disc-contrib-A/B`, and the State 1 shadow retirement-age input (line 2071). Added `placeholder="—"` to all eleven. Removed `min="18" max="64" step="1"` from the two spouse-age inputs, `min="50" max="75" step="1"` from the retirement-age input, and `min="18" max="95" step="1"` from the generated capital-event age input template in `buildEventRow()`.
- **JS clamps.** `parseAge(id, fallback)` is now a straight `isFinite(n) ? n : fallback` — the 18 floor and 64 ceiling are gone. `readInputs()`'s retirement-age block reads the raw integer and falls back to 65 only when the field is truly blank (internal NaN backstop, invisible to the adviser). The `retirement-age` blur handler was snapping values back into 50-75; that clamp is deleted — the handler now just calls `refresh()`. `applyScenarioRetAge()` no longer `Math.max(50, Math.min(75, v))`s its input, and `configureScenarioSliders()` sets the retirement-age lever's `min`/`max` to `anchor ± SCENARIO_RETAGE_SPAN` without clipping to the old 50/75 window.
- **Blur preserves blanks.** The `hpInputs` blur handler (balance + contribution fields) used to convert an empty string into `"0"` on focus-out — an artefact of `parseFloat('') → NaN → n=0 → "0"`. It now returns early when the input is blank, leaving the placeholder `—` visible. Prevents the adviser from seeing "0" suddenly populate a field they merely tabbed through.
- **CTA gate.** New `updateSeeProjectionEnabled()` disables `#btn-see-projection` unless both `#hp-age-A` and `#hp-age-B` parse as finite integers. Wired to `input` events on both inputs (the State 1 shadow inputs already dispatch `input` on the canonical targets via `data-sync-to` blur) and called once at init. CSS: `.empty-cta .btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }` — matches the existing muted-button vocabulary. Retirement age, balances, and contributions can stay blank; the projection reads them as 0 (for money) or falls back to 65 (retirement age) internally.

**Decisions (and why):**

- **Keep `parseAge`'s fallback arg at 40 — internal NaN backstop, not a visible default.** Every `parseAge` call still passes `40` as the fallback. The HTML input is blank, so the adviser sees no pre-filled 40; the fallback only fires if rendering runs before the user has typed (e.g., `updatePlanBar` during the very first `refresh()`). Dropping the fallback entirely would have leaked `NaN` into the plan-bar, narrative, and compare surfaces, which then render as `"R NaN"` or `"age NaN"`. Fallback without visible default is the pragmatic middle.
- **`readInputs()` retirement-age fallback 65, not `max(ageA, ageB)+1`.** Considered making blank retirement age produce a 1-year horizon (so the projection visibly degenerates when unset). Rejected: the user chose "only require both spouse ages" for the CTA, which means blank retirement age is explicitly allowed to fire a projection. A silent 65 produces a sensible default horizon; a 1-year horizon would look like a bug. If the adviser wants retirement age gated, they can type it.
- **Remove event-age bounds (18/95) too.** User decision, consistent with "no constraints on any age input." Out-of-horizon events are already silently filtered by `project()`, so there's no math impact.
- **Preserve-blanks in `hpInputs` blur over "zero-out on blur".** The old behaviour was invisible when every field had a default; now that fields start blank, an adviser who clicks into an empty contribution field to inspect its state and clicks back out would have watched `—` flip to `0`. Not a bug, but a visible papercut. The fix is three lines and costs nothing.
- **CTA gate requires only the two ages, not retirement age or any balance/contribution.** User pick. A client with R0 and no contributions is a legitimate meeting starting point ("here's what you'd have if nothing changes"). Requiring a balance would deny that conversation.
- **No tests added.** The change is about HTML attribute removal, input-gating, and clamp removal — all orthogonal to `project()`'s math (which is what the Python audit suite covers) and to the JS-level pure helpers the Node runner tests. The test suites run against inputs constructed in fixture code, not DOM defaults, and the existing tests still cover every calculation that's affected.

**Tests:** 34 JS (unchanged) + 37 Python (unchanged), all green.

**Docs updated:** `CLAUDE.md` session log (this entry), `docs/ARCHITECTURE.md` (`readInputs` retirement-age fallback, `parseAge` clamp removal, scenario-slider range note, new `updateSeeProjectionEnabled` helper in §9 + §12), `docs/DESIGN.md` (Empty state CTA disabled semantics, Scenario-levers retirement-age range).

**Known caveats:**

- **In-State-2 blank-input handling.** An adviser who wipes a spouse-age field in the drawer while in State 2 will watch the projection fall back to `parseAge`'s 40-fallback — not error, but the number will shift silently. Meeting-floor impact is low (nobody blanks live inputs mid-conversation), but flagging here so the next adjustment is informed. A "hold last valid value" layer at the input level is the clean fix if it ever bites.
- **Scenario retirement-age slider reach is still ±10y.** The `SCENARIO_RETAGE_SPAN` constant is unchanged. If an adviser types a retirement age of 85 and locks a baseline, the scenario slider spans 75-95; they can't reach 65 without re-typing the canonical input. This matches the contribution slider's ±R30k window — it's a "refine, don't rethink" lever — but it does mean the widened input range doesn't fully translate to widened lever range. Acceptable for now; revisit if real meetings need it.
- **Visual verification in browser.** Opened in Safari at session end. Five states to eyeball: (a) fresh load — all client inputs blank with `—` placeholders, market assumptions still 5/5/5, CTA dimmed; (b) one age filled — CTA still dimmed; (c) both ages filled — CTA enables; (d) retirement age set to 85 — passes through, projection horizon updates; (e) CTA click with only ages filled — State 2 shows R 0 / mo and R 0 outcome strip (no NaN anywhere).

### Session 10 — 2026-04-23

**Shipped (tweak-pr-10):** three real-meeting follow-ups — a capital-events entry surface on State 1, an Export-deck layout fix that was collapsing "The Answer" page to blank, and a sharper green/red treatment for goal progress.

- **Capital events on State 1.** Adviser couldn't add events during the household-setup conversation — they had to click through to State 2, open the drawer, and fight the cramped column II. Added a new `.empty-events-panel` full-width block between the State 1 foot band and the "See current projection" CTA. Same `Capital events` eyebrow voice as the foot-band sections, same helper prose ("One-off inflows or outflows. Ages anchored to {name}'s age."), same `.events-list` / `.event-row` markup and styles the drawer uses. One shared `renderEvents()` now paints BOTH `#events-list` (drawer) and `#empty-events-list` (State 1) from the same `eventsStore`. The `+ Add an event` button in State 1 is wired to `#empty-add-event-btn` (does not force the drawer open — there's no drawer in State 1). The helper-prose `events-ref-spouse` span was promoted from an id to a class so both drawer + State 1 copies stay fresh; the two JS call sites that updated it now use `querySelectorAll('.events-ref-spouse')`.
- **Cross-container sync (one-way at state transition).** State 1 and the drawer are never both visible, so live per-keystroke cross-container sync is unnecessary. `onEventInput` continues to update the year-label inline (preserving focus). The `#btn-see-projection` CTA handler now calls `renderEvents()` before `refresh()`, so the drawer (which is about to become visible in State 2) is freshened with any events the adviser added in State 1.
- **Export Answer page collapsing to blank.** `.export-page[data-export-page="answer"]` declared `grid-template-rows: auto auto 1fr auto auto` (5 rows) against 7 children (topbar, eyebrow, h1, chart-card, outcome-strip, narrative, foot). The 2 unplaced children were auto-flowing into implicit rows, pushing total content past the 210mm print height; Chrome's print engine paginated the page across two physical sheets despite `overflow: hidden`, leaving physical page 2 blank and physical page 3 crammed with the chart + narrative + foot. Fix: dropped the `.export-narrative` block from the Answer page entirely (markup + CSS rules + `setBind('answer-narrative', ...)` call) and updated `grid-template-rows` to `auto auto auto 1fr auto auto` (6 rows). The narrative is retained on the State 2 portrait print (working-copy PDF), so nothing is lost from the overall output — it's just absent from the client-deliverable deck where the chart + outcome strip + headline carry the story.
- **Goal progress: binary green / red.** Session 9's "never red" constraint (gold-on-track / ink-2-behind) read too quietly in meetings. Swapped `.goal-progress-on-track` to `var(--pos)` (forest green `#2f6b3a`) and `.goal-progress-behind` to `var(--neg)` (rust red `#a64236`). Both at weight 500 for visual parity. Extended class-binding to three more surfaces that were rendering plain text: compare-card `#cmp-baseline-goal` + `#cmp-scenario-goal` (both wrap the % in a span), print-summary `#s-goal` cell, and the export-deck `answer-goal` slot. Plan-bar fact cell shows the goal AMOUNT not progress — skipped. Narrative `goalSentence()` is prose with `<strong>` emphasis — skipped (editorial voice).

**Decisions (and why):**

- **Shared `renderEvents()` + shared row markup over parallel State-1-specific HTML.** The row already uses `data-field` attributes (not IDs), and the event-delegation listener (`onEventInput` / `onEventClick`) is idempotent — attaching it to a second container just wires a second listener that closes over the same `eventsStore`. One visual style, one renderer, zero risk of the two surfaces drifting. The panel wrapper uses State 1's existing `.empty-foot-eyebrow` label so it reads like the other foot-band sections rather than the numbered drawer heads.
- **`events-ref-spouse` id → class.** Needed a second span in State 1 carrying the same text. Cheaper than a second id + a two-target update function.
- **Drop the narrative from the Answer page (not shrink the chart).** User decision. Tried shrinking the chart to fit 7 children, but doing that would kill the chart's visual weight on the deck's "headline answer" page. Dropping the narrative keeps the chart at 72mm and the page renders cleanly within 210mm. The narrative still lands in the working-copy portrait PDF, which is the internal document; the deck is the client deliverable where less copy is the right answer anyway.
- **Binary threshold, not three-tier.** User pick. The narrative already carries a three-tier prose variant (overshoot / near-miss / shortfall), which handles the tonal nuance of "you're close". The color signal is just the on-track / behind binary — simpler to scan at the primary outcome strip in a meeting.
- **Wrap the % in a span, don't color the whole value.** Rands stay neutral (the numbers are facts); only the "on track to 108% of target" / "covers 72% of target" phrase carries the traffic-light tone. Reads as a compact status badge rather than a loud metric.

**Tests:** 34 JS (28 + 6 new) + 37 Python, all green. New JS tests cover: `#empty-events-list` + `#empty-add-event-btn` + `.empty-events-panel` markup present; `renderEvents` iterates `[events-list, empty-events-list]`; `events-ref-spouse` is a class on 2+ spans and no longer an id; `#empty-add-event-btn` click handler pushes `newEvent()` + calls `renderEvents` + `refresh`; `.goal-progress-on-track` uses `var(--pos)` and `.goal-progress-behind` uses `var(--neg)`; compare-card / print / export-deck all wrap the % in a `goal-progress-*` span.

**Docs updated:** `CLAUDE.md` session log (this entry) + File inventory test count (28 → 34 JS), `docs/ARCHITECTURE.md` (renderEvents paints both containers, Answer page loses narrative slot, goal-progress class binding extended), `docs/DESIGN.md` (empty-state capital-events panel, outcome-strip goal-progress note swapped to green/red, compare-card + export-deck goal note updated, Answer page narrative removed).

**Known caveats:**

- **Visual verification pending.** Four matrices to eyeball: (a) State 1 with 2 events — panel shows between foot band and CTA, rows render as in the drawer; (b) CTA click → State 2 drawer shows the same 2 events (sync via `renderEvents()` pre-refresh); (c) outcome-strip sub-line shows green when projected ≥ goal, red when below; (d) Export report → physical page 2 is "The Answer" with all 6 children visible, physical page 3 is "Household" (no spill-over).
- **Focus-on-edit.** Typing in State 1's events list updates only the year label inline — the drawer's copy stays stale until state transition (where `renderEvents()` refreshes it). This is intentional to preserve focus during typing; since the drawer isn't visible in State 1, the stale DOM is invisible.

### Session 9 — 2026-04-23

**Shipped (design-tweaks-pr9):** two targeted tweaks surfaced from real-meeting use — a placeholder bug in the State 1 title plate, and a new household income-goal input that drives a progress readout across States 2/3, print, and the export deck.

- **Family-name placeholder bug fixed.** State 1 title was `A plan for the _______ family.` with the bracketed portion (including `the` and `family`) inside a single `contenteditable` span (`#family-name`). On focus the handler cleared the span, so when the adviser typed "Nkosi" the word "family" vanished and the editorial template collapsed to `A plan for Nkosi.`. Restructured: the span now holds ONLY the editable surname (placeholder `_______`), with `A plan for the` as static text before the span and `family.` as static text after. Rewrite of `wireFamilyName` dropped the `strip('the '|' family')` regex defensiveness it no longer needed — `client-name` now stores the bare surname directly, which is exactly what `deriveFamilyName()` returns elsewhere.
- **CSS polish on `.empty-family`:** added `white-space: nowrap` so a long surname doesn't line-wrap the static `family.` suffix off the edge.
- **New household income goal.** Added a single canonical input `#income-goal` (monthly rand, today's money, pre-tax) that:
  - lives under a new **V. Household goal** drawer head in col II (right after Capital events);
  - is shadowed in State 1 by a new full-width `.empty-foot-goal` row below the Retire-when / Market-assumptions grid, styled with the same dashed editorial pill as the balance fields (`data-sync-to="income-goal"`);
  - extends `readInputs()` with an `incomeGoal` field; `project()` is untouched (goal is rendering-only).
- **Default: blank.** User decision — forces the adviser to enter the household's goal during every session rather than anchoring on a number. All downstream surfaces guard on `hasGoal = incomeGoal > 0`.
- **New `[data-goal-active]` hide pattern.** Any element carrying `data-goal-active="false"` is hidden via `[data-goal-active="false"] { display: none !important; }`. Toggled on/off by `setGoalActive(id, bool)` in every renderer. Avoids sprinkling individual `display: none` rules; one CSS declaration, many consumers.
- **Progress readout wired to every surface:**
  - **State 2 outcome strip** — primary cell gains a second sub-line `Goal R 80 000 / mo · on track to 108% of target`. Percent picks up the `goal-progress-on-track` (gold) or `goal-progress-behind` (ink-2) class at the 100% threshold. Never red — motivational tone.
  - **State 3 compare cards** — a fifth meta-row (`Goal progress · 108% of R 80 000`) on both baseline and scenario cards. Scenario's row carries a `pp` delta via the existing `setMetaDelta` helper (extended with a new `'pp'` kind that formats e.g. `+12 pp`). Both cards read against the *current* goal, not a baseline-frozen snapshot — goal is an adviser-level discussion point, not an assumption locked with `scenarioAnchors`.
  - **Plan-bar** — 6th fact cell `Income goal · R 80 000`, hidden until set. `.plan-bar-row`'s flex layout absorbs the extra cell with no layout work.
  - **Narrative** — a new `goalSentence(projectedIncome, goal)` helper returns three variants (overshoot / near-miss / shortfall), added to `describeCurrentPosition` after the 5% drawdown sentence. Em-dash-free by construction. Not added to `describeBaselinePosition` / `describePlannedScenario` since State 3's narrative is hidden by `data-view-only="filled"` and the compare cards already carry the progress visually.
  - **Print summary** — new `s-goal-row` between income and total-contrib, carrying `data-goal-active="false"` so it drops out of the appendix when unused.
  - **Export deck page 2 "The Answer"** — primary outcome-cell gains a second `.export-outcome-sub` bound to `answer-goal` with the same guard. No new page, no layout reshuffle.

**Decisions (and why):**

- **Goal is rendering-only, not an input to `project()`.** A target doesn't change the projection — the projection produces a number, and the goal compares against it. Keeping `project()` untouched preserves the Python audit contract (37 tests still pass unchanged) and makes the goal easy to suppress cleanly when not set. If a future change wants to, say, solve for "what contribution rate hits the goal", that's a separate derived computation, not a modification to `project()`.
- **Full-width row in State 1, not a third column.** User choice (preview-selected). The two existing columns (Retire-when / Market-assumptions) are already tight; a third would have crowded both. A dedicated row below reads as a deliberate "set your target" step and mirrors the editorial voice of the household-goal drawer head.
- **Blank default, not R60 000.** User choice. Every adviser meeting starts with a fresh goal conversation; a default would anchor the conversation (positively or negatively) before the household has weighed in. The blank-guarded rendering means a fresh page load looks exactly like it did before this session, until a goal is typed — zero regression risk for advisers who never use the feature.
- **Baseline and scenario compare cards both read against the current goal.** Alternative was to freeze goal with the baseline (store `incomeGoal` in `scenarioAnchors` on lock). Rejected: the goal is an adviser-level conversational target, not a plan assumption; a baseline lock with a different goal would produce "108% vs 110%" readings on the baseline card that don't correspond to anything the adviser cares to defend. Using the current goal gives both cards the same yardstick, which is what "goal progress" should mean.
- **`setMetaDelta` extended with a `'pp'` kind instead of a new helper.** Three lines. The threshold (|delta| < 1pp → empty) matches the existing pattern for currency/years/pct.

**Tests:** 28 JS (21 + 7 new) + 37 Python, all green. New JS tests cover: static `family.` suffix lives outside the editable span; canonical `#income-goal` input + sync + all consumer IDs present; `readInputs` returns `incomeGoal`; `goalSentence(projected, 0) === null`; `goalSentence` variants (overshoot / near-miss / shortfall) include expected phrases and have no em-dashes; `describeCurrentPosition` includes the goal sentence when set and omits it when blank.

**Docs updated:** `CLAUDE.md` session log (this entry) + File inventory test count (21 → 28 JS), `docs/ARCHITECTURE.md` (readInputs +1 field, rendering-function list, new data-goal-active pattern), `docs/DESIGN.md` (Empty state section for `.empty-foot-goal`, goal progress treatment on outcome strip + compare cards + plan-bar).

**Known caveats:**

- **State 1 shadow input shows raw typed value.** Existing pattern for all State 1 shadow inputs — they propagate to the canonical input, which formats on blur (e.g., "60000" → "60 000" in the drawer), but the State 1 field itself keeps whatever the user typed. Consistent with the balance fields. If it becomes a meeting-floor papercut, a `refreshEmptyFields()` mirror-back would be a few lines.
- **Visual verification pending.** Opened in a browser is the authoritative check. Four states to eyeball: (a) State 1 with blank goal — progress line absent on outcome strip; (b) State 2 with goal 80k and R86k projected — "on track to 108%" in gold; (c) State 2 with goal 120k — "covers 72%" in ink-2; (d) State 3 with goal set — both compare cards show the goal-progress row and scenario shows the `±pp` delta. Cmd+P and Export report should both carry the goal line when set and omit it cleanly when blank.

### Session 8 — 2026-04-23

**Shipped (export-design-change):** a 12-page A4-landscape "Export report" deck folded into the calculator as an opt-in print mode. Triggered by a new plan-bar button; coexists with the existing portrait print path without touching it.

- **Design brief.** `export/` folder (handoff bundle with `Retirement Report.html` + `deck-stage.js` + `report-data.js`) specified a 12-slide client-facing deck. Rejected the bundle's integration contract (`localStorage['sw-calc-snapshot']` + `window.open()` to a sibling HTML file) on two grounds: (a) the bundle's `report-data.js` re-implements `project()` from scratch, which is a silent-regression trap directly at odds with CLAUDE.md's "math is auditable" rule; (b) three files with a `window.open()` dependency breaks the `file://` single-file model that lets the adviser email the calculator. Folded the deck into `retirement_accumulation.html` instead. Zero math duplication.
- **Architecture.** `data-export-mode="true"` on `#calc-root` swaps screen layout to show `.export-deck` and hide everything else. `<html class="export-printing">` plus a dynamically-injected `<style id="export-page-sheet">@page { size: A4 landscape; margin: 0; }</style>` supply the page-size override only for this print pass. Normal Cmd+P and the canvas-foot Print/PDF never touch either gate, so the existing portrait `@media print` rules remain authoritative for the working-copy flow.
- **Button placement.** Plan-bar top row, next to `Edit plan ↓`. `.btn.ghost` styling. Automatically hidden in State 1 by inheritance from `.plan-bar[data-view-only="filled+compare"]`.
- **Pages.** Cover (family name, prepared-for, FSP 50637) · The Answer (real stacked chart + outcome strip + `describeCurrentPosition` narrative) · Household (two-spouse editorial grid) · Assumptions (editorial table + aside note) · Projection (nominal stacked chart + starting/real/nominal strip) · Breakdown (3-layer decomp chart + 3 slab cells) · Capital events (conditional on `eventsStore.length > 0`) · Compare (conditional on `baseline`, two cards with shared y-ceiling + delta chip) · Year-by-year table (every 5th year + retirement row highlighted) · Methodology · Compliance · Next steps.
- **Charts.** 5 dedicated new `<canvas>` elements (`export-chart-answer`, `export-chart-projection-nom`, `export-chart-breakdown`, `export-chart-compare-baseline`, `export-chart-compare-scenario`). Built fresh on button click, destroyed on `afterprint`. Rationale: screen canvases are sized for State 2/3 cards (~280–1000px); landscape A4 content area is ~1588×1123px; the print-time `chart.resize()` pattern on live screen instances is the exact fragile path that burned Session 2/3. Dedicated instances sidestep that entirely.
- **Conditional pages + renumbering.** `.export-page[data-export-page-active="false"] { display: none; }` hides events/compare when inactive (both screen and print). `renumberExportPages()` walks visible pages and assigns roman numerals + `NN / TT` page counts so the document always reads as a coherent sequence regardless of which conditionals fire.
- **No math duplication.** Every number in the deck reads from `lastProjection` / `baseline.p` / `eventsStore` / `spouseNames` / hidden meta inputs (`#client-name`, `#client-date`, `#adviser-name`). All formatting through existing `fmtR` / `fmtShort` / `fmtPct`. Narrative slots on the Answer page reuse `describeCurrentPosition(p)` verbatim; Compare page reuses `describeBaselinePosition` + `describePlannedScenario` (all three already em-dash-compliant per existing JS tests).
- **Defensive rAF-double.** `startExport()` calls `buildExportDeck` + `buildExportCharts` synchronously, then does `requestAnimationFrame(function(){ requestAnimationFrame(window.print); })`. The double rAF gives the browser two frames to flush layout so Chart.js measures the visible (landscape-sized) canvases, not pre-export screen dimensions.
- **New helpers.** `toRoman(n)`, `deriveFamilyName(clientName)` (takes last whitespace token, e.g. "Thabo & Amara Nkosi" → "Nkosi"), `escapeHtml(s)`, `setBind(name, html)`, `setBindText(name, txt)`, `renumberExportPages()`, `populateEventsPage(p, events)`, `populateComparePage(p, bline)`, `populateYearTable(p)`, `padSeries(s, n)` (pads a shorter baseline series with its last value so the two compare charts share an x-axis).
- **FSP number.** Bundle's README flagged `[FSP# — TBC]`; calculator already hard-codes FSP 50637 at line 1765 (existing disclaimer). Reused that throughout the deck (cover-page FSP cell, compliance page FSP mention, closing page foot).
- **Family-name source.** `deriveFamilyName()` reads `#client-name` and takes the last token. Not perfect for compound surnames like "van der Merwe" — flagged as an open question in the plan but good enough for the Pillay / Nkosi / Khumalo common cases. If it bites a client, promote `#family-name` (the State 1 editable span) to a persisted hidden input and have the cover bind to that instead.

**Decisions (and why):**

- **In-calculator print mode over separate static bundle.** User confirmed the single-file + folded approach after I outlined three architectures. The deciding factor was CLAUDE.md's "math is auditable" rule, combined with the practical reality that the adviser emails this file to clients — a second HTML file wouldn't travel.
- **A4 landscape, not portrait.** User chose landscape to match the bundle's deck-stage design (1588×1123 px). Existing portrait `@media print` rules stay for the working-copy flow.
- **5 dedicated export canvases over reusing screen canvases.** See Charts note above. Memory is cheap; fragility is expensive.
- **Inline @page injection over named pages (`page: identifier`).** Browser support for named page references is patchy and the failure mode (silently defaulting to browser page-size) would have been hard to diagnose in the field. Injecting a `<style>` with an unconditional `@page { size: A4 landscape }` gives bulletproof behaviour; removing the `<style>` on `afterprint` preserves the portrait path. Tested pattern.
- **Events page as a list, not a timeline.** The reference design had an age-axis timeline with above/below event labels. Skipped: timelines need ~100 lines of positioning CSS and read less clearly in monochrome PDF print. A tabular list with kind-badge/age/year/basis/amount columns is cleaner for the adviser's use case (client scans, asks "what's this one?", adviser explains).
- **Dual Print/PDF buttons, both retained.** Canvas-foot Print/PDF (portrait, internal working copy) and plan-bar Export report (landscape, client deliverable) answer different questions. Collapsing them into one would force the adviser to choose at the wrong moment.
- **Em-dash audit via zone-scoped regex, not whole-file.** Static copy on methodology / compliance / next-steps / assumptions aside scans em-dash-free. Placeholder text like `R —` (will be overwritten by `setBindText` at runtime) and `<span data-bind="...">——</span>` (ditto) are stripped before scanning. The spirit of the rule — "no em-dashes in what a client reads" — is preserved; the letter of the rule would false-positive on placeholders.

**Tests:** 21 JS (14 existing + 7 new) + 37 Python, all green. New JS tests cover: `toRoman` correctness, `deriveFamilyName` extraction, `escapeHtml` presence, 12-page + 2-conditional deck structure, export-mode gating (button + canvases + `@page` injection + `teardownExport` wiring), static prose em-dash audit, assumptions-aside em-dash audit.

**Docs updated:** `CLAUDE.md` session log (this entry) + File inventory test count (14 → 21 JS), `docs/ARCHITECTURE.md` (new §13 Export deck, plus entry in Top-to-bottom page structure), `docs/DESIGN.md` (new Export deck section after Print).

**Known caveats:**

- **Visual verification pending.** Opened in a browser is the authoritative check. Four matrices to eyeball: (no events, no baseline) = 10 pages; (events, no baseline) = 11; (no events, baseline) = 11; (events + baseline) = 12. Also: Cmd+P without clicking Export must still produce the existing portrait output (regression check).
- **Font fallback under headless print.** Existing exposure; magnified by landscape hero type. If `--headless --print-to-pdf` ever becomes part of CI, an inline Fraunces subset would be worth adding. Not required today.
- **Long first names.** Household card headings (serif 30px) assume names up to ~20 chars. Names like "Christopher-James" may crowd. A defensive `font-size: clamp(...)` could absorb this if it bites.

### Session 7 — 2026-04-23

**Shipped (feat/session-7):** wider State 3 scenario sliders, a reworded State 2 headline, and a cleaner State 1 with the appendix no longer hanging off the bottom.

- **Scenario slider ranges widened.** `SCENARIO_CONTRIB_SPAN` 10 000 → 30 000 (±R30k each side of baseline, step R500 unchanged). `SCENARIO_RETAGE_SPAN` 5 → 10 (±10y, still clamped inside `#retirement-age`'s 50–75 bounds). Real-meeting feedback: clients routinely ask "what if we added R25k?" or "what if we retired early?" and the ±R10k / ±5y windows were too narrow to reach those conversations.
- **Return slider: fixed 0-15% scale.** Dropped the `SCENARIO_RETURN_SPAN` constant entirely. `configureScenarioSliders()` now sets `scenario-return` to `min=0 max=15 step=0.5` unconditionally, with the thumb initialised at the baseline percentage. The scale is macroeconomic (0% is a crisis floor, 15% is aggressive equity) so thumb position has a constant, across-client meaning rather than a client-specific ±2 pp window.
- **Return readout shows baseline inline.** `setScenarioReadout`'s `percent` branch now writes `"X.XX%  ·  baseline Y.YY%"`. The delta pill (signed offset, green/red) stays. At baseline the readout reads e.g. `"10.00%  ·  baseline 10.00%"` with no pill; off-baseline it reads `"7.50%  ·  baseline 10.00%   −2.50%"`. Chose inline annotation over a visual tick mark on the track because the mono readout cell has the room and the text is unambiguous (asked the user; they picked the text-label option).
- **Canonical `#return` and `#empty-return` widened to `min=0 max=15`.** The scenario slider's `applyScenarioReturn` clamps the written-back value against the canonical input's min/max. Without widening, moving the scenario thumb below 3% would silently clamp to 3% — a dead zone. Widening both the drawer and State 1 shadow slider to `min=0` keeps the full stack consistent. Defaults unchanged (5%).
- **State 2 headline reworded.** Was: `At 63, R86 415 a month — comfortably, at today's prices.` Now: `At [anchor-spouse-name]'s age 63, projected starting retirement income of R86 415 per month, in today's money.` User wrote "projected started" in their message; tweaked to "starting" on the assumption that was intended — happy to flip if wrong. The `<em>comfortably</em>` flourish is gone (it read as copywriting, not a fact); the `gold-under` accent on the income number stays.
- **`resolveAnchorSpouseKey()` helper extracted.** Session 6's `updateAnchorChips()` computed which spouse matches the current anchor rule inline. Pulled that into a standalone helper so `updateSummary()` can also call it to write the anchor spouse's name into `#headline-anchor-name` on every refresh. `updateAnchorChips()` now delegates to the helper — no behaviour change on the empty-state chips.
- **`.print-summary` gated to State 2/3.** Added `data-view-only="filled+compare"` to the `#print-summary` container. In State 1 the "Summary of assumptions and outcome" heading + three closed accordion rows were dangling below the dashed preview / CTA; they now disappear in the empty state and reappear once a projection is requested. `updateViewVisibility()`'s substring match handles the multi-view attribute value with no JS changes.

**Decisions (and why):**

- **Direct write to `#headline-anchor-name` over extending `renderSpouseLabels()`.** The session-6 template system is good when multiple places in the DOM need the same spouse-name formatting. The headline anchor-name is one span in one place, and "which spouse" depends on the anchor rule + ages rather than a fixed `data-spouse="A|B"` binding. Using the existing template machinery would have meant re-pointing the span's `data-spouse` attribute on every refresh and adding a new template case — more moving parts for no reuse benefit. Direct `el.textContent = spouseNames[anchorKey]` in `updateSummary()` is one line.
- **Kept `applyScenarioReturn`'s clamp against `#return.min/.max`.** Now that those are 0 and 15, the clamp produces the same result as the slider's own `min="0" max="15"` attributes — redundant but defensive if the underlying input ever narrows again. Didn't remove.
- **Contribution floor clamp (`Math.max(0, …)`) kept.** With ±R30k, low-baseline households (e.g. R5 000 total retirement contribs) now have an asymmetric range (0 to R35 000). Acceptable: moving the slider left runs out at R0 with a visible `−R5 000` delta chip, which correctly surfaces "can't contribute negative amounts". Symmetric would require allowing negatives, which is nonsense.
- **No math changes, no test changes.** `project()` and its return shape untouched. 37 Python + 14 JS green both before and after.

**Tests:** 14 JS + 37 Python, all green.

**Docs updated:** `CLAUDE.md` session log (this entry), `docs/ARCHITECTURE.md` (§8 Scenario sliders — new range numbers + the return-baseline annotation), `docs/DESIGN.md` (Scenario-levers section — ranges and the fixed 0-15 return scale).

**Known caveat:** Visual verification needs a browser. Opened `retirement_accumulation.html` in Safari at the end of the session; static JS parse + tests pass, but the headline readability (does "At Sarah's age 63, projected starting retirement income…" scan well in Fraunces 44px?), the return-slider readout fit (`7.50%  ·  baseline 10.00%   −2.50%` in mono 12px at 4-column and 2-column responsive), and the State 1 foot-of-page cleanup all want an eyeball.

### Session 6 — 2026-04-23

**Shipped (feat/session-6):** three State 1 refinements that emerged from real-meeting feedback on image 7.

- **Field labels.** "Monthly retirement" → "Monthly retirement contributions" and "Monthly discretionary" → "Monthly discretionary contributions" in both spouse columns. Balance labels unchanged (they aren't contributions).
- **Retire-when row.** The fixed `Retire when the youngest reaches [65]` copy is gone. The foot-band left now reads `Retire when [Sarah] · [Tom] reaches [65]`, where the two names are clickable `.empty-name-chip` buttons wired through `renderSpouseLabels()` (new `chip` template) and `spouseNames`. Clicking a chip resolves "which spouse did you click, and which is currently younger?" and delegates to the existing `setAnchor()` path, so the drawer's Youngest/Oldest toggle stays in sync. The internal anchor model stays `'youngest' | 'oldest'` — no ripple into Python or JS tests.
- **Market-assumptions slider row.** The hardcoded `10% · 5% · 6%` readout is gone. The foot-band right now holds a 3-row grid of thin sliders (Return / CPI / Escalation), each with `data-sync-to="return|cpi|esc"` and a mono readout (`#empty-return-out`, `#empty-cpi-out`, `#empty-esc-out`). A new branch in the sync wiring listens for `input` on any `input[type="range"][data-sync-to]` and pipes the value through to the canonical input + dispatches `input` so the normal refresh pipeline fires. `updateSliderLabels()` mirrors the canonical values back into the three new readouts AND into the three shadow-slider thumbs (skipping whichever is currently focused, so dragging a drawer slider doesn't fight the user's drag on a State 1 slider).
- **Defaults.** `#return` default 10 → 5. `#esc` default 6 → 5. CPI stays at 5. The plan-bar fact cell and all downstream projections pick this up automatically since they already read from the canonical inputs. No math changes in `project()`. Tests still pass because both suites build explicit inputs rather than reading DOM defaults.
- **New CSS.** `.empty-name-chip` (+ `.is-on` with a 2px `--gold-2` text-underline and 6px offset, muted `--mute` when off), `.empty-foot-reaches` (serif "reaches" word between chips and age input), `.empty-assump-grid` / `.empty-assump-row` / `.empty-assump-label` / `.empty-assump-val` (3-col grid with `display: contents` on the row so the label, slider, and readout align directly in the outer grid).
- **New JS.** `updateAnchorChips()` runs on every `refresh()` next to `renderSpouseLabels()` — reads the two ages, computes "who is younger today" (ties to A), and sets `.is-on` on whichever chip matches the current `anchor` rule.

**Decisions (and why):**

- **Keep `anchor` as `'youngest' | 'oldest'` internally rather than switching to `'A' | 'B'`.** Spouse A/B is simpler UI semantics, but it would have rewritten the Python `conftest.py` fixture (`anchor='youngest'`) and four anchor tests, plus reshaped the drawer Youngest/Oldest toggle. The rule-based anchor is still correct — the UI change is cosmetic (show the name, not the rule). The chip click derives the rule from the click + current ages. Zero test churn.
- **`display: contents` on `.empty-assump-row` (a `<label>`).** Lets the label, slider, and readout participate as direct children of the outer 3-column grid without an extra wrapper box. Native `<label>` focus-on-click still works because that's a semantic relationship, not a visual-box one.
- **All three assumptions default to 5%.** Requested explicitly. The adviser's instinct is that 10% nominal return makes the default projection land too optimistically for first-meeting framing. 5/5/5 forces a 0% real return before escalation — conservative enough that every number the adviser touches thereafter looks *better* than the default.
- **Shadow-slider sync is bi-directional but position-only, not event-driven.** The State 1 slider's `input` event pushes into the canonical input and fires canonical-side listeners. `updateSliderLabels()` (called every refresh) reads the canonical value and writes it back into the shadow thumb *unless the shadow is focused* — preventing a feedback fight during drag. The canonical drawer slider similarly updates from `refresh()` reading its own value. Clean loop with no duplicate refreshes.
- **Chip styling in serif, not sans.** The chips read like proper names in the "A plan for the ___ family" headline voice — editorial first, functional second. Switching the chips to a sans pill would break the title-plate feel.

**Tests:** 14 JS + 37 Python, all green. No math changes — `project()` and its return shape are untouched.

**Docs updated:** `CLAUDE.md` session log (this entry), `docs/ARCHITECTURE.md` (renderSpouseLabels templates + new updateAnchorChips + updateSliderLabels extension + range-input sync branch), `docs/DESIGN.md` (Empty-state section: retire-when chips and market-assumption slider grid).

### Session 5 — 2026-04-22

**Shipped (feat/session-5):** State 1 → State 2 transition is now gated behind an explicit "See current projection" CTA. The old heuristic (non-default spouse name + positive balance + valid retirement age) fired as soon as the adviser typed a name and tabbed out, which was too eager for meeting flow.

- **New flag.** `var projectionRequested = false;` added next to `spouseNames`. One-way — once true it stays true for the session. Not reset by `clearBaseline()` (clearing a baseline returns to State 2, not State 1).
- **`deriveViewState()` simplified** from the old name/balance/age check to: `baseline → compare`, `projectionRequested → filled`, else `empty`. Typing in State 1 no longer transitions — only the CTA click does.
- **DOM.** The dashed `.empty-preview` placeholder ("The projection will appear here") at the bottom of `<section class="canvas-empty">` is replaced by a centred `.empty-cta` containing `<button class="btn primary" id="btn-see-projection">See current projection</button>`.
- **CSS.** Dropped dead `.empty-preview` / `.empty-preview-label` rules. Added `.empty-cta { display: flex; justify-content: center; padding: 32px 0 8px; }` and `.empty-cta .btn.primary { padding: 12px 28px; font-size: 13px; }`. Added `.empty-cta` to the `@media print` hide list alongside `.canvas-actions` / `.canvas-foot-actions`.
- **Wiring.** Added next to the baseline button handlers: on click, set `projectionRequested = true` and call `refresh()`.

**Decisions (and why):**

- **Button always enabled, no data gate.** Balance defaults are already non-zero (R1.5M / R500k / R1.2M / R300k) so clicking with no user input still produces a sensible projection. The adviser can continue editing via the plan-bar drawer in State 2. Simpler than gating on "at least one name" or "at least one balance", and keeps the button's behaviour predictable (no greyed-out-until-something state).
- **CTA replaces the dashed preview entirely.** Once an explicit CTA exists, the "The projection will appear here" placeholder is redundant. Cleaner visually and one fewer block to style.
- **One-way flag, not reset by baseline-clear.** If the adviser locks a baseline and then clears it, they return to State 2 rather than being bounced back to State 1. Lock/clear is a within-projection flow; State 1 is a one-time intro.
- **Dropped the old name/balance/age check entirely rather than keeping it as a safety net.** Once the user has explicitly asked for the projection, respect that — don't re-apply heuristics that could refuse to transition. Defaults ensure the projection always renders something.

**Tests:** 14 JS + 37 Python, all green. No math changes — `project()` and its return shape are untouched; `deriveViewState()` isn't exercised by either suite.

**Docs updated:** `CLAUDE.md` session log (this entry), `docs/ARCHITECTURE.md` (state-derivation snippet + state-variable listing), `docs/DESIGN.md` (three-states intro + Empty-state section).

### Session 4 — 2026-04-22

**Shipped (design-update-pr4):** full visual redesign of the calculator. The rail + cluttered canvas layout is gone; in its place, a single-tree three-state UI driven by `viewState`.

- **Tokens + fonts.** Palette swept to the new `--ink / --paper / --navy / --gold` system from `design/hifi-calc.css`; warm paper stays (new value `#faf7f0`), navy shifts slightly (`#1f2d3d`), teal retires. Fraunces / Inter Tight / JetBrains Mono loaded via Google Fonts `<link>` in `<head>`. All inline CSS references migrated in one sweep — no alias shim kept.
- **Three states, one tree.** Root `<div class="calc" data-view="empty|filled|compare">` wraps everything. `deriveViewState()` reads `baseline`, balances, spouse names, retirement age; `updateViewVisibility()` toggles `display` on every `[data-view-only]` node. The derivation runs first in `refresh()` so chart builds see correct visibility.
- **State 1 (empty).** Title-page setup: `A plan for the ___ family.` with an inline editable `#family-name` span, centred serif 44px / Fraunces 300. Two-column spouse setup separated by a 1px divider, step labels (`I.` / `II.` italic gold roman numerals). Four `field-input.empty` pills per spouse (dashed border, `R` prefix). Foot band with retirement-age input + market-assumptions readout. Dashed preview placeholder. State 1 inputs are shadow inputs — they carry `data-sync-to` attrs and write to the canonical `#hp-*` inputs on blur.
- **State 2 (filled).** Plan-inputs bar with 5 fact cells (Household · Combined starting capital · Monthly contributions · Retire at · Return · CPI) and a three-column drawer (Household / Retirement+Events / Market+Meeting) toggled by `Edit plan ↓`. Editorial headline with `gold-under` accent on the income number. Chart card with Capital/Breakdown/Table segmented seg; three-cell outcome strip (navy-filled primary cell for Monthly income); narrative with gold vertical rule; canvas foot with Table view + Print/PDF.
- **State 3 (compare).** Compact canvas head with Real/Nominal + Clear + Re-lock. Two-up `.compare.big` grid: baseline card (paper-2 background, muted hero in `--ink-2`) next to scenario card (white with a navy ring box-shadow, navy hero). Each card carries its own Chart.js instance (`#chart-compare-baseline` at 35% opacity, `#chart-compare-scenario` at full). Both use a shared y-ceiling so bars compare visually. Scenario card's head shows a gold `+ R N / mo` delta chip; meta rows carry inline gold deltas. Scenario levers (4 thin sliders) sit below the grid in a separate card. Narrative is suppressed in State 3 — the compare cards are the narrative visually.
- **Chart restyle.** Gold `#b8893c` discretionary on the bottom, navy `#1f2d3d` retirement on top (reversed from the teal/gold order that shipped in Session 3). Breakdown view colours also retuned (lighter/darker greys + gold). Y-axis labels in JetBrains Mono. Baseline-overlay dashed line removed from the main capital chart — State 3 replaces that entire idea.
- **Print.** Drawer forced closed in print. Outcome strip + chart card + compare cards each get `page-break-inside: avoid`. `.scenario-levers` and `.canvas-foot-actions` hidden. Chart heights retuned down (260px main / 220px compare). `resizeChartsToWrap()` generalised to iterate all three chart containers. Accordion-forced-open + matchMedia handlers unchanged.

**Decisions (and why):**

- **Google Fonts over self-hosted or system-fallback.** Asked the user between (a) Google Fonts link, (b) self-hosted WOFF2, (c) system fonts. User chose (a). Tradeoff: one extra external runtime dep, but Fraunces / Inter Tight / JetBrains Mono carry the design's voice — dropping them to system fonts would lose most of the editorial feel.
- **Palette sweep, no alias shim.** Old token names (`--brand`, `--ink-muted`, `--surface-alt`, `--teal`, `--line-strong`, `--radius`, `--radius-lg`, `--success`, `--danger`) deleted outright. ~60 CSS references migrated in one pass. The sweep produces a larger diff but leaves a clean token vocabulary going forward.
- **Token values from `hifi-calc.css`, not the README table.** The README's token table differed in several spots from the CSS file (`--faint`, `--line`, `--hairline`, `--navy-soft`, `--gold`, `--gold-2`). Used the CSS values because they were the rendered reference — the README table was the summary, not the source of truth.
- **Internal `mode` var kept as `'pv'/'fv'`.** UI labels changed to "Real" / "Nominal" per spec, but the internal variable keeps its original name so the JS test harness (which extracts by symbol name) doesn't break.
- **Single `.calc` tree with `data-view-only` instead of three separate pages.** The spec specified this explicitly: "All three share the same full-width canvas frame". Visibility is a single JS pass over `[data-view-only]` nodes — no duplicated markup, no per-state mounts.
- **Both `#btn-pv`/`btn-fv` pairs exist as siblings in the DOM.** One pair lives in the State 2 canvas-head, the other in the State 3 compact canvas-head. Only one is visible at a time via `data-view-only`. `setMode` updates class state on all four so toggles stay in sync regardless of which is visible. Simpler than trying to relocate one button set across views.
- **Table view folded into the chart-card slot.** Previously the year-table lived in the same `.chart-wrap` as the canvases and was toggled via `display`. Kept this pattern — State 2's chart-card now has Capital / Breakdown / Table as three visual modes of the same slot, matching the spec.
- **Compare-card charts as two independent Chart.js instances.** Simpler than trying to render two datasets on one chart with faded/solid alphas. Shared y-ceiling (`Math.max(bSeries.total, pSeries.total) * 1.05`) preserves visual comparability.
- **`data-sync-to` pattern for State 1 → canonical input sync.** Empty-state inputs don't share IDs with the drawer inputs (IDs must be unique). Instead, each State 1 input carries `data-sync-to="hp-ret-A"` and a blur handler writes its cleaned value into the canonical input, then fires `input` + `blur` events so the normal formatting + refresh pipeline runs. One-way sync (State 1 → canonical) is sufficient because the user never returns to State 1 after the plan is complete.
- **Family-name editing strips "the" and "family".** The title-plate span reads "the Pillay family" after editing, but writes just "Pillay" (or whatever the bare name is) into `#client-name` so the print summary doesn't say `Prepared for: the Pillay family`. Regex: `^the\s+/i`, `\s+family$/i`.
- **Outcome-strip baseline delta lines removed.** The State 2 cards no longer carry `Baseline X · ±delta` rows — in State 3 the compare cards handle that job visually, and in State 2 there is never a baseline (derivation routes lock → compare). Simpler code, cleaner cards.

**Tests:** 14 JS + 37 Python, all green. No math changes — `project()` and its return shape are untouched.

**Known caveat:** Visual verification requires a browser. Static checks (parse, ID resolution, div balance) + test suite cover correctness of the math/narrative layer; the headline numbers, chart colours, compare-card alignment, and print preview need an eyeball. Opened in Safari at the end of the session but didn't produce screenshots.

### Session 3 — 2026-04-22

**Shipped:**
- Chart in the PDF now renders at full card width. Root cause was the `matchMedia('print')` handler calling `chart.resize()` synchronously, before the print `@media` CSS had flowed into layout — under headless `--print-to-pdf` the resize ran against pre-print parent dimensions, leaving the bitmap undersized. Fix: new `resizeChartsToWrap()` helper that defers into `requestAnimationFrame`, reads `.chart-wrap` `clientWidth`/`clientHeight`, and calls `chart.resize(w, h)` with explicit dimensions. Used by both the `beforeprint` and the `matchMedia` handlers (and `afterprint` for restore).
- Narrative rewritten to two sections when a baseline is locked — BASELINE POSITION + PLANNED SCENARIO — and a single CURRENT POSITION section when no baseline is locked. Plain English prose, sign-aware (`more`/`less`, `rises`/`falls`). Per-spouse contribution split dropped from the narrative; events still mentioned in both sections when present. New non-negotiable rule: **no em-dashes** (U+2014) in narrative output, ever. Enforced by two JS tests.
- Retire-when row folded into the household-position collapsible, so collapsing the panel also hides the retirement-age input. HP summary chip extended with `retiring at N`.
- Market assumptions wrapped in its own collapsible (collapsed by default), with a summary chip `"10.00% return · 5.00% CPI · 6.00% escalation"`.
- Planned-scenario slider row: four sliders (retirement contribs ±R10k step R500, discretionary contribs ±R10k step R500, expected return ±2 pp step 0.5 pp, retirement age ±5y step 1) that appear between the outcome cards and the controls row whenever a baseline is locked. Sliders are centred on the baseline values; readouts show the absolute value plus a green/red delta pill when off centre. Moving a slider writes back into the underlying household-panel or market-assumption inputs (contribution deltas split proportionally between spouses A and B based on baseline share). Hidden in print.

**Decisions (and why):**
- No em-dashes in narrative. Rationale: they read as dashboard shorthand, don't parse well when read aloud in a client meeting, and make the prose feel clipped. The rule is codified in `docs/DESIGN.md` and a comment at the top of the narrative helpers; two tests assert the U+2014 character does not appear in any describe-function output.
- Narrative restructured with explicit no-baseline vs baseline-locked layouts. Rationale: the previous PLANNED section always showed the current plan as a standalone description, which then duplicated with PLANNED SCENARIO once a baseline was locked. Collapsing to "one section without a baseline, two sections with one" removes the redundancy and matches how the adviser actually talks through a meeting.
- Chart resize passes explicit `(w, h)` rather than letting Chart.js read the parent. Rationale: Session 2 spent time on destroy-and-rebuild and other approaches; the clean fix is to separate the layout flush (rAF) from the measurement (explicit dims), which is both the simplest reliable path and avoids the "rebuilt canvas renders blank under headless" regression noted in Session 2.
- Scenario slider row shown only when a baseline is locked. Rationale: the sliders are intrinsically "adjustments around a reference", so an unanchored version would show thumbs perpetually at centre (every refresh re-reads the current inputs as the anchor → thumb always at zero delta). Gating on baseline-locked also aligns with the meeting flow: enter the client's numbers, lock, then explore.
- Contribution sliders split deltas proportionally between spouses by baseline share. Rationale: couples typically adjust retirement contributions in proportion to current effort, and the projection is insensitive to which spouse the money lands in (same `rNom`, same CPI). Zero-zero baseline falls back to 50/50 on any positive delta.
- Scenario slider values sync from the underlying inputs on every `refresh()`, not just on slider input. Rationale: the household panel can still be edited directly, and we want the slider thumbs to reflect current state regardless of which surface changed it. One source of truth (the underlying inputs), two views on it.

**Tests:** 14 JS + 37 Python, all green. Added two new JS tests for no-em-dash + pertinent-terms-present in the narrative describe functions.

### Session 2 — 2026-04-22

**Shipped (PR #2):**
- Chart in the PDF now fills the card width at 320 px height. The earlier 200 px print override combined with an explicit canvas `height !important` was pushing Chart.js into awkward aspect ratios; dropping the canvas-side override and letting the wrap alone dictate height resolved it.
- Narrative restructured into three headed sections: `PLANNED` (always), `BASELINE POSITION` + `PLANNED SCENARIO` (only when a baseline is locked). Sign-aware copy, annualised-impact framing on the scenario paragraph.
- Baseline delta integrated into the outcome cards. New `.delta-line` inside the income and capital cards renders `Baseline <X> · ±<delta> (±<pct>%)` when a baseline is locked. The old full-width `.delta-bar` between the cards and the chart has been removed entirely (CSS, HTML, and `updateDelta` JS). Re-lock / Clear buttons now swap into the controls row next to the Lock button via a new `updateBaselineControls()`.

**Decisions (and why):**
- Lifetime contribution delta uses `p.totalContribsOverHorizon - baseline.p.totalContribsOverHorizon`, not the simpler `contribDelta × 12 × years`. Rationale: `project()` already compounds each year's escalated contributions into `cumulContribs`, so the subtraction is automatically escalation-accurate. Approximating here would have shipped a figure meaningfully lower than the real lifetime cost.
- Years-until-retirement card does not carry a delta. Rationale: horizon depends on input toggles (anchor spouse, retirement age) rather than on the plan; a `+5 years` read would confuse more than it informs.
- `updateBaselineControls()` is called only from the lock/clear handlers and init, not from `refresh()`. Rationale: the button state only needs to change when `baseline` flips between null and non-null, not on every slider tick.
- Attempted a destroy-and-rebuild approach for the chart on print-media change; reverted because headless `--print-to-pdf` was rendering the rebuilt canvas as blank (Chart.js paint not flushed before snapshot). `chart.resize()` on `beforeprint` + `matchMedia('print')` change is the working path.

**Tests:** 12 JS + 37 Python, all green. No calculation code changed.

### Session 1 — 2026-04-22

**Shipped:**
- Inline-editable spouse names. "Spouse A" / "Spouse B" headers on the household panel are click-to-edit; committed names flow to the events helper prose ("Ages are anchored to {name}'s age"), the print-summary starting-position and contributions rows, the retirement-age anchor row ("{name} reaches 65"), and the narrative paragraphs. Implemented via a single `spouseNames` state, `[data-spouse]`/`data-spouse-template` binding, and `renderSpouseLabels()`.
- Narrative "In plain terms" card below the chart. Renders 3 always-on paragraphs (headline, contributions, composition) plus optional events and baseline paragraphs. New `updateNarrative(p)` hooked into the render pipeline next to `updatePrintSummary()`.
- The four appendix tables, methodology, and disclaimer are wrapped in three `<details class="accordion">` blocks — collapsed on screen, forced open for print via `beforeprint` + `matchMedia('print')` listeners (the latter is needed for headless `--print-to-pdf`, which does not fire `beforeprint`).
- Print layout restructured into two zones: page 1 client-facing (header, client bar, outcome cards, chart, narrative), pages 2+ compliance appendix. New `@media print` rules hide `.collapsible-body`, `.market-assumptions-panel`, `.anchor-row`, and non-outcome section headers; force outcome cards and client-bar to 3-column; shrink the chart to 200px via `matchMedia('print')` + `chart.resize()`.

**Decisions (and why):**
- Spouse names default to "Spouse A" / "Spouse B", not empty. Rationale: the tool still makes sense before the adviser personalises (demo use, muscle memory).
- Names are rendered in every context exactly as typed — no auto-lowercase, no title-case fixup. Rationale: adviser controls their own casing; predictable > clever.
- No `localStorage` persistence for spouse names. Rationale: consistent with every other input — nothing persists across reloads today. If adviser asks, it's a one-line addition.
- Anchor buttons ("Youngest spouse" / "Oldest spouse") deliberately kept as labels-of-a-rule, not personalised, so clicking them to re-assign the rule remains unambiguous.
- `<details class="accordion">` chosen over a bespoke JS accordion. Rationale: zero-JS semantics, keyboard accessible, works with browser print.
- Chart.js canvas height for print is enforced via a `matchMedia('print')` listener that calls `chart.resize()`. `beforeprint` alone doesn't fire under headless `--print-to-pdf`, which is the main testing path.

**Known cosmetic issue (print):** The final narrative paragraph ("Of the projected capital… Spouse B contributes the remaining 45%.") can orphan to page 2 in headless `--print-to-pdf` output because the print media query applies after initial layout. In interactive Cmd+P the layout is recomputed before finalisation and the full narrative typically fits on page 1. Not worth further tightening; the critical headline information (outcome cards + chart + first two narrative paragraphs) is on page 1 in all cases.

**Tests:** 12 JS + 37 Python, all green. No calculation code was changed — this session was UI/print only.

