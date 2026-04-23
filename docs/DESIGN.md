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

State derivation (`deriveViewState()`): if a baseline is locked → `compare`; else if the adviser has clicked the "See current projection" CTA at the bottom of State 1 (setting the `projectionRequested` flag) → `filled`; else → `empty`. The gate is purely user-initiated — typing names and balances does NOT transition; only the CTA click does. Locking a baseline sets `baseline = scenario`; clearing sets it back to `null` (which returns to State 2, not State 1, because `projectionRequested` stays true for the session).

- **Empty** — title-page setup: centred `A plan for the ___ family.` headline with the family name as an inline editable span, two-column spouse setup with dashed-border field pills, a foot band showing retirement-age + market defaults, and a centred "See current projection" primary CTA button at the bottom.
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

A horizontal summary strip always present in State 2 and State 3. Left: SW logo-mark circle + `Simple Wealth` brand + the client name (or placeholder). Middle: five core fact cells — `Household`, `Combined starting capital`, `Monthly contributions`, `Retire at`, `Return · CPI` — plus a sixth `Income goal` cell that only appears once the adviser sets a goal (hidden via `data-goal-active="false"` until then). Each is a 9.5px uppercase label over a 13px value (numbers in mono). Right: a ghost `Edit plan ↓` button.

Clicking `Edit plan ↓` sets `data-open="true"` on the bar; CSS makes the drawer grid visible. Drawer has three columns: Household (both spouses with their four balance + contribution fields, age input, and editable name span), Retirement + Capital events + Household goal (retire-when anchor, add-event button, and the canonical `#income-goal` input under a `V.` head), Market assumptions (three thin sliders + a "Meeting" sub-section with the Prepared-for / date fields). Roman-numeral italic gold markers (`I.`, `II.`, `III.`, `IV.`, `V.`) tag the sections, matching the empty-state setup labels.

The drawer is hidden in print — the collapsed one-line summary is what lands on page 1.

### Outcome strip (State 2 only)

A flex row of three cells separated by 1px hairlines, wrapped in a card. The first cell is `.primary` — filled navy, paper-white text — and carries the big Monthly income number (34px serif). The other two are white with muted labels. Structure per cell: `.ocap` (10px uppercase mute label), `.oval` (serif number), `.osub` (11px mute sub).

When the adviser has set a retirement-income goal, the primary cell gains a second `.osub` (`#sum-income-goal`) reading `Goal R 80 000 / mo · on track to 108% of target`. The percent picks up `.goal-progress-on-track` (gold, weight 500) at or above 100% and `.goal-progress-behind` (ink-2, plain) below. Never red — this is a motivational readout in a client meeting, not a warning. When no goal is set, the sub-line is hidden via `data-goal-active="false"` and the strip reads exactly as it does today.

Baseline comparison numbers no longer live on the outcome strip — State 3's compare cards handle that, so the strip stays unchanged between load and lock.

### Compare grid (State 3)

`grid-template-columns: 1fr 1fr; gap: 22px`. Two `.compare-card` panels.

