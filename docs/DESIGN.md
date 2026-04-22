# Design

The visual system for the accumulation calculator. These choices are deliberate — don't drift from them without a conversation.

## Philosophy

**The calculator is a conversation tool, not a dashboard.** It gets opened during a client meeting, the adviser moves inputs while the client watches, and a PDF is printed and emailed. That context dictates every visual choice:

- Legible at 2m on a shared laptop, printable to A4 without cropping.
- Professional advisory-firm aesthetic, not fintech-startup. Warm paper, not cold slate.
- No unnecessary motion, no loading states, no "oh did you see that?" animations.
- Editorial voice: a serif headline does more than a bold sans number.
- Everything that matters fits above the fold on a 13-inch screen.

## Three states, one canvas

The UI has three visual states driven by the user's progress through the flow. They live inside **one** component tree — the root `<div class="calc" data-view="empty|filled|compare">` — and view-specific nodes carry a `data-view-only="empty|filled|compare"` attribute that JS toggles on/off.

State derivation (`deriveViewState()`): if a baseline is locked → `compare`; else if the plan looks complete (at least one balance, a retirement age, at least one non-default spouse name) → `filled`; else → `empty`. Locking a baseline sets `baseline = scenario`; clearing sets it back to `null`.

- **Empty** — title-page setup: centred `A plan for the ___ family.` headline with the family name as an inline editable span, two-column spouse setup with dashed-border field pills, a foot band showing retirement-age + market defaults, and a dashed preview placeholder.
- **Filled** — the working single-scenario view. Plan-inputs bar (collapsed) on top, editorial headline + Real/Nominal + Lock button on the canvas head, chart card with Capital / Breakdown / Table segmented control, three-cell outcome strip, narrative, canvas foot.
- **Compare** — the hero interaction. Plan-inputs bar, compact head with "Scenario compare · baseline locked" eyebrow, two-up compare grid (muted baseline card + navy-ringed scenario card, each with their own chart), centred legend, Scenario Levers panel below.

## Design tokens

All tokens live as CSS variables on `:root`. If the palette needs to change, change it there, not in component rules.

```css
:root {
  /* Ink / paper */
  --ink:      #1a1f26;   /* primary text */
  --ink-2:    #3a4250;   /* secondary text, muted hero numbers */
  --mute:     #7a8292;   /* labels, tertiary text */
  --faint:    #b4bac4;   /* placeholders, middot separators */
  --hairline: #e4e1d8;   /* card borders, dividers */
  --line:     #d4cfc2;   /* stronger borders, dashed fields */
  --paper:    #faf7f0;   /* canvas background (warm off-white) */
  --paper-2:  #f2ede2;   /* plan-bar, muted baseline card */
  --paper-3:  #ebe4d3;   /* deeper warm panel */
  --surface:  #ffffff;   /* cards, inputs */

  /* Brand */
  --navy:      #1f2d3d;   /* primary accent — scenario card, primary button */
  --navy-2:    #2d3e50;   /* older brand navy, still used in a few places */
  --navy-soft: #38495b;   /* navy hover */
  --gold:      #b8893c;   /* discretionary bar, slider fill */
  --gold-2:    #9c7226;   /* gold text, deltas, roman numerals */
  --gold-soft: #e3c987;   /* gold-under headline accent */
  --gold-pale: #f5ebd1;   /* delta chip background */

  /* States */
  --pos: #2f6b3a;
  --neg: #a64236;

  --serif: 'Fraunces', Georgia, serif;
  --sans:  'Inter Tight', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono:  'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --r-sm: 4px;     /* inputs, chips */
  --r:    6px;     /* buttons */
  --r-lg: 10px;    /* cards, chart card, empty preview */
}
```

The warm paper background (`--paper`) is the most important colour choice in the system. It makes the page read like paper rather than a web app. Don't drift toward `#f8f9fa` or any cold grey.

## Typography

Three families, loaded from Google Fonts via `<link>` tags in `<head>`:

