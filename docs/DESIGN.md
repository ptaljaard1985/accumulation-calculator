# Design

The visual system for the accumulation calculator. These choices are deliberate — don't drift from them without a conversation.

## Primary file: V2 cockpit (`retirement_accumulation_v2.html`)

`retirement_accumulation_v2.html` is now the **primary** file — the active "Private Client Planning Cockpit" redesign. The original `retirement_accumulation.html` and the warm-paper / Fraunces system documented in the rest of this file remain on record, but the cockpit is what's being developed. Where a section below describes State 2 (the working view), the appendix, the year-table, or the canvas-foot buttons, read it through the "(v2)" notes that follow — the cockpit reworks those.

The cockpit's visual direction differs from the original warm-paper editorial system:

- **Inter (sans) throughout.** No serif. The `--serif` token is aliased to `--sans`, so the editorial Fraunces headlines, hero numbers, and spouse names of the original system are now rendered in Inter. The voice is a planning cockpit, not a magazine layout.
- **Cockpit brand-blue.** `--navy` / `--brand` = `#323E5D` — a deeper, bluer brand than the original `--navy: #1f2d3d`. Used for the top bar, primary actions, and the scenario emphasis.
- **Warmer paper.** The canvas background is warmer than the original `--paper`.
- **Full-bleed sticky top bar.** A sticky bar spans the full width, carrying an avatar, a `<Client> retirement plan` title, and a subtitle. It replaces the plan-bar identity strip's old role as the page header.
- **Card shadows.** Cards carry a soft `--shadow-sm` — a departure from the original system's "no shadows beyond the scenario card's navy ring" rule.
- **Gold range thumbs.** Slider thumbs are gold.

### This session's State-2 layout / interaction changes (v2)

1. **Plan-bar edit button is a fixed `Edit info ↓`** in all states. (It previously changed label between "Advisor view" / "Edit plan ↓" / "Close ↑".)

2. **State-2 head row removed.** The old row above the chart that held a Real/Nominal toggle and a "Lock as baseline →" button is gone. The Real/Nominal toggle now lives in the **chart-card head**, immediately left of the Income/Capital/Breakdown/Table view toggle (a `.chart-head-toggles` group). Locking a baseline is now done from the **top-bar "Compare" button** — there's no separate Lock button. So State 2 reads top to bottom: **top bar → chart card → outcome strip → "Current plan" recap card → foot.**

