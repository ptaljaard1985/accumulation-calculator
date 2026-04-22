# Handoff: Retirement Calculator Redesign

## Overview

This is a redesign of Simple Wealth's retirement projection calculator — a two-spouse household tool that shows projected monthly retirement income and capital at a chosen retirement age, with the ability to lock a baseline and explore scenarios against it.

The redesign moves away from the earlier split rail + cluttered canvas layout to a **full-width, F-style two-up compare** as the hero state, with the empty and single-scenario states working backward from that frame.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX inside a prototyping sandbox** — they are prototypes showing intended look and behaviour, not production code to copy directly. The design uses React + inline Babel + global scripts, which is not how this should ship.

The task is to **recreate these designs in Simple Wealth's existing codebase**, using its established framework, component library, state-management patterns, and design-token system. If there is no established design system yet, match the visual vocabulary defined in `hifi-calc.css` (tokens listed below).

## Fidelity

**High-fidelity.** Colors, typography, spacing, and layout are intentional. Recreate pixel-perfectly within the codebase's existing libraries. Interactions (rail collapse, drawer expansion, slider drag, baseline lock) are stubbed in the prototype — behaviour is described below; implement using the codebase's normal patterns.

## Screens / Views

The calculator has **three visual states** driven by the user's progress through the flow. All three share the same full-width canvas frame (no permanent side rail).

---

### State 1 — Empty (title-page setup)

**Purpose.** First-load / fresh plan. User sets up the household before any projection is drawn.

**Layout.** Single-column, centered. Three horizontal bands separated by hairline rules:

1. **Title plate** (centered):
   - Eyebrow: `SIMPLE WEALTH · RETIREMENT PROJECTION` — 10px, uppercase, letter-spacing 2.4px, `--mute` (`#6b7280` ish — see tokens).
   - Headline: `A plan for the _______ family.` — Fraunces 44px, weight 300, letter-spacing −0.6px. The word "the _______ family" is an inline editable span (italic, dashed underline, padding 0 4px) that the user clicks to type the family name.
   - Date line: `Prepared 22 April 2026` — JetBrains Mono 11px, `--mute`.

2. **Two-column setup**: 1fr · 1px divider · 1fr, gap 48px. Each column contains one spouse:
   - Step label: `I.` or `II.` (Fraunces italic 15px, `--gold-2`) + `SPOUSE A` / `SPOUSE B` (10px uppercase, letter-spacing 1.8px, `--mute`, weight 600).
   - **Name input** — serif 26px weight 300 input (no border, dashed underline via parent), placeholder "First name", right-aligned `age __` input (40×24px, 1px border).
   - Four Field components: Retirement balance, Discretionary balance, Monthly retirement, Monthly discretionary. All in empty state (dashed border, `R` prefix, empty value).

3. **Footer band** (2 cols, border-top + border-bottom hairline, 20px padding):
   - Left: `RETIRE WHEN THE YOUNGEST REACHES` · age input (pre-filled `65`) + small hint "default · adjust later".
   - Right: `MARKET ASSUMPTIONS` · `10% · 5% · 6%` + hint "return · CPI · escalation". Middle dots are `--faint` colour.

4. **Preview placeholder**: dashed 1px border, radius `--r-lg`, 48px vertical padding, centered italic serif `"The projection will appear here"` in `--mute`.

See `hifi-states.jsx` → `CanvasEmpty` and `hifi-calc.css` → `.canvas-empty`, `.empty-*` classes.

---

### State 2 — Filled, single scenario

**Purpose.** A plan has been entered; showing the projection but no baseline has been locked yet. Default working state.

**Layout.**

1. **Plan-inputs bar** (top) — a horizontal summary strip showing the current plan at a glance:
   - Logo + brand + client name on the left (separated from facts by a vertical hairline).
   - Fact cells: `Household`, `Combined starting capital`, `Monthly contributions`, `Retire at`, `Return · CPI`. Each is `LABEL` (9.5px, uppercase, `--mute`) over `value` (13px, weight 500, mono for numbers).
   - `Edit plan ↓` ghost button at the right. Clicking expands a three-column drawer with the full inputs:
     - Col 1: Household (both spouses with their fields).
     - Col 2: Retirement (when youngest reaches) + Capital events (add button).
     - Col 3: Market assumptions (three sliders: expected return, inflation, contribution escalation).
   - When collapsed, drawer animates away; one-line summary remains.

2. **Canvas head**: editorial eyebrow + serif headline (`At 65, R 48 200 a month — comfortably, at today's prices.`) + sub-para. Right side has `Real / Nominal` segmented toggle + `Lock as baseline →` primary button.

3. **Chart card**: white surface, 1px hairline border, radius 8, padding 22px. Inside:
   - Legend (Retirement fund · Discretionary) on the left.
   - `Capital / Breakdown / Table` segmented toggle on the right.
   - Stacked bar chart, 280px tall, 26 bars (age 40 → 65). Gold = discretionary (bottom stack), navy = retirement fund (top stack). Thin gold marker + "retirement" label at peak.
   - R-value y-axis labels (mono, 10px, `--mute`) in 0/25/50/75/100% increments.
   - Age labels across x-axis.

