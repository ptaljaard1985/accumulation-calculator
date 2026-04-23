# CLAUDE.md

This file is read first by Claude Code on every session. It tells you what this project is, how it's built, and the conventions that matter.

## What this is

A standalone HTML retirement accumulation calculator for Simple Wealth (Pty) Ltd, a South African authorised financial services provider (FSP 50637). One file, `retirement_accumulation.html`, opens by double-click, prints to PDF cleanly, and is used by the adviser (Pierre) with pre-retiree clients in real meetings.

The calculator projects household capital from today to a configurable retirement age, for a two-spouse household with both retirement-fund and discretionary portfolios. Primary output is projected monthly income in today's money, computed as 5% of the combined capital at retirement divided by twelve, before tax. Secondary outputs: capital at retirement (real and nominal), cumulative contributions, year-by-year trajectory, "lock as baseline" comparison, and an optional capital-events mechanism for one-off inflows and outflows.

This calculator is a **sibling** of the drawdown calculator (in a separate repo). The two are conceptually linked: the accumulation calculator's output is what the drawdown calculator takes as input when the client retires. They do not share code — the adviser moves the retirement-capital number across manually at the handoff, which is deliberate (forces attention at a point where details like "did we include her preservation fund?" tend to come up).

The target audience for this code is whoever (adviser or Claude) needs to refine the calculator in response to real client meeting feedback, or add a feature the adviser decides is worth having. Anything not strictly necessary to that goal has been resisted by design.

## Non-negotiable design constraints

These are not preferences. Breaking any of them is a regression:

1. **Single file.** Everything — HTML, CSS, JS — lives in `retirement_accumulation.html`. No build step, no npm, no React. External runtime deps are limited to: Chart.js from `cdnjs.cloudflare.com` and the Fraunces / Inter Tight / JetBrains Mono webfonts from `fonts.googleapis.com`. Adding any other runtime dep needs an explicit conversation. The file must open with `file://`; webfonts and Chart.js degrade gracefully when offline (system fallback fonts kick in; charts stay blank but inputs + numbers still compute).
2. **Prints to PDF cleanly.** Browser print dialog produces a compliance-ready document with inputs, outputs, methodology, and FSP disclaimer. Never break `@media print`.
3. **Math is auditable.** Any change to a calculation must come with a Python test in `tests/python/` that implements the same logic from scratch and agrees to within R1 with the JS. If you cannot write a closed-form or manual trace that matches, the change is unsafe.
4. **Warm paper aesthetic, not SaaS.** Background `--paper: #faf7f0`, primary accent `--navy: #1f2d3d`, accent `--gold: #b8893c`, hairline borders, serif editorial headlines (Fraunces), no gradients, no shadows beyond the scenario card's navy ring, no animations, no emoji, no em-dashes in narrative prose. Details in `docs/DESIGN.md`.
5. **South African context.** Rands with space separators (`R6 000 000`), no tax modelling during accumulation, FSP 50637 disclaimer in the print summary. The "5% rule" is before-tax by design — don't add tax assumptions.
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
- **Income calculation**: `monthly_income_today = final_real × 0.05 / 12`. Before tax. This is a rule-of-thumb, not a drawdown simulation — the methodology note says so explicitly.

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
# Python tests (math audits) — 37 tests
cd tests/python
pytest -v

# JS tests (actual shipped JS) — 12 tests
cd tests/js
node run.js
```

Both must pass before any change ships. See `tests/README.md`.

## File inventory

- `retirement_accumulation.html` — the deliverable. This is the product.
- `README.md` — human-readable project overview, for GitHub.
- `CLAUDE.md` — this file.
- `docs/ARCHITECTURE.md` — code structure in detail.
- `docs/CALCULATIONS.md` — the maths and conventions.
- `docs/DESIGN.md` — visual system and interaction patterns.
- `tests/python/` — math audits in Python (37 tests).
- `tests/js/` — JS tests in Node against the actual shipped HTML (28 tests).

## What not to do

- **Don't bundle.** No webpack, no rollup, no esbuild. The file is the file.
- **Don't add dependencies beyond Chart.js + Google Fonts.** No plugins, no lodash, no moment. If a new external dep is genuinely needed, it's a conversation, not a commit.
- **Don't introduce a backend.** The calculator is stateless and client-side. Anything that needs persistence goes somewhere else.
- **Don't add analytics, tracking, or telemetry.** Client financial data must stay in the browser.
- **Don't add tax modelling.** The income calculation is 5% before tax by design. If the adviser wants tax, they use the drawdown calculator after retirement.
- **Don't rename `retirement_accumulation.html`.** The file might be linked from elsewhere.
- **Don't reformat the whole file in one commit.** Diff review is how regressions get caught; a 1300-line whitespace change defeats that.
- **Don't try to share code with the drawdown calculator.** They are deliberately separate repos. Revisit if a third calculator appears and shared infrastructure becomes worth the overhead.

## When in doubt

Ask. Pierre would rather answer one question now than fix a silent regression later.

## Session Log

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