3. **New "Current plan" recap card** (State 2, below the outcome strip). A two-column-per-spouse card echoing the State-1 two-column setup. Eyebrow `Current plan`. Each spouse column (header = the spouse's name) lists Retirement balance, Discretionary balance, Monthly retirement contributions, Monthly discretionary contributions. Below a divider, an assumptions row: Expected return · Assumed inflation · Escalation. **Session 23** adds a "Capital events" sub-section below the assumptions (`.plan-recap-events`, hairline top border): up to the first three events as `Age · Inflow/Outflow · amount · basis` rows, then "N additional event(s) modelled." when there are more, or "No capital events modelled." when empty. It is a derived readout of the current inputs — the projected capital-at-retirement is deliberately **not** shown here (that's the chart + outcome strip's job). Standard surface / border / `--r-lg` / `--shadow-sm` chrome; stacks to one column at ≤820px; prints on page 1.

4. **Appendix is now a single `Methodology & disclaimer` toggle box** that expands to methodology + disclaimer only. The former "Detail tables" sub-accordion (client/meeting, starting position, contributions & assumptions, projected outcome, capital events, baseline comparison) was removed — that detail now lives in the on-screen recap card and in the Report deck. This thins the portrait Cmd+P output: it keeps inputs via the recap card, outputs via the outcome strip + chart, plus methodology and disclaimer. The Report deck remains the full client deliverable.

5. **Canvas feet lost their action buttons.** State 2 dropped "Table view" and "Print / PDF"; State 3 dropped "Print / PDF". Table view is reachable from the chart-head Table toggle; exporting is the top-bar gold **"Report"** button. The "Illustrative only…" foot text remains.

6. **Table view (year-by-year) is a reconciliation flow.** Columns: Year · Age A · Age B · Opening · Contributions · Growth · [Capital events, shown only when events exist] · Closing — so the adviser can follow the totals start to finish (`Opening + Contributions + Growth (+ Events) = Closing`; each Closing equals the next year's Opening). It respects the Real/Nominal toggle: nominal mode shows nominal growth; real mode shows real growth, net of inflation.

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
- **Filled** — the working single-scenario view. Plan-inputs bar (collapsed) on top, a plain `Retirement plan` h1 over a short italic-serif sub-line (`[Name] retires at age 65.` — Session 16 trimmed the income figure out of it, since the outcome strip carries that number loudly right below), Real/Nominal + Lock button on the canvas head, chart card with Income / Capital / Breakdown / Table segmented control (Income is the default view), a two-part outcome strip (navy Monthly income cell + the closing-the-gap / contribution-leverage cell beside it), canvas foot, and a single collapsed compliance toggle. Session 17 reduced the stack below the chart to a single strip: the Household-capital and Years-to-retirement cells were removed and the standalone "In plain terms" narrative card dropped (it only restated the income number the navy cell already shows), with the closing-the-gap content folded in as the strip's right-hand cell. So the chart + that one strip carry the meeting. **(v2)** The cockpit drops the head row entirely (no Real/Nominal + Lock row above the chart) and moves the Real/Nominal toggle into the chart-card head beside the view toggle; locking a baseline moves to the top-bar "Compare" button. Below the outcome strip it adds a "Current plan" recap card, so v2 State 2 reads top bar → chart card → outcome strip → recap card → foot, and the canvas foot carries text only (no buttons).
- **Compare** — the hero interaction. Plan-inputs bar, compact head with `Scenario compare · baseline locked` eyebrow over a `Compare scenarios` h1 + sub-line `Baseline locked. Move the levers below to test alternatives.`, two-up compare grid (muted baseline card + navy-ringed scenario card, each with their own chart), centred legend, Scenario Levers panel below.

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
- Filled / Compare headline: 44px serif 300, letter-spacing −0.6px (compact compare head: 42px / 1.08). Session 12 changed the copy to plain section titles (`Retirement plan`, `Compare scenarios`); the sentence detail now lives in the italic-serif sub-line below.
- Headline sub-line: 16px italic serif 300 in `--mute`, 13px in print. Carries the factual sentence with mono-numeric spans for age + income (State 2) or instructional copy (State 3).
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

A horizontal identity strip always present in State 2 and State 3. Left: SW logo-mark circle + `Simple Wealth` brand + the client name (or placeholder, `#plan-bar-for`). Right: a `.plan-bar-actions` cluster (`flex: 1; justify-content: flex-end`) holding ghost `Save plan`, `Open plan`, `Export report` buttons and the **primary (navy)** `Edit plan ↓` button. Save/Open are file-based persistence — see ARCHITECTURE §14; restore is always an explicit click (no auto-rehydrate). Because the plan-bar is hidden in State 1, the empty state carries its own `Open a saved plan` ghost button so a fresh page can still restore.

**Session 16 stripped the six summary fact cells** (`Household`, `Combined starting capital`, `Monthly contributions`, `Retire at`, `Return · CPI`, `Income goal`) out of the strip. The diagnosis was a count problem, not a style one: ~eleven equal-weight elements in one row left the eye nowhere to land, and the cells only echoed back numbers the adviser had just typed into setup (and which the outcome strip / chart already show). The header now carries one job — identity plus the primary Edit action. Edit was promoted from ghost to the navy primary button as the strip's anchor.

Clicking `Edit plan ↓` sets `data-open="true"` on the bar; CSS makes the drawer grid visible. Drawer has three columns: Household (both spouses with their four balance + contribution fields, age input, and editable name span), Retirement + Capital events + Household goal (retire-when anchor, add-event button, and the canonical `#income-goal` input under a `V.` head), Market assumptions (three thin sliders + a "Meeting" sub-section with the Prepared-for / date fields). Roman-numeral italic gold markers (`I.`, `II.`, `III.`, `IV.`, `V.`) tag the sections, matching the empty-state setup labels.

The drawer is hidden in print — the collapsed one-line summary is what lands on page 1.

### Outcome strip (State 2 only)

A flex row wrapped in a card, separated by 1px hairlines. The first cell is `.primary` — filled navy, paper-white text — and carries the big Monthly income number (34px serif), with `.ocap` (10px uppercase mute label), `.oval` (serif number), and `.osub` (11px mute sub) sub-elements. **Session 17** removed the two former white cells (Household capital, Years to retirement) and replaced them with a single right-hand cell, `.outcome-gap` (`flex: 2`, so the navy hero keeps roughly its original one-third width), which holds the relocated **closing-the-gap / contribution-leverage** content (see below). When the gap cell is inactive (degenerate horizon) it collapses via `data-goal-active="false"` and the navy cell spans the full width.

When the adviser has set a retirement-income goal, the primary cell gains a second `.osub` (`#sum-income-goal`) reading `Goal R 80 000 / mo · on track to 108% of target`. The percent picks up `.goal-progress-on-track` (green, `--pos`, weight 500) at or above 100% and `.goal-progress-behind` (red, `--neg`, weight 500) below — a binary traffic-light signal. Session 9's "never red" rule was overturned in Session 10 after real-meeting feedback that the gold/ink-2 contrast was too quiet to scan mid-conversation. The rand numbers stay neutral; only the phrase "on track to 108%" / "covers 72%" takes the colour, keeping the tone a focused status badge rather than a loud metric. When no goal is set, the sub-line is hidden via `data-goal-active="false"` and the strip reads exactly as it does today.

Baseline comparison numbers no longer live on the outcome strip — State 3's compare cards handle that, so the strip stays unchanged between load and lock.

### Compare grid (State 3)

`grid-template-columns: 1fr 1fr; gap: 22px`. Two `.compare-card` panels.

- **Baseline** — `background: var(--paper-2)`. Head shows `BASELINE · CURRENT PLAN` tag and a `LOCKED` micro-label. Hero number in `--ink-2`, serif weight 300 (muted). Sub-line: "monthly income · {capital} capital". Chart below renders at 35% opacity, sharing the same y-axis ceiling as the scenario chart. Four meta rows across the bottom — Retirement contrib, Discretionary contrib, Expected return, Retire at — numbers in mono.
- **Scenario** — white surface, 1px `--navy` border, navy ring box-shadow. Head: `PLANNED SCENARIO` tag in navy plus a gold delta chip reading `+ R 11 400 / mo` (flips to `.neg` with a red-pale background when the delta is negative, empty when there's no change). Hero in `--navy`. Full-opacity chart. Same meta-row structure, but with inline `em` deltas in `--gold-2` beside any changed value.

Both charts are independent Chart.js instances (`#chart-compare-baseline`, `#chart-compare-scenario`). `buildCompareCharts(p)` computes a shared y-ceiling from `max(baseline.total, scenario.total) × 1.05` so bars are visually comparable across the two cards, regardless of which scenario sits larger.

**Goal-progress meta row.** When a retirement-income goal is set, both cards show a fifth meta row reading `Goal progress · 108% of R 80 000`. The `108%` is wrapped in a `.goal-progress-on-track` (green) or `.goal-progress-behind` (red) span, matching the outcome-strip treatment. The scenario card carries an inline `em` delta formatted as `±N pp` (percentage-point delta vs baseline); the `setMetaDelta` helper's `'pp'` kind handles rounding and sign. Both cards read against the *current* goal, not a snapshot frozen with the baseline lock — the goal is an adviser-level target rather than a projection assumption, so it should move with the conversation. When no goal is set, both rows are hidden via `data-goal-active="false"` and the card reads exactly as it did before the feature landed.

Below the two cards: a centred `Retirement fund · Discretionary` legend (one row) and then the Scenario Levers panel.

### Scenario levers (State 3)

Four-column grid of thin sliders inside a single card — Retirement contributions, Discretionary contributions, Expected return, Retirement age. Each slider has a label, a mono readout (with a small gold `delta` pill when the slider is off-anchor), a 2px track in `--line`, and a 12px circle thumb with a 1.5px `--gold-2` border on a white surface. Ranges: **contributions ±R30 000/mo** (step R500, floor-clamped at R0), **retirement age ±10 yr** (step 1, bounded by the 50–75 input limits). The **expected return** slider is a fixed **0% → 15%** scale (step 0.5 pp) rather than a ± window around the anchor — a macroeconomic range gives the thumb position a constant meaning across clients. The return readout carries an inline `· baseline X.XX%` note so the anchor is always visible.

Moving a slider writes back into the underlying `#hp-*`, `#return`, or `#retirement-age` inputs and kicks the normal projection pipeline. Contribution deltas split proportionally between spouses A and B based on their baseline share. The panel is hidden in print (`.no-print`).

**Session 11: retirement-age lever is no longer clipped at 50/75.** Previously `configureScenarioSliders()` wrapped the lever range in `Math.max(50, anchor − 10)` / `Math.min(75, anchor + 10)`, which collapsed the usable range when the locked retirement age sat near an old bound. Now it's `anchor ± 10` freely. `applyScenarioRetAge()` similarly stopped clamping the written-back value. Contribution and return levers are unchanged.

### Narrative "In plain terms" card — removed from State 2 (Session 17)

State 2 no longer renders a narrative card. The single-sentence current-position summary (Session 16) duplicated the income figure and goal progress that the navy outcome cell already shows loudly, so it was dropped. State 3 never showed a narrative on screen either (the compare cards ARE the narrative visually).

The `describeCurrentPosition` / `describeBaselinePosition` / `describePlannedScenario` helpers stay in the source — they are extracted and exercised by name in the JS test suite — but they have no on-screen renderer now (`updateNarrative` was removed).

**No em-dashes** (U+2014) anywhere in their copy. They read as dashboard shorthand, don't parse well when read aloud in a client meeting, and make the prose feel clipped. Use commas, full stops, or rephrase. Two JS tests enforce this by asserting the U+2014 character does not appear in any `describe*()` output.

### Closing-the-gap content (State 2 only)

**Session 17** moved this in as the right-hand cell of the outcome strip (`.outcome-gap`), beside the navy Monthly income cell — it was previously a standalone `.narrative`-shelled card below the strip. It keeps its inner `narrative-eyebrow` + `narrative-body` typography (body dialled to 14px to sit in the shorter strip cell) but drops the card chrome and the gold left-rule, since it now reads as a cell within the strip rather than a separate card. Its job is to make the income goal *actionable*.

- **When a goal is set and the projection falls short:** eyebrow reads `Closing the gap`, and the body lists the two single-lever routes to the goal as a small bulleted list (gold middot markers) — "Increase contributions by **R x a month**." and "Or retire **x years later**, at age N." The rand and year figures are set in `--ink` medium (the `<strong>` treatment) against the muted serif body, so the number the client acts on carries the emphasis.
- **When the goal is met, or no goal is set:** eyebrow softens to `Contribution leverage` and the routes drop away. What remains is the one-line leverage readout, shown in every valid-horizon state: "Each extra **R1 000 a month** adds about **R y a month** to retirement income, in today's money." It is set slightly muted (it's context, not the headline).

Visibility uses the generic `data-goal-active` hide flag: the whole card collapses on a degenerate horizon, and the routes block toggles independently of the always-on leverage line. Like the narrative, the card is State 2 only (hidden in States 1 and 3 by `data-view-only="filled"`) and carries the working-copy portrait print. **No em-dashes** in any of its copy (a JS test scans the renderer).

### Chart (State 2)

Chart.js with heavy default overrides. The chart card's header carries a custom HTML legend (Retirement fund in navy, Discretionary in gold, plus three breakdown keys that swap in when `Breakdown` is selected). Chart.js's built-in legend is disabled.

Four views, toggled by the `.seg.mini` control. **Income** is the default first view:

- **Income** — a single line chart, not bars. X-axis is the reference spouse's age (from their current age to the configured retirement age + 10); y-axis is the starting monthly retirement income, in today's money, the household would draw if they retired at that age (the age-based safe withdrawal rate applied to projected real capital at each candidate age; the tooltip shows the rate). Navy line (`rgba(31,45,61,0.95)`), 2px, faint navy fill, no point markers. A dashed navy vertical marker sits at the configured retirement age with a small "Planned age NN" mono label; the income value at that marker equals the outcome-strip headline exactly, so the two never disagree. **Always real** — this view ignores the Real/Nominal toggle (nominal income at a future age is a misleading number). The whole curve comes from one extended `project()` run; the marker is drawn by a chart-local inline draw hook, not the annotation plugin (the no-external-plugin rule stands).
- **Capital** — stacked bars, gold `#b8893c` discretionary on the bottom, navy `#1f2d3d` retirement fund on top. 280px tall.
- **Breakdown** — stacked bars, grey `#9aa0a9` starting-capital-compounded at the bottom, darker grey `#5e6470` cumulative contributions in the middle, gold growth-on-contributions on top. The three layers sum to the total.
- **Table** — HTML table (not Chart.js) rendered into the same chart-card slot. Sticky year column, one row per year, columns for age A / age B / retirement / disc / total / annual contributions. When a baseline is locked (not relevant in State 2, but left in for re-lock flows), two extra columns (baseline total, delta). `font-family: var(--mono)` on the cells, `font-family: var(--sans)` on the head. **(v2)** The cockpit Table view is a reconciliation flow instead: columns Year · Age A · Age B · Opening · Contributions · Growth · [Capital events, shown only when events exist] · Closing, so the totals follow start to finish (`Opening + Contributions + Growth (+ Events) = Closing`; Closing = next year's Opening). It respects the Real/Nominal toggle — nominal mode shows nominal growth, real mode shows real growth net of inflation. The chart-head Table toggle is how it's reached (the canvas foot no longer carries a "Table view" button).

Y-axis labels are mono 10px in `--mute`. X-axis uses 10px mono for age labels.

### Sliders

Two flavours in the codebase:

- **Thin rail (used everywhere now)** — 2px track in `--line`, 12px circle thumb with a 1.5px `--gold-2` border on `--surface`, subtle 1px rgba shadow. `input[type="range"].thin`. Used by the drawer market-assumption sliders and the State 3 scenario levers.

The old 18px navy thumb / 4px track is gone.

### Capital events list

One event row is a 5-column grid (Session 24): an optional **name** input (left-aligned sans, `Name (optional)` placeholder, max 20 chars), kind dropdown, age input, a flex cell holding `R`-prefix amount input + today's-money checkbox + year label, and a delete button. The year label reads `y+5 · 2031` (offset + calendar year). Head row uses 10px uppercase mute labels. Default new event: inflow of R500k at reference-age + 10, in today's money, no name.

**Where it renders (Session 24).** The editor row renders in two full-width surfaces: the State-1 `.empty-events-panel` inline editor, and the **capital-events modal** (`#events-modal`). The modal clones the report-modal vocabulary (`.report-modal-backdrop` / `data-open`, dismissed by backdrop click or the Done button) but is wider — `width: min(820px, 100%)` — so every field has room. It is the only event editor reachable from States 2/3.

The **Edit-info drawer** no longer holds an inline editor (its narrow column II made entry cramped). Column IV now shows a compact **read-only summary** (`#drawer-events-summary`, the same `Name (Inflow) · amount` rows the recap card uses) plus a **"Manage capital events"** button that opens the modal. The drawer summary repaints when the modal's Done button is clicked.

**Name in summaries.** On the recap card and the report Page-2 strip, a named event reads `<Name> (Inflow)` / `<Name> (Outflow)` — the name in ink, the parenthesised kind keeping its green/red inflow/outflow colour. An unnamed event reads the bare `Inflow` / `Outflow` with no parens, identical to pre-Session-24 output.

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

Between the foot band and the CTA sits `.empty-events-panel` — a full-width block for capital events that mirrors the drawer's entry surface. Eyebrow `Capital events` in the same 10px uppercase `.empty-foot-eyebrow` style as the foot-band sections; an `events-ref-spouse` helper note ("Ages anchored to {name}'s age"); a container `#empty-events-list` that shares the `.event-row` 4-column grid and styles with the drawer's `#events-list`; and an `#empty-add-event-btn` styled as the dashed `.add-btn`. One `renderEvents()` call paints both containers from the same `eventsStore` — the drawer and State 1 stay in sync via a `renderEvents()` call in the CTA handler before the state transition.

At the bottom, a centred, vertically-stacked `.empty-cta` container holds the `#btn-see-projection` primary button (navy fill, paper text, 12×28 padding) with an `Open a saved plan` ghost button (`#btn-open-plan-empty`) beneath it, so a fresh session can restore a saved `.json` plan before any data is entered. Clicking it sets `projectionRequested = true`, calls `renderEvents()` to freshen the drawer, and calls `refresh()`, which re-runs `deriveViewState()` and flips the canvas to State 2. The button is **disabled until both spouse ages parse as finite integers** (Session 11) — in the disabled state it renders at 40% opacity with a `not-allowed` cursor, enforced by `.empty-cta .btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }`. Retirement age, balances, and contributions can stay blank when the adviser fires the projection; the calculator reads blank money fields as 0 and blank retirement age as the internal fallback 65 (invisible, no pre-filled default in the input). Hidden in print via `.empty-cta` in the `@media print` hide list. A third ghost button, `Load sample data (test)` (`#btn-load-sample`), sits at the bottom of the stack: a dev convenience that fills a representative household and jumps to State 2 in one click. It is scaffolding, not a client-facing control, and should be removed or gated before a meeting-facing release.

Input fields in the empty state are shadow inputs — they carry `data-sync-to="hp-ret-A"` etc. attributes and write their values into the canonical drawer inputs on blur (or on `input` for range sliders), triggering the normal refresh pipeline. Spouse-name inputs use `data-sync-spouse-name="A"` to write into `spouseNames`. These syncs do NOT transition State 1 → State 2 — only the CTA click does.

**Default market assumptions.** All three canonical inputs default to 5% (return, CPI, escalation). The State 1 slider thumbs and readouts mirror that. A first-meeting projection with defaults therefore shows a 0% real return before escalation — a deliberate conservative framing, so every assumption the adviser dials in thereafter tends to make the number look better, not worse.

**No defaults on client inputs (Session 11).** Spouse ages, retirement age, the four balance pills per spouse, and the four monthly contribution pills ship blank with a `—` placeholder. The adviser has to type real client numbers in every meeting — no pre-filled 40 / 65 / R1.5M / R8k to overwrite, no risk of a synthetic value bleeding into the projection. The HTML `min`/`max`/`step` constraints on the three age inputs (18-64 for spouse ages, 50-75 for retirement age) and the 18-95 window on capital-event ages are all gone — any integer is accepted. Horizon math (`years = max(1, retirement_age − reference_age)`) still runs so a retirement age below the oldest spouse just produces a 1-year projection. Market assumptions remain the only defaults because they're domain assumptions rather than client facts.

**Default income goal: blank.** Unlike the market assumptions, the goal has no default value. The adviser enters it during every meeting as part of the target conversation, and every downstream progress surface stays hidden until they do. If the adviser never touches the goal field, the calculator renders exactly as it does without the feature.

## Print

```css
@media print { ... }
```

Two-zone PDF.

- **Page 1** is the client-facing view: plan-bar (collapsed, drawer hidden), canvas head (headline or compact compare head), the chart card (State 2) or the compare grid (State 3), outcome strip (State 2) or centred compare legend (State 3), narrative (State 2 only). Scenario levers and canvas-foot actions are hidden. **(v2)** Page 1 also carries the "Current plan" recap card (it prints on page 1), and the canvas foot has no action buttons to hide — it's text only.
- **Pages 2+** are the compliance appendix: the three `<details class="accordion">` blocks (detail tables, methodology, disclaimer) forced open and flattened. `page-break-before: always` on `.print-summary` starts it on a fresh page. On screen (Session 16) these three sit inside one outer `<details class="accordion" id="appendix-toggle">` ("Methodology & disclaimer") so the working view shows a single closed line; the print path forces *all* `details.accordion` open (outer included) and `.accordion > summary { display:none }` flattens every level, so the printed appendix is unchanged. **(v2)** The appendix is now a single `Methodology & disclaimer` toggle expanding to methodology + disclaimer only — the "Detail tables" sub-accordion was removed (its content lives in the on-screen recap card and the Report deck). The portrait Cmd+P output is correspondingly thinner: inputs via the recap card, outputs via the outcome strip + chart, plus methodology and disclaimer.

Hidden in print via `.no-print` / explicit rules: the `Edit plan ↓` button, the `.canvas-actions` cluster (Real/Nominal, Lock, Clear, Re-lock), the `.canvas-foot-actions` (Table view, Print/PDF), the scenario levers panel. **(v2)** The canvas-foot action buttons no longer exist (Table view moved to the chart-head toggle; exporting is the top-bar gold "Report" button), so there's nothing to hide there beyond the foot text, which prints.

Headlines and chart heights are tuned down for print (28px headline, 260px chart wrap, 220px compare-chart wrap). Two handlers keep Chart.js sized correctly:

- `beforeprint` + `afterprint` — for interactive Cmd+P.
- `window.matchMedia('print').addEventListener('change', …)` — for headless `--print-to-pdf`, which does not fire `beforeprint`.

Both call `resizeChartsToWrap()`, which iterates every chart container (main + both compare canvases) and calls `chart.resize(w, h)` with explicit dimensions inside `requestAnimationFrame`. Explicit dims — rather than letting Chart.js re-read the parent — is what fixes the Session 2/3 regression where headless prints rendered the bitmap at screen-size dimensions and painted it into a fraction of the print wrap.

Every calculator must be reviewed in print preview before shipping. Print-only regressions are subtle and common.

## Report deck (A4 landscape, 3–4 pages) — Session 19

A separate, opt-in print mode producing a client-facing deliverable. Triggered by the plan-bar **Report** button; coexists with the portrait print path without touching it. Session 19 replaced the previous 12-page editorial deck with this compact deck modelled on `new_report.html`, in the cockpit brand-blue (`#323E5D`) palette. The signature change is that the income chart is now **inline SVG** (resolution-independent — crisp at any PDF zoom) rather than a print-time Chart.js canvas.

**Two print paths, two purposes.**

- *Working copy* — canvas-foot "Print / PDF" or plain Cmd+P. Portrait. Client view on page 1, compliance appendix on pages 2+. Internal use, back-office.
- *Client deliverable* — plan-bar "Report". Landscape. 3–4 page deck, meant to be emailed or printed to hand over.

They never collide: export mode gates are set only by `runReportExport()` and cleared on `afterprint`. Working-copy flows never touch them, so the existing portrait `@media print` rules remain authoritative there.

**The deck.** 4 pages, one conditional (the scenario page, shown only when a baseline is locked and the adviser opts in via the modal):

1. **Cover** (dark navy) — kicker + bold sans `Retirement Income Projection for [names].` (spouse first names, or "the [Family] household" fallback). Two stat cells: date prepared + "R X /mo · age N" projected income. No goal progress on the cover.
2. **Projection** — top navy income-chart panel (SVG: white income line over age, dashed gold income-goal line, a vertical marker + gold dot at the selected retirement age, a white callout, faint white gridlines). Middle: a 4-box assumptions grid (Income goal / Safe withdrawal rate / Expected return / Assumed inflation) on the left and a two-spouse household card (age, retirement & discretionary balances, retirement & discretionary contributions) on the right. **Session 23** adds an optional full-width **Capital events** strip at the bottom (above the footer): a left "Capital events / Applied to discretionary capital" label and up to three inline chips (`Age · Inflow/Outflow · amount · basis`, gold `✦` separators, green inflow / red outflow), with "N additional event(s) modelled." when there are more. The strip is hidden entirely when there are no events (and the chart keeps its full 108mm height); when present, a `has-events` class shrinks the chart to ~92mm to make room. Events shown follow the locked baseline when one exists, per the Page-2 rule.
3. **Scenario** (conditional) — two hero tiles (Current projection = baseline, Plan scenario = live projection, with a green income delta) over a "What changed" lever table and three notes (result / changed inputs / unchanged assumptions). Changed deltas are green/red; unchanged levers read **"unchanged"** in muted text. No attribution is inferred.
4. **Methodology / Compliance** (dark navy, full-width) — two stacked text blocks (Methodology with live assumptions interpolated, Compliance note), separated by a faint hairline. No side-by-side white boxes.

Every page carries the repeating foot brand line ("Simple Wealth Pty Ltd is a financial services provider. FSP number 50637.") and an `NN / TT` page count.

**Visual tokens.** The deck is self-contained: report-local custom properties (`--r-brand`, `--r-gold`, `--r-ink`, `--r-muted`, `--r-line`, `--r-surface`, `--r-green`, `--r-red`, …) are declared on `.report-deck` so the report renders exactly to its reference and is immune to screen-token changes. The values mirror the cockpit palette (`--r-brand: #323E5D` = `--navy`, `--r-gold: #b98936` = `--gold`).

**Page geometry.** `.report-page { width: 297mm; height: 210mm; }` with a CSS-grid `auto 1fr auto` (header / body / foot). On screen the pages stack with an 18px gap and a soft box-shadow for scroll-preview. In print (`html.export-printing`), the shadow/gap are stripped and each page fills its sheet.

**Conditional page + include-scenario modal.** The scenario page carries `data-enabled="false"`; `runReportExport(includeScenario)` flips it to `"true"` only when a baseline exists and the adviser chose to include it. Clicking **Report** with a locked baseline opens a small styled modal (`#report-scenario-modal`: Cancel / Export without scenario / Include scenario) matching the report palette; with no baseline the report goes straight to 3 pages. `renumberReportPages()` keeps the `NN / TT` counts coherent for 3- or 4-page output.

**Em-dash rule — enforced in static copy.** The methodology/compliance prose and chart intro are hand-written em-dash-free; `data-bind` slots hold `—` placeholders but are overwritten at export by `setBind`/`setBindText` from em-dash-free sources. A JS test scans the whole `.report-deck` markup for em-dashes after stripping `data-bind` nodes.

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