4. **Outcome strip**: 3 equal cells:
   - Primary: `MONTHLY INCOME` · `R 48 200` · "today's money · before tax".
   - Secondary: `HOUSEHOLD CAPITAL` · `R 11.6m` · "at age 65".
   - Secondary: `YEARS TO RETIREMENT` · `25` · "retiring in 2051".

5. **Narrative block**: eyebrow `IN PLAIN TERMS` + two serif paragraphs in `--ink-2`. Contributions and capital words are bolded in `--ink`.

6. **Canvas foot**: dated illustrative-only line + `Table view` / `Print / PDF` buttons.

See `hifi-states.jsx` → `CanvasFilled`, `PlanInputs`.

---

### State 3 — Compare (baseline locked)

**Purpose.** Adviser has locked a baseline plan and is now exploring a scenario against it. This is the hero interaction of the tool.

**Layout.**

1. **Plan-inputs bar** — same collapsed summary as State 2.

2. **Canvas head (compact)**:
   - Eyebrow: `SCENARIO COMPARE · BASELINE LOCKED`.
   - Tight one-line headline: `What if we contributed R 5 000 more?` — Fraunces 42px weight 300, with "contributed R 5 000 more" wrapped in `.gold-under` (gold underscore accent).
   - Right actions: Real/Nominal toggle, `Clear baseline` ghost button, `Re-lock as new baseline` primary button.