- **Baseline** — `background: var(--paper-2)`. Head shows `BASELINE · CURRENT PLAN` tag and a `LOCKED` micro-label. Hero number in `--ink-2`, serif weight 300 (muted). Sub-line: "monthly income · {capital} capital". Chart below renders at 35% opacity, sharing the same y-axis ceiling as the scenario chart. Four meta rows across the bottom — Retirement contrib, Discretionary contrib, Expected return, Retire at — numbers in mono.
- **Scenario** — white surface, 1px `--navy` border, navy ring box-shadow. Head: `PLANNED SCENARIO` tag in navy plus a gold delta chip reading `+ R 11 400 / mo` (flips to `.neg` with a red-pale background when the delta is negative, empty when there's no change). Hero in `--navy`. Full-opacity chart. Same meta-row structure, but with inline `em` deltas in `--gold-2` beside any changed value.

Both charts are independent Chart.js instances (`#chart-compare-baseline`, `#chart-compare-scenario`). `buildCompareCharts(p)` computes a shared y-ceiling from `max(baseline.total, scenario.total) × 1.05` so bars are visually comparable across the two cards, regardless of which scenario sits larger.

**Goal-progress meta row.** When a retirement-income goal is set, both cards show a fifth meta row reading `Goal progress · 108% of R 80 000`. The scenario card carries an inline `em` delta formatted as `±N pp` (percentage-point delta vs baseline); the `setMetaDelta` helper's `'pp'` kind handles rounding and sign. Both cards read against the *current* goal, not a snapshot frozen with the baseline lock — the goal is an adviser-level target rather than a projection assumption, so it should move with the conversation. When no goal is set, both rows are hidden via `data-goal-active="false"` and the card reads exactly as it did before the feature landed.

Below the two cards: a centred `Retirement fund · Discretionary` legend (one row) and then the Scenario Levers panel.

### Scenario levers (State 3)

Four-column grid of thin sliders inside a single card — Retirement contributions, Discretionary contributions, Expected return, Retirement age. Each slider has a label, a mono readout (with a small gold `delta` pill when the slider is off-anchor), a 2px track in `--line`, and a 12px circle thumb with a 1.5px `--gold-2` border on a white surface. Ranges: **contributions ±R30 000/mo** (step R500, floor-clamped at R0), **retirement age ±10 yr** (step 1, bounded by the 50–75 input limits). The **expected return** slider is a fixed **0% → 15%** scale (step 0.5 pp) rather than a ± window around the anchor — a macroeconomic range gives the thumb position a constant meaning across clients. The return readout carries an inline `· baseline X.XX%` note so the anchor is always visible.

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

Unique visual vocabulary — no cards, no drawer. Centred title plate with `Simple Wealth · Retirement projection` eyebrow (10px uppercase 2.4px tracking), and the serif 44px headline `A plan for the [______] family.` — where `[______]` is an inline editable span (`#family-name`) carrying only the surname placeholder. The static words `the` and `family.` live in text nodes on either side of the span, so they survive focus-clear + type-over. The span uses a dashed underline, italic placeholder "`_______`", and `white-space: nowrap` to keep a long surname on one line with the suffix. A mono 11px `Prepared {date}` line sits below. Below that: a 1fr / 1px / 1fr grid with the two spouse columns separated by a hairline divider. Each column has a step label (Roman numeral italic gold + uppercase `SPOUSE A/B`), a serif 26px first-name input sitting over a dashed hairline, a right-aligned age input, then four `empty` field pills (dashed border, `R` prefix, placeholder `—`). The two monthly-contribution pills read `Monthly retirement contributions` and `Monthly discretionary contributions` — the word "contributions" is explicit so the adviser doesn't mis-read the field as a balance.

A border-top/bottom foot band below the setup grid holds two inline surfaces on row 1 (separated by a hairline divider) plus a full-width row 2 for the income goal.

- **Row 1 · Left — Retire when.** Reads as a sentence: `Retire when [Name A] · [Name B] reaches [65]`. The two names are `.empty-name-chip` buttons rendered in serif 22px Fraunces 300, matching the title-plate voice. Unselected: `--mute`. Selected (`.is-on`): `--ink` with a 2px `--gold-2` underline at 6px offset. Clicking a name delegates to `setAnchor()` after deriving `'youngest'` or `'oldest'` from the current ages — the internal anchor model is unchanged. The age input is the same mono-numeric pill as before.
- **Row 1 · Right — Market assumptions.** A 3-row grid (label + thin slider + mono readout) for Return, CPI, and Escalation. Each slider is a shadow input (`#empty-return` / `#empty-cpi` / `#empty-esc`) that pipes live into the canonical `#return` / `#cpi` / `#esc` via `data-sync-to` + an `input`-event sync branch. Readouts (`#empty-*-out`) are mirrored into by `updateSliderLabels()` on every `refresh()`. Layout uses `display: contents` on the `.empty-assump-row` `<label>` so label + slider + readout align directly in the outer 3-col grid without an extra wrapper box.
- **Row 2 (full width) — Retirement income goal.** Reads as a sentence: `Aim for [R ___] per month, in today's money.` The input (`.empty-goal-input`, containing a dashed-pill `R`-prefix + numeric input with `data-sync-to="income-goal"`) sits centred between two serif 22px Fraunces 300 spans that carry the copy. Separated from row 1 by an 18px top border + 18px top margin so it reads as a deliberate "set your target" step. Default is blank — there's no anchor value; the adviser types it during every meeting. Progress readouts in States 2/3 and the print/export outputs stay hidden until the field is populated (via `data-goal-active="false"`).

At the bottom, a centred `.empty-cta` container holds the `#btn-see-projection` primary button (navy fill, paper text, 12×28 padding). Clicking it sets `projectionRequested = true` and calls `refresh()`, which re-runs `deriveViewState()` and flips the canvas to State 2. Hidden in print via `.empty-cta` in the `@media print` hide list.

Input fields in the empty state are shadow inputs — they carry `data-sync-to="hp-ret-A"` etc. attributes and write their values into the canonical drawer inputs on blur (or on `input` for range sliders), triggering the normal refresh pipeline. Spouse-name inputs use `data-sync-spouse-name="A"` to write into `spouseNames`. These syncs do NOT transition State 1 → State 2 — only the CTA click does.

**Default market assumptions.** All three canonical inputs default to 5% (return, CPI, escalation). The State 1 slider thumbs and readouts mirror that. A first-meeting projection with defaults therefore shows a 0% real return before escalation — a deliberate conservative framing, so every assumption the adviser dials in thereafter tends to make the number look better, not worse.

**Default income goal: blank.** Unlike the market assumptions, the goal has no default value. The adviser enters it during every meeting as part of the target conversation, and every downstream progress surface stays hidden until they do. If the adviser never touches the goal field, the calculator renders exactly as it does without the feature.

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

## Export deck (A4 landscape, 12 pages)

A separate, opt-in print mode producing a client-facing deliverable. Triggered by the plan-bar **Export report** button; coexists with the portrait print path without touching it.

**Two print paths, two purposes.**

- *Working copy* — canvas-foot "Print / PDF" or plain Cmd+P. Portrait. Client view on page 1, 3-accordion compliance appendix on pages 2+. Internal use, back-office.
- *Client deliverable* — plan-bar "Export report". Landscape. 12-page deck, editorial voice, meant to be emailed or printed to hand over.

They never collide: export mode gates are set only by `startExport()` and cleared on `afterprint`. Working-copy flows never touch them, so the existing portrait `@media print` rules remain authoritative there.

**The deck.** 12 pages, two conditional (auto-hidden when inactive):

1. **Cover** — `A plan for the [Family] family.` in Fraunces 300 / 82px with italic `family.` and a 2px gold underline on the family name. Foot strip: Prepared for / Prepared on / Adviser + FSP 50637 / page mark.
2. **The Answer** — eyebrow + Fraunces 300 / 40px headline with `gold-under` on the monthly-income number. Full-width real-money stacked chart (gold discretionary / navy retirement). Outcome strip (navy-filled primary cell for monthly income). `describeCurrentPosition` narrative with gold vertical rule.
3. **Household** — two-spouse editorial grid, 1px hairline divider down the middle. Each column: Fraunces 30px name + mono age, five label/value rows (retirement balance, discretionary balance, monthly retirement contribs, monthly discretionary contribs), and a navy-italic "Combined starting capital" total row above a 2px navy rule.
4. **Assumptions** — 5-row editorial table (return / CPI / escalation / retirement trigger / drawdown) + aside on warm `--paper-2` with a 3px gold left-rule and three short paragraphs ("long-term planning assumptions, not forecasts", stress-test cadence, today's money framing).
5. **Projection** — full-width nominal stacked chart at 90mm height + three-cell foot strip (starting capital today / at retirement real / at retirement nominal).
6. **Breakdown** — two-column: 3-layer decomp chart on the left (starting-compounded grey + cumulative contributions darker grey + growth-on-contribs gold) + three slab cards on the right, each with a coloured swatch + mono value + one-line serif explanation.
7. **Capital events** (conditional) — summary strip (count, total inflows in green `--pos`, total outflows in red `--neg`) + tabular list with kind badge, age, year, basis ("Today's money" or "Future rands"), amount. Out-of-horizon events are listed at 55% opacity with an "(outside horizon)" marker.
8. **Compare** (conditional, baseline locked) — two side-by-side cards. Baseline on `--paper-2`, muted hero number in `--ink-2` / weight 300. Scenario on white with a 1px navy border + navy ring shadow, hero in `--navy`. Gold delta chip (or red-pale `.neg` chip) above the scenario hero. 60mm charts, shared y-ceiling. Meta rows at the bottom with inline gold deltas beside changed values.
9. **Year-by-year** — full-width table, every 5th year plus the retirement row highlighted in navy with paper text. Columns: year label (serif) + Age A + Age B + Retirement (nominal) + Discretionary (nominal) + Total nominal + Total real. Monospace numerics.
10. **Methodology** — two-column prose: how the capital grows / future-rands-to-today's-money / the 5% rule / the three-part breakdown / capital-events note (dynamic) / what this projection is not. h3 sub-heads in navy uppercase 10px, body in Fraunces 300 / 13px.
11. **Compliance** — two-column prose: not advice + FSP 50637 + POPIA + scope, then risk assumptions + tax treatment (pre-tax) + review cadence. Ends with a tiny-mono footnote.
12. **Next steps** — closing: eyebrow + Fraunces 300 / 72px headline `Let's turn this into your plan.` with italic `your` and gold-under on `your plan`. Three gold-left-ruled cells (Review & refine, Action, Next review). Foot with branded lockup and date.

**Visual tokens.** No new tokens. The deck uses the existing `--paper`, `--navy`, `--gold`, `--gold-2`, `--ink`, `--ink-2`, `--mute`, `--hairline`, `--paper-2`, `--serif`, `--sans`, `--mono` vocabulary. The one new accent pattern is the Roman-numeral italic gold tag (`.export-rom` class) applied in page eyebrows, carrying the same editorial voice as the I./II./III. markers in the plan-bar drawer.

**Page geometry.** `.export-page { width: 297mm; min-height: 210mm; padding: 14–16mm × 18–22mm; }`. On screen the pages are stacked vertically with a 14px hairline gap and a subtle box-shadow so the adviser can scroll-preview before printing. In print (`html.export-printing`), the shadow and gap are stripped; each page fills its printed sheet.

**Conditional pages.** `.export-page[data-export-page-active="false"] { display: none; }`. Toggled by `buildExportDeck()` based on `eventsStore.length > 0` (events page) and `baseline !== null` (compare page). Pages renumber automatically so the document always reads as a coherent sequence: 10 pages default, 11 with events OR baseline, 12 with both.

**Em-dash rule — strictly enforced in static copy.** Methodology, compliance, next-steps, and the assumptions aside were hand-written specifically to avoid em-dashes; placeholder slots (`R —`, `——` inside `<span data-bind="...">`) are allowed because they're overwritten at runtime by `setBindText` from em-dash-free sources. JS tests (`export: static prose copy has no em-dashes`) assert this invariant with zone-scoped regexes that strip `data-bind` spans before scanning.

**When to update.** Any visual change to this deck goes through a print-preview review. The deck is the document the adviser hands to the client; a regression here is visible in a way a screen-only regression isn't.

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
