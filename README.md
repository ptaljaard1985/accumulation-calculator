# Retirement Accumulation Calculator

An interactive retirement projection tool for two-spouse pre-retiree South African households, built for use in client advisory meetings by Simple Wealth (Pty) Ltd, FSP 50637.

## What it does

Given two spouses' current retirement-fund and discretionary balances, their monthly contribution levels, and a handful of market assumptions, the calculator projects household capital year-by-year from today to a configurable retirement age and shows:

- **Projected monthly retirement income** (the primary answer), computed as 5% of the combined capital divided by twelve, in today's money, before tax
- **Household capital at retirement**, in both real and nominal terms
- **Three chart views**: stacked-bar capital trajectory, a growth-breakdown that decomposes the total into starting-capital-compounded + cumulative contributions + growth-on-contributions, and a year-by-year table
- **Current vs planned comparison** via a "Lock as baseline" button — the delta is shown in retirement-income terms and in monthly-contribution terms
- **Optional capital events**: one-off inflows (inheritances, bonuses) or outflows (house purchases, school fees)

The print button produces a compliance-ready PDF summary including inputs, outputs, methodology, and the FAIS/POPIA disclaimer.

## Running it

Open `retirement_accumulation.html` in a browser. That's it — no build, no server, no install.

Chart.js loads from `cdnjs.cloudflare.com`; everything else is inline. The file works offline if Chart.js is cached.

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
  js/                           JS tests against shipped HTML (node, 12 tests)
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
