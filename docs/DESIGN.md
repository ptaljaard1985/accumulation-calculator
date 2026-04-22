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

### Delta bar

Only visible when baseline is locked. Coloured left border (green if planned beats baseline, red if it lags). Main message text + a secondary "cost" line. Two action buttons on the right (re-lock, clear baseline).

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

Hides: toggles, buttons, lock button, delta-bar action buttons, chart series-toggle buttons. Everything with class `.no-print` is suppressed.

Shows: everything else. The print summary block is pushed to a new page with `page-break-before: always` to keep the interactive chrome separate from the compliance document.

Every calculator must be reviewed in print preview before shipping. Print-only regressions are subtle and common — a button that accidentally prints, a header that doesn't repeat on page 2, a table cut off mid-row.

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour transitions already in place.
- Don't introduce a second accent colour. Gold exists but is reserved.
- Don't use weight 700. Medium (500) is the boldest weight in this system.
- Don't use emoji. Not in the UI, not in tooltips, not in print.
- Don't replace Chart.js defaults with Chart.js plugins. Stock Chart.js is capable enough.
