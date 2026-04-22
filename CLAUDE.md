# CLAUDE.md

This file is read first by Claude Code on every session. It tells you what this project is, how it's built, and the conventions that matter.

## What this is

A standalone HTML retirement accumulation calculator for Simple Wealth (Pty) Ltd, a South African authorised financial services provider (FSP 50637). One file, `retirement_accumulation.html`, opens by double-click, prints to PDF cleanly, and is used by the adviser (Pierre) with pre-retiree clients in real meetings.

The calculator projects household capital from today to a configurable retirement age, for a two-spouse household with both retirement-fund and discretionary portfolios. Primary output is projected monthly income in today's money, computed as 5% of the combined capital at retirement divided by twelve, before tax. Secondary outputs: capital at retirement (real and nominal), cumulative contributions, year-by-year trajectory, "lock as baseline" comparison, and an optional capital-events mechanism for one-off inflows and outflows.

This calculator is a **sibling** of the drawdown calculator (in a separate repo). The two are conceptually linked: the accumulation calculator's output is what the drawdown calculator takes as input when the client retires. They do not share code — the adviser moves the retirement-capital number across manually at the handoff, which is deliberate (forces attention at a point where details like "did we include her preservation fund?" tend to come up).

The target audience for this code is whoever (adviser or Claude) needs to refine the calculator in response to real client meeting feedback, or add a feature the adviser decides is worth having. Anything not strictly necessary to that goal has been resisted by design.

## Non-negotiable design constraints

These are not preferences. Breaking any of them is a regression:

1. **Single file.** Everything — HTML, CSS, JS — lives in `retirement_accumulation.html`. No build step, no npm, no React. The only external dependency is Chart.js from `cdnjs.cloudflare.com`. The file must open with `file://` and work offline except for the chart library.
2. **Prints to PDF cleanly.** Browser print dialog produces a compliance-ready document with inputs, outputs, methodology, and FSP disclaimer. Never break `@media print`.
3. **Math is auditable.** Any change to a calculation must come with a Python test in `tests/python/` that implements the same logic from scratch and agrees to within R1 with the JS. If you cannot write a closed-form or manual trace that matches, the change is unsafe.
4. **Warm paper aesthetic, not SaaS.** Background `#faf9f5`, brand navy `#2d3e50`, hairline borders, no gradients, no shadows, no animations, no emoji. Details in `docs/DESIGN.md`.
5. **South African context.** Rands with space separators (`R6 000 000`), no tax modelling during accumulation, FSP 50637 disclaimer in the print summary. The "5% rule" is before-tax by design — don't add tax assumptions.

## How the code is organised

Inside the single HTML file (approximate line ranges; file is currently ~2100 lines):

- **Lines 1–670**: CSS using `:root` CSS variables as design tokens. Collapsible sections, event rows, household panel, narrative card, accordion styles, and the `@media print` block are all here.
- **Lines 670–1000**: HTML structure — header, client bar, household position (collapsible), retirement-anchor row, capital events, market assumptions, summary cards, delta bar, chart controls, chart card, narrative section, and the print-summary accordions.
- **Lines 1000–1220**: JS helpers, state (`spouseNames`, `baseline`, `chartView`…), `renderSpouseLabels()` (walks `[data-spouse]` nodes), events store + rendering.
- **Lines 1220–1420**: `project()` — the core projection function. Monthly compounding, contribution escalation, growth breakdown decomposition, capital events application.
- **Lines 1420–1910**: Rendering — summary cards, delta bar, charts (capital + breakdown), year table, `updatePrintSummary()`, `updateNarrative()`.
- **Lines 1910–end**: Baseline lock, event wiring, inline-rename handlers, print/matchMedia handlers, init.

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
- `tests/js/` — JS tests in Node against the actual shipped HTML (12 tests).

## What not to do

- **Don't bundle.** No webpack, no rollup, no esbuild. The file is the file.
- **Don't add dependencies.** Chart.js is the only runtime dependency. No plugins, no lodash, no moment.
- **Don't introduce a backend.** The calculator is stateless and client-side. Anything that needs persistence goes somewhere else.
- **Don't add analytics, tracking, or telemetry.** Client financial data must stay in the browser.
- **Don't add tax modelling.** The income calculation is 5% before tax by design. If the adviser wants tax, they use the drawdown calculator after retirement.
- **Don't rename `retirement_accumulation.html`.** The file might be linked from elsewhere.
- **Don't reformat the whole file in one commit.** Diff review is how regressions get caught; a 1300-line whitespace change defeats that.
- **Don't try to share code with the drawdown calculator.** They are deliberately separate repos. Revisit if a third calculator appears and shared infrastructure becomes worth the overhead.

## When in doubt

Ask. Pierre would rather answer one question now than fix a silent regression later.

## Session Log

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

