# Design

The visual system for the accumulation calculator. These choices are deliberate — don't drift from them without a conversation. This system is intentionally identical to the drawdown calculator's, so the two feel like a matched pair.

## Philosophy

**The calculator is a conversation tool, not a dashboard.** It gets opened during a client meeting, the adviser moves inputs while the client watches, and a PDF is printed and emailed. That context dictates every visual choice:

- Legible at 2m on a shared laptop, printable to A4 without cropping.
- Professional advisory-firm aesthetic, not fintech-startup.
- No unnecessary motion, no loading states, no "oh did you see that?" animations.
- Everything that matters fits above the fold on a 13-inch screen when the collapsible sections are closed.

## Design tokens

All colours, spacing, and radii are CSS variables in `:root`. If you need to change the palette, change it there, not in component rules.

```css
:root {
  --ink: #1a1a1a;
  --ink-muted: #5a5a5a;
  --ink-faint: #8a8a8a;
  --line: #e5e5e0;
  --line-strong: #c8c8c0;
  --surface: #ffffff;
  --surface-alt: #faf9f5;      /* warm off-white page background */
  --surface-warm: #f3f1e8;     /* toggle background, chips */
  --brand: #2d3e50;            /* Simple Wealth navy */
  --brand-accent: #c89a3c;     /* gold, used sparingly */
  --success: #3b6d11;
  --danger: #a32d2d;
  --teal: #2a6b6b;             /* chart: retirement fund */
  --gold: #c89a3c;             /* chart: discretionary */
  --radius: 8px;
  --radius-lg: 12px;
}
```

The warm off-white page background (`--surface-alt`) is the most important colour choice in the system. It makes the page read like paper rather than a web app. Do not drift toward `#f8f9fa` or any cold grey.

## Typography

System font stack:

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif
```

Base size: 15px, line-height 1.55. Two weights only: 400 (regular) and 500 (medium). Never 600 or 700 anywhere in the UI.

Any number that updates live uses `font-variant-numeric: tabular-nums`. This stops the layout jittering as sliders move.

Scale:

- H1: 26px / 500 / letter-spacing -0.3px
- Summary card value: 28px / 500
- Section headers: 11px uppercase, letter-spacing 1.5px, weight 600
- Body: 15px
- Slider label: 13px muted
- Slider readout: 14px / 500 / tabular
- Field label: 12px muted

## Layout

- Max width 1100px, centred, 32px horizontal padding.
- Radii: 8px for inputs and toggles, 12px for cards.
- Hairlines: 1px solid `--line`. The 2px navy line under the header is the only thicker border.
- Card padding: 18–22px.
- Grid gaps: 14–20px between cards.

## Component conventions

### Collapsible sections

The household-position and capital-events sections have collapsible section headers. The full section header (title + chevron) is clickable. When collapsed:

- The chevron rotates −90°.
- The body transitions max-height to 0.
- A summary chip appears in the header (e.g. "40/40 · R3.5m capital · R20k/mo in").

Opening a collapsible section: the body's max-height is set to its `scrollHeight`, then cleared after the transition ends (so it can grow if content changes later). Closing: max-height is set to current scrollHeight first, then to 0 on the next animation frame (so the transition has a defined starting point).

Do not nest collapsibles. The animation logic assumes one level.

### Summary cards

Three across. The first is filled navy with white text — the "primary answer" card. The rest are white with hairline borders.

Structure per card: tiny muted label (12px), big value (28px / 500), optional sub-value (12px muted). The primary card's sub-value uses `rgba(255,255,255,0.65)` not `--ink-muted`.

When a baseline is locked, the income and capital cards grow a fourth row — a thin `.delta-line` above a hairline separator, reading `Baseline <X> · ±<delta> (±<pct>%)`. Positive deltas render in `--success` on the light cards and a lightened green (`#9be7be`) on the primary card; negatives use `--danger` and `#f5a1a1`. The years-until-retirement card deliberately has no delta — the figure depends on input toggles rather than on the plan, and a `+5 years` read would confuse more than it informs.

### Narrative "In plain terms" card

Below the chart, above the compliance appendix. Card styling matches the summary cards. Title `IN PLAIN TERMS` in uppercase small-caps (11–12px, letter-spaced). Body is structured as `.narrative-section` blocks, and which ones are shown depends on whether a baseline is locked.

When **no baseline is locked**, one section:

- **CURRENT POSITION** — one paragraph walking through the pertinent numbers for the current plan: nominal return, inflation, combined monthly contributions and escalation, projected capital in today's money and future rands, the retirement-fund / discretionary split, and the 5%-rule monthly income. If the plan includes capital events, a short sentence mentions them.

When a **baseline is locked**, two sections:

- **BASELINE POSITION** — one paragraph summarising the baseline's assumptions, contributions, projected capital, and projected monthly income. Events mentioned if present.
- **PLANNED SCENARIO** — one paragraph walking through the plan's own numbers first, then the delta versus baseline: contribution difference monthly and over the horizon, capital difference in today's money with percentage change, and monthly-plus-annual income difference. Events mentioned if present.