3. **Two-up compare grid**: `grid-template-columns: 1fr 1fr`, gap 22px. Two `.compare-card` panels:

   - **Left — Baseline**:
     - Background `--paper-2` (muted).
     - Head: `BASELINE · CURRENT PLAN` tag + `LOCKED` micro label.
     - Hero number: `R 48 200` — Fraunces 52px, `--ink-2` (muted), weight 300, mono numerals.
     - Subline: "monthly income · R 11.6m capital".
     - Chart: full-width bar chart at `faded: 0.35` opacity (same shape as State 2's chart, but scaled to the card width and muted).
     - Meta rows (border-top, mono numbers): Retirement contrib / Discretionary contrib / Expected return / Retire at.

   - **Right — Scenario** (the "hero" card):
     - White surface, 1px `--navy` border + 1px `--navy` box-shadow ring, 4px 12px rgba shadow.
     - Head: `PLANNED SCENARIO` tag (navy) + `+ R 11 400 / mo` gold delta chip.
     - Hero number: `R 59 600` — Fraunces 52px, `--navy`, mono numerals.
     - Subline: "monthly income · R 14.3m capital".
     - Chart: full-opacity, with a `peakIdx` marker at age 65.
     - Meta rows: same structure as baseline, but Retirement contrib shows `R 20 000` with `+5k` in `--gold-2` beside it.

4. **Centered legend**: `Retirement fund` (navy swatch) · `Discretionary` (gold swatch). Single row under both charts.

5. **Scenario levers panel** (1px border, surface background, radius `--r-lg`):
   - Head: `SCENARIO LEVERS` + italic serif hint "centered on the locked baseline — nudge to explore".
   - 4-column slider grid: Retirement contributions (with `+R 5 000` delta chip), Discretionary contributions, Expected return, Retirement age. Each slider has label + value (mono) + 2px-tall rail + small amber thumb.

See `hifi-states.jsx` → `CanvasCompare`, `hifi-calc.css` → `.compare`, `.compare-card`, `.scenario-levers`.

---

## Interactions & Behavior

- **Edit plan drawer** (States 2 & 3): `Edit plan ↓` toggles the drawer. Smooth height expansion; `↓` flips to `↑` when open. Values live-update the summary strip as the user edits.
- **Lock as baseline** (State 2 → State 3): transitions from single-scenario view to the two-up compare. The current numbers become the baseline card (muted). Scenario card starts as an exact clone; moving any lever in the scenario-levers panel re-runs the projection and updates the scenario card + its chart.
- **Clear baseline** (State 3 → State 2): returns to single-scenario. Any scenario edits are discarded.
- **Re-lock as new baseline** (State 3): the scenario's current values become the new baseline; scenario-levers re-center on them.
- **Inline-edit family name** (State 1): click the dashed span "the _______ family" to type into it. On blur, if empty, revert to placeholder.
- **Real / Nominal toggle** (States 2 & 3): flips all displayed numbers between today's-money and nominal projections. The chart re-scales.
- **Capital / Breakdown / Table toggle** (State 2 chart card): Capital = stacked bar (default), Breakdown = side-by-side unstacked, Table = numeric table of per-year values.
- **Recalculation**: happens on every input blur / slider-release. Chart re-renders with a 180–220ms ease-out transition on bar heights.
- **Empty state validation** (State 1): the preview placeholder stays dashed until both spouses have name + at least one balance + retirement age is set. Then the user is navigated to State 2.

## State Management

The model the adviser works with:

```
Plan {
  familyName: string
  spouses: [{ name: string, age: number, retBalance, discBalance, monthlyRet, monthlyDisc }, ...]
  retireWhen: 'youngest' | 'oldest'
  retireAge: number
  assumptions: { expectedReturn: number, cpi: number, escalation: number }
  events: CapitalEvent[]
}

UI {
  viewState: 'empty' | 'filled' | 'compare'
  baseline: Plan | null           // set when 'compare'
  scenario: Plan                  // always the live/editable one
  displayMode: 'real' | 'nominal'
  chartView: 'capital' | 'breakdown' | 'table'
  planDrawerOpen: boolean
}
```

`viewState` derives: if `baseline` is set → `compare`; else if plan is complete → `filled`; else `empty`. Locking sets `baseline = scenario` (deep-copied); clearing sets `baseline = null`.

The projection calculation itself is not changed by this redesign — assume the existing `project(plan) → { monthlyIncome, capital, series: [{age, retire, disc}] }` function is the contract.

## Design Tokens

All tokens live at the top of `hifi-calc.css` as CSS custom properties on `:root`. Summary:

**Colors**
| Token | Hex | Use |
|-------|-----|-----|
| `--ink` | `#1a1f26` | Primary text |
| `--ink-2` | `#3a4250` | Secondary text, muted hero numbers |
| `--mute` | `#7a8292` | Labels, tertiary text |
| `--faint` | `#a8adb7` | Disabled, placeholders, middot separators |
| `--line` | `#c8c3b5` | Borders |
| `--hairline` | `#e4dfd1` | Card borders, dividers |
| `--paper` | `#faf7f0` | Canvas background |
| `--paper-2` | `#efe9dc` | Rail / muted card background |
| `--paper-3` | `#e6e0d0` | Deeper warm panel |
| `--surface` | `#ffffff` | Cards, inputs |
| `--navy` | `#1f2d3d` | Primary accent — scenario card, primary button |
| `--navy-soft` | `#2d3e54` | Navy hover |
| `--gold` | `#c9a35a` | Secondary accent — discretionary bar, slider fill |
| `--gold-2` | `#a8844a` | Gold text, deltas, Roman numerals |
| `--gold-pale` | `#f3ead3` | Pale gold chip background |
| `--pos` | `#4a7c59` | Positive delta |
| `--neg` | `#a04438` | Negative delta |

**Typography**
- `--serif`: `'Fraunces'`, Georgia fallback. Weights 300/400/500. Used for: headline, empty title, hero numbers, compare values, spouse names, narrative body.
- `--sans`: `'Inter Tight'`, system-ui fallback. Weights 400/500/600. Used for: labels, buttons, body UI text.
- `--mono`: `'JetBrains Mono'`, ui-monospace fallback. Weights 400/500. Used for: numeric values, inputs with numbers, dates, y-axis labels. Always `font-variant-numeric: tabular-nums`.

**Radii**
- `--r-sm`: 4px (inputs, chips)
- `--r-md`: 6px (buttons)
- `--r-lg`: 10px (cards, chart card, empty preview)

**Spacing**
No strict scale — use 4/6/8/10/14/18/22/28/32/44px as seen in the prototype.

**Shadows**
Cards use near-zero shadows: `0 1px 0 rgba(30,30,30,0.02)` or none. Scenario card has the navy ring: `0 0 0 1px var(--navy), 0 4px 12px rgba(31,45,61,0.06)`.

## Assets

No bitmap assets. All visuals (logo mark, chart, icons) are either CSS or inline SVG. The `SW` logo mark is a circle + text.

Fonts come from Google Fonts (imported at the top of `hifi-calc.css`):
```
Fraunces, Inter Tight, JetBrains Mono
```
Use your codebase's usual font-loading strategy (self-hosted, next/font, etc.) — don't ship the Google Fonts import as-is.

## Screenshots

The `screenshots/` folder contains full-width renders of each state for quick visual reference:

- `screenshots/state-1-empty.png` — Empty / title-page setup
- `screenshots/state-2-filled.png` — Single scenario (no baseline)
- `screenshots/state-3-compare.png` — Two-up compare (baseline locked)

## Files

Reference files included in this handoff folder:

- **`Retirement Calc Hi-Fi.html`** — host page. Uses the design_canvas wrapper to show all three states side by side. Not the app entry point; it's a demo frame.
- **`hifi-calc.css`** — all tokens and component CSS. Read `:root` for design tokens. Most classes are scoped with `.canvas`, `.compare`, `.empty-*`, `.plan-bar`, etc.
- **`hifi-primitives.jsx`** — `HiFiChart` (stacked bar with optional baseline overlay), `Field`, `Slider`, `RailSection` (rail is removed from the design but the primitive is intact), `LeftRail` (unused in current design).
- **`hifi-states.jsx`** — `PlanInputs`, `CanvasEmpty`, `CanvasFilled`, `CanvasCompare`. These are the three states; they encode most of the layout decisions.

The HTML host + design_canvas wrapper are for review only; only the three Canvas* components and their CSS are relevant to the production build.
