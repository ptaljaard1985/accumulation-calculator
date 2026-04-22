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

Inside the single HTML file:

- **Lines 1–620**: CSS using `:root` CSS variables as design tokens. Collapsible sections, event rows, and the household panel are all styled here.
- **Lines 620–1010**: HTML structure — header, client bar, household position (collapsible), retirement-anchor row, market assumptions, summary cards, delta bar, chart controls, chart card, print summary.
- **Lines 1010–1200**: JS helpers (formatting, parsing, collapsible logic).
- **Lines 1200–1420**: `project()` — the core projection function. Monthly compounding, contribution escalation, growth breakdown decomposition, capital events application.
- **Lines 1420–1780**: Rendering — summary cards, delta bar, charts (capital + breakdown), year table, print summary.
- **Lines 1780–end**: Events store + rendering, baseline lock, event wiring.

See `docs/ARCHITECTURE.md` for more detail on any section.

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