- **`--serif` — Fraunces.** Editorial headlines, hero numbers, empty title, spouse names, narrative body, compare hero values. Weights 300 / 400 / 500. Uses its italic variant for emphasised words (`em`).
- **`--sans` — Inter Tight.** UI labels, buttons, body text. Weights 400 / 500 / 600.
- **`--mono` — JetBrains Mono.** Any numeric value: inputs with numbers, y-axis labels, dates, the `.num` class. Always paired with `font-variant-numeric: tabular-nums` so headline and body numbers don't reflow when digits change.

Base body: 14px / 1.5 / Inter Tight. Never use weight 700.

Scale:

- Empty title: 44px serif 300, letter-spacing −0.6px
- Filled headline: 44px serif 300, letter-spacing −0.6px (compact compare head: 42px / 1.08)
- Compare hero value: 52px serif 400 (baseline muted to `--ink-2` 300; scenario in `--navy`)
- Outcome-cell value: 28px serif 400 (primary navy cell: 34px)
- Plan-bar fact value: 13px / 500
- Canvas eyebrow: 10px uppercase sans, letter-spacing 2.2px
- Field label / slider label: 11px / --mute
- Field input value: 13px mono
- Delta chip: 11px mono

`.gold-under` gives a headline span a soft gold underscore accent — the absolute-positioned `::after` paints a 6px stripe of `--gold-soft` behind the text at 55% opacity.

## Layout

- Root padding: 28px 44px 40px (`.calc`).
- Max width: `1180px`, centred (`.page`).
- Card radii: `var(--r-lg)` = 10px for the chart card, compare cards, outcome strip, narrative, scenario-levers panel, empty preview.
- Button radii: `var(--r)` = 6px.
- Card borders: 1px `--hairline`. The scenario card additionally carries a navy ring: `0 0 0 1px var(--navy), 0 4px 12px rgba(31,45,61,0.06)`.
- Card padding: 18–22px (cards); 22–24px (chart card, compare cards).
- Grid gap on the two-up compare: 22px. Plan-bar drawer: 28px between columns.
- Spacing uses the 4 / 6 / 8 / 10 / 14 / 18 / 22 / 28 / 32 / 44 px values seen in the prototype. No strict scale.

## Component conventions

### Plan-inputs bar + drawer

A horizontal summary strip always present in State 2 and State 3. Left: SW logo-mark circle + `Simple Wealth` brand + the client name (or placeholder). Middle: five fact cells — `Household`, `Combined starting capital`, `Monthly contributions`, `Retire at`, `Return · CPI`. Each is a 9.5px uppercase label over a 13px value (numbers in mono). Right: a ghost `Edit plan ↓` button.

Clicking `Edit plan ↓` sets `data-open="true"` on the bar; CSS makes the drawer grid visible. Drawer has three columns: Household (both spouses with their four balance + contribution fields, age input, and editable name span), Retirement + Capital events (retire-when anchor + add-event button), Market assumptions (three thin sliders + a "Meeting" sub-section with the Prepared-for / date fields). Roman-numeral italic gold markers (`I.`, `II.`, `III.`, `IV.`) tag the columns, matching the empty-state setup labels.

The drawer is hidden in print — the collapsed one-line summary is what lands on page 1.

### Outcome strip (State 2 only)

A flex row of three cells separated by 1px hairlines, wrapped in a card. The first cell is `.primary` — filled navy, paper-white text — and carries the big Monthly income number (34px serif). The other two are white with muted labels. Structure per cell: `.ocap` (10px uppercase mute label), `.oval` (serif number), `.osub` (11px mute sub).

Baseline comparison numbers no longer live on the outcome strip — State 3's compare cards handle that, so the strip stays unchanged between load and lock.

### Compare grid (State 3)

`grid-template-columns: 1fr 1fr; gap: 22px`. Two `.compare-card` panels.