Section headings follow the same 12px uppercase / letter-spaced rhythm as other `h3`s. Copy is sign-aware: "more" flips to "less", "rises" to "falls", "extra contributions" to "saving" when the plan is worse than the baseline.

**No em-dashes** (U+2014) anywhere in the narrative copy. Em-dashes read as dashboard shorthand, don't parse well when the narrative is read aloud in a client meeting, and make the prose feel clipped. Use commas, full stops, or rephrase. The same rule applies to any future narrative surfaces (card subtitles, tooltips, print-summary prose). Write plainly, like a normal person.

### Compliance appendix — accordion group

Three native `<details class="accordion">` blocks: detail tables, methodology & assumptions, disclaimer. Closed by default on screen (keeps the meeting view uncluttered). Forced open on print via a `beforeprint` handler (for interactive Cmd+P) and a `matchMedia('print')` listener (for headless `--print-to-pdf`, which does not fire `beforeprint`). Summary markers are hidden in print so the output reads as plain tables/prose.

### Planned scenario sliders

A compact row of four sliders that appears directly below the outcome cards when a baseline is locked, and vanishes when the baseline is cleared. Same card styling as the rest of the page (warm surface, hairline border, radius 12px). Small uppercase `PLANNED SCENARIO LEVERS` heading on the left, and a muted "Centered on the locked baseline. Nudge to explore." caption on the right.

The four sliders — retirement contributions, discretionary contributions, expected return, retirement age — each use the same `.lever` layout as the market-assumptions sliders. Each readout shows the absolute value (e.g. `R18 000`, `10.00%`, `67`) followed by a small delta pill when the slider has moved away from its anchor (e.g. `+R3 000` in green, `-R2 000` in danger red). The pill is empty when the slider is at centre, keeping the readout uncluttered at rest.

Moving a slider mutates the underlying household-panel / market-assumptions inputs directly — there is no secondary state. The household panel and market-assumptions can be expanded to see the actual per-spouse / per-assumption values; the scenario row is just a meeting-time convenience on top. Contribution deltas split between the two spouses proportionally to their baseline share.

Ranges: contributions ±R10 000/month (step R500), return ±2 percentage points (step 0.5 pp), retirement age ±5 years (step 1). The row is suppressed in print via `.no-print`.

### Sliders

Custom-styled range inputs:

- Track: 4px tall, `--line-strong`, radius 2px
- Thumb: 18px circle, navy, 2px white border, subtle shadow
- Both `::-webkit-slider-thumb` and `::-moz-range-thumb` defined

Each slider sits inside a `.lever` block: muted 13px label on the left, 14px tabular value on the right, range input full width below.

### Capital events list

One row per event, grid with six columns: kind dropdown, age input, amount input, today's-money checkbox, year label (computed), delete button. The year label reads "y+5 · 2031" — year offset from now, then the calendar year.

Adding an event auto-expands the capital-events section if it was collapsed. The default new event is an inflow of R500k at reference-age + 10, in today's money.

### Toggles

The view toggle (Capital/Breakdown/Table), the real/nominal toggle, and the anchor toggle all live in a similar `.toggle-group` pattern. Active state is a white pill with brand-navy text; inactive is muted grey.

### Chart

Chart.js with heavy default overrides. Three views:

- **Capital view**: stacked bars, retirement fund in teal (`#2a6b6b`), discretionary in gold (`#c89a3c`). When baseline is locked, an additional dashed grey line overlays the baseline total.
- **Breakdown view**: stacked bars, starting-capital-compounded in light grey, cumulative contributions in darker grey, growth on contributions in gold. The three layers always sum to the total.
- **Table view**: HTML table (not Chart.js), sticky year column, one row per year, columns for age A / age B / retirement / disc / total / annual contributions. When baseline is locked, two extra columns (baseline total, delta).

Custom HTML legend above the chart. Chart.js's built-in legend is disabled entirely.

### Print

```css
@media print { ... }
```

Two-zone PDF. Page 1 is the client-facing view: header, client bar, outcome cards, chart (320 px tall, full card width), narrative. Pages 2+ are the compliance appendix: all three accordions forced open and flattened, with `page-break-before: always` on `.print-summary` to start cleanly on a fresh page.

Hidden in print: the input surfaces (`.collapsible-body`, `.market-assumptions-panel`, `.anchor-row`, non-outcome section headers), all toggles and view switchers, the Lock / Re-lock / Clear buttons. Everything with class `.no-print` is suppressed.

Multi-column layouts are forced to stay three-wide in print (the page width would otherwise trigger the 900 px mobile breakpoint and stack them vertically).

Every calculator must be reviewed in print preview before shipping. Print-only regressions are subtle and common — a button that accidentally prints, a header that doesn't repeat on page 2, a table cut off mid-row, a chart canvas that renders at half width because Chart.js hasn't resized for the print media yet (this one bit us in an early iteration).

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour transitions already in place.
- Don't introduce a second accent colour. Gold exists but is reserved.
- Don't use weight 700. Medium (500) is the boldest weight in this system.
- Don't use emoji. Not in the UI, not in tooltips, not in print.
- Don't replace Chart.js defaults with Chart.js plugins. Stock Chart.js is capable enough.
