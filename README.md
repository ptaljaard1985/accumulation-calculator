# Retirement Accumulation Calculator

An interactive retirement projection tool for two-spouse pre-retiree South African households, built for use in client advisory meetings by Simple Wealth (Pty) Ltd, FSP 50637.

## What it does

Given two spouses' current retirement-fund and discretionary balances, their monthly contribution levels, and a handful of market assumptions, the calculator projects household capital year-by-year from today to a configurable retirement age. The UI has three states:

- **Empty** — a title-page setup for a fresh plan: family-name editable inline, two-column spouse setup, retirement-age and market-assumption defaults, dashed preview placeholder.
- **Filled** — the working state once a plan is entered. Top plan-inputs bar summarises the whole plan at a glance; an `Edit plan ↓` drawer holds the full inputs. Editorial headline ("At 65, R 48 200 a month — comfortably, at today's prices."), chart card with Capital / Breakdown / Table segmented view, a three-cell outcome strip (monthly income · household capital · years to retirement), and a plain-English narrative.
- **Compare** — after clicking "Lock as baseline", the view becomes a two-up: a muted baseline card next to a navy-ringed scenario card. Both hold mini-charts with a shared y-axis, hero numbers, and meta rows; a delta chip on the scenario card summarises the monthly-income change. A four-slider "Scenario levers" panel centred on the baseline lets the adviser nudge contributions, expected return, and retirement age to explore the shape of the decision.

Secondary features: optional **capital events** (one-off inflows like inheritances or bonuses, outflows like house purchases), **Real / Nominal** toggle for all displayed numbers, and a compliance-ready **print / PDF** export with inputs, outputs, methodology, and the FAIS/POPIA disclaimer.

## Running it

Open `retirement_accumulation.html` in a browser. That's it — no build, no server, no install.

External runtime deps (loaded via `<link>` / `<script>` tags): Chart.js from `cdnjs.cloudflare.com`, and the Fraunces / Inter Tight / JetBrains Mono webfont families from `fonts.googleapis.com`. Everything else — tokens, styles, logic — is inline. The file opens and computes offline; webfonts and the chart library fall back gracefully if the network is unavailable.

Tested on recent Safari and Chrome.

## Project structure

```
retirement_accumulation.html    the deliverable (single file)

CLAUDE.md                       read first by Claude Code
README.md                       this file
docs/
  ARCHITECTURE.md               code structure
  CALCULATIONS.md               maths and conventions
  DESIGN.md                     visual system
tests/
  README.md                     how to run tests
  python/                       math audits (pytest, 37 tests)
  js/                           JS tests against shipped HTML (node, 14 tests)
```

## Running the tests

Python audits (closed-form cross-checks):

```bash
cd tests/python
pip install pytest
pytest -v
```

JS behaviour tests (exercises the actual HTML file):

```bash
cd tests/js
node run.js
```

Both must pass before any change ships. See `tests/README.md` for details.

## Relationship to the drawdown calculator

This calculator's output — household capital at retirement — is the input to the separate [retirement drawdown calculator](../drawdown-calculator), which models the decumulation phase with SARS tax, living annuities, and CGT on discretionary draws.

The two calculators are deliberately separate. They share no code. The adviser manually moves the retirement-capital number from this calculator to the drawdown calculator at the handoff, which surfaces details that tend to go missing (preservation funds, spouse-split assumptions, planned post-retirement contributions).

## License

Proprietary. © Simple Wealth (Pty) Ltd 2026.

## Contact

Questions: pierre@simplewealth.co.za.