- **Baseline** — `background: var(--paper-2)`. Head shows `BASELINE · CURRENT PLAN` tag and a `LOCKED` micro-label. Hero number in `--ink-2`, serif weight 300 (muted). Sub-line: "monthly income · {capital} capital". Chart below renders at 35% opacity, sharing the same y-axis ceiling as the scenario chart. Four meta rows across the bottom — Retirement contrib, Discretionary contrib, Expected return, Retire at — numbers in mono.
- **Scenario** — white surface, 1px `--navy` border, navy ring box-shadow. Head: `PLANNED SCENARIO` tag in navy plus a gold delta chip reading `+ R 11 400 / mo` (flips to `.neg` with a red-pale background when the delta is negative, empty when there's no change). Hero in `--navy`. Full-opacity chart. Same meta-row structure, but with inline `em` deltas in `--gold-2` beside any changed value.

Both charts are independent Chart.js instances (`#chart-compare-baseline`, `#chart-compare-scenario`). `buildCompareCharts(p)` computes a shared y-ceiling from `max(baseline.total, scenario.total) × 1.05` so bars are visually comparable across the two cards, regardless of which scenario sits larger.

Below the two cards: a centred `Retirement fund · Discretionary` legend (one row) and then the Scenario Levers panel.

### Scenario levers (State 3)

Four-column grid of thin sliders inside a single card — Retirement contributions, Discretionary contributions, Expected return, Retirement age. Each slider has a label, a mono readout (with a small gold `delta` pill when the slider is off-centre), a 2px track in `--line`, and a 12px circle thumb with a 1.5px `--gold-2` border on a white surface. Ranges centre on the locked baseline: contributions ±R10 000/mo (step R500), return ±2 pp (step 0.5 pp), retirement age ±5 yr (step 1).

Moving a slider writes back into the underlying `#hp-*`, `#return`, or `#retirement-age` inputs and kicks the normal projection pipeline. Contribution deltas split proportionally between spouses A and B based on their baseline share. The panel is hidden in print (`.no-print`).

### Narrative "In plain terms" card (State 2 only)

Below the outcome strip. Card styling matches the others, with a 2px gold vertical rule (`.narrative::before`) down the left edge. Eyebrow `IN PLAIN TERMS` in 10px uppercase mute. Body is 15.5px serif 300 in `--ink-2`, max-width 680px, with `<strong>` set in `--ink` medium. In State 3 the narrative is hidden entirely — the compare cards ARE the narrative visually.

**No em-dashes** (U+2014) anywhere in the narrative copy. They read as dashboard shorthand, don't parse well when read aloud in a client meeting, and make the prose feel clipped. Use commas, full stops, or rephrase. Two JS tests enforce this by asserting the U+2014 character does not appear in any `describe*()` output.

### Chart (State 2)

Chart.js with heavy default overrides. The chart card's header carries a custom HTML legend (Retirement fund in navy, Discretionary in gold, plus three breakdown keys that swap in when `Breakdown` is selected). Chart.js's built-in legend is disabled.

Three views, toggled by the `.seg.mini` control:

- **Capital** — stacked bars, gold `#b8893c` discretionary on the bottom, navy `#1f2d3d` retirement fund on top. 280px tall.
- **Breakdown** — stacked bars, grey `#9aa0a9` starting-capital-compounded at the bottom, darker grey `#5e6470` cumulative contributions in the middle, gold growth-on-contributions on top. The three layers sum to the total.
- **Table** — HTML table (not Chart.js) rendered into the same chart-card slot. Sticky year column, one row per year, columns for age A / age B / retirement / disc / total / annual contributions. When a baseline is locked (not relevant in State 2, but left in for re-lock flows), two extra columns (baseline total, delta). `font-family: var(--mono)` on the cells, `font-family: var(--sans)` on the head.

Y-axis labels are mono 10px in `--mute`. X-axis uses 10px mono for age labels.

### Sliders

Two flavours in the codebase:

- **Thin rail (used everywhere now)** — 2px track in `--line`, 12px circle thumb with a 1.5px `--gold-2` border on `--surface`, subtle 1px rgba shadow. `input[type="range"].thin`. Used by the drawer market-assumption sliders and the State 3 scenario levers.

The old 18px navy thumb / 4px track is gone.

### Capital events list

Rendered inside the drawer's column 2. One row per event, 4-column grid: kind dropdown, age input, a flex cell holding `R`-prefix amount input + today's-money checkbox + year label, delete button. The year label reads `y+5 · 2031` (offset + calendar year). Head row uses 10px uppercase mute labels.

Adding an event auto-opens the drawer if it's closed. Default new event: inflow of R500k at reference-age + 10, in today's money.

### Delta chip

Small mono pill. `.delta-chip` renders 11px mono on `--gold-pale` with `--gold-2` text; `.delta-chip.neg` swaps to a red-pale background with `--neg` text. Used by the scenario card in State 3, and reusable anywhere a bounded numeric delta needs visible emphasis.

### Buttons

Three variants of `.btn`:

- Default — 1px `--hairline` border, `--surface` background, `--ink` text, radius 6px.
- `.primary` — filled `--navy`, `--paper` text. "Lock as baseline →" and "Re-lock as new baseline" use this.
- `.ghost` — transparent, `--mute` text, no border. Used for Clear baseline, Edit plan, Table view, and a few other low-emphasis actions.

### Empty state (State 1)

Unique visual vocabulary — no cards, no drawer. Centred title plate with `Simple Wealth · Retirement projection` eyebrow (10px uppercase 2.4px tracking), the serif 44px headline with an inline editable `empty-family` span (dashed underline, italic placeholder "the _______ family" that disappears on focus), and a mono 11px `Prepared {date}` line. Below: a 1fr / 1px / 1fr grid with the two spouse columns separated by a hairline divider. Each column has a step label (Roman numeral italic gold + uppercase `SPOUSE A/B`), a serif 26px first-name input sitting over a dashed hairline, a right-aligned age input, then four `empty` field pills (dashed border, `R` prefix, placeholder `—`).

A border-top/bottom foot band below the setup grid shows the retirement-age input on the left and the market-assumptions default read-out (`10% · 5% · 6%`) on the right. At the bottom, a dashed preview placeholder holds the italic "The projection will appear here".

Input fields in the empty state are shadow inputs — they carry `data-sync-to="hp-ret-A"` etc. attributes and write their values into the canonical drawer inputs on blur, triggering the normal refresh pipeline. Spouse-name inputs use `data-sync-spouse-name="A"` to write into `spouseNames`.

## Print

```css
@media print { ... }
```

Two-zone PDF.

- **Page 1** is the client-facing view: plan-bar (collapsed, drawer hidden), canvas head (headline or compact compare head), the chart card (State 2) or the compare grid (State 3), outcome strip (State 2) or centred compare legend (State 3), narrative (State 2 only). Scenario levers and canvas-foot actions are hidden.
- **Pages 2+** are the compliance appendix: three `<details class="accordion">` blocks (detail tables, methodology, disclaimer) forced open and flattened. `page-break-before: always` on `.print-summary` starts it on a fresh page.

Hidden in print via `.no-print` / explicit rules: the `Edit plan ↓` button, the `.canvas-actions` cluster (Real/Nominal, Lock, Clear, Re-lock), the `.canvas-foot-actions` (Table view, Print/PDF), the scenario levers panel.

Headlines and chart heights are tuned down for print (28px headline, 260px chart wrap, 220px compare-chart wrap). Two handlers keep Chart.js sized correctly:

- `beforeprint` + `afterprint` — for interactive Cmd+P.
- `window.matchMedia('print').addEventListener('change', …)` — for headless `--print-to-pdf`, which does not fire `beforeprint`.

Both call `resizeChartsToWrap()`, which iterates every chart container (main + both compare canvases) and calls `chart.resize(w, h)` with explicit dimensions inside `requestAnimationFrame`. Explicit dims — rather than letting Chart.js re-read the parent — is what fixes the Session 2/3 regression where headless prints rendered the bitmap at screen-size dimensions and painted it into a fraction of the print wrap.

Every calculator must be reviewed in print preview before shipping. Print-only regressions are subtle and common.

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour transitions already in place.
- Don't introduce a second accent colour. Gold exists but is reserved.
- Don't use weight 700. Medium (500) is the boldest weight in this system.
- Don't use emoji. Not in the UI, not in tooltips, not in print.
- Don't use em-dashes (U+2014) in narrative prose. Ever.
- Don't replace Chart.js defaults with Chart.js plugins. Stock Chart.js is capable enough.
- Don't hard-code colours in JS (Chart.js dataset colours are the exception — they use `rgba(…)` with token-matched values).
- Don't add a fourth state. If a new flow is needed, collapse it into one of the three or discuss before building.
