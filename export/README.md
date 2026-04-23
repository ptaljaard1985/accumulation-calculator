# Handoff — Retirement Projection Report

## Overview

This bundle contains a **client-ready retirement projection report** designed
to complement the existing Simple Wealth *Retirement Accumulation* calculator.
The report turns the calculator's live state into a 10–12 page printable PDF
that an adviser can hand to a client.

The work you're being asked to do is **two-fold**:

1. **Wire an "Export report" button** into the existing calculator codebase
   that serialises the current state and opens the report.
2. **Recreate the HTML report in the target codebase's stack** (if the team
   wants it integrated), or ship the HTML as-is (if a static deliverable is
   acceptable — it is self-contained).

Please decide which of those two paths is the right fit after reading the
existing codebase. The HTML report works standalone; integration is optional.

---

## About the design files

The files in this bundle are **design references created in HTML** — working
prototypes that show the final look, content, and behaviour of the report.
They are **not production code to copy directly**. If your codebase has an
established stack (React + charting lib + design system), recreate the
designs using those patterns. If it doesn't, the HTML can be shipped as-is
because it is entirely self-contained (CDN fonts, Chart.js from CDN, a
small deck-shell web component).

---

## Fidelity

**High fidelity.** Final colours, typography, spacing, and interactions.
Recreate pixel-close. No ambiguity on visual direction.

---

## The two deliverables

### 1. Export button in the calculator

Small — probably less than an hour — if the calculator's state tree is clean.

**Where:** Top-right of the calculator's header bar, near any existing
Compare / Reset controls. Match the existing button styles — the report's
visual system is already aligned to the calculator.

**Behaviour:**
- Label: **"Export report"**.
- On click: serialise the current state to a JSON snapshot (schema below),
  write to `localStorage` under the key `sw-calc-snapshot`, open
  `Retirement Report.html` in a new tab.
- Disabled when inputs are incomplete.

### 2. The report itself

Three options, in order of effort:

| Option | What it looks like | When to choose |
|---|---|---|
| **Ship the HTML as-is** | Deploy the files in this bundle to a static path. The calculator opens it in a new tab. | Simplest. Do this unless there's a reason not to. |
| **Port to your stack** | Rebuild the report as React/Vue components using the calculator's existing chart library and design tokens. | Choose if you already have a strong component library and want the report to share components with the calculator. |
| **Server-rendered PDF** | Run the HTML through headless Chromium (e.g. Puppeteer) server-side and stream back a PDF. | If the team wants advisers to get a PDF download directly, no browser detour. |

Whichever path you choose, the **snapshot contract** (next section) stays
the same.

---

## The snapshot JSON contract

The report reads its state from `localStorage['sw-calc-snapshot']`, or a
`?data=<base64-JSON>` URL parameter as a deep-link alternative. Shape:

```jsonc
{
  "meta": {
    "familyName":   "Nkosi",                  // used in "the Nkosi family" labels
    "clientName":   "Thabo & Amara Nkosi",    // full client line on cover
    "spouseNameA":  "Thabo",
    "spouseNameB":  "Amara",
    "preparedDate": "23 April 2026",          // human-readable date
    "adviser":      "Simple Wealth (Pty) Ltd" // usually fixed
  },
  "inputs": {
    "ageA":           40,      // current age, spouse A
    "ageB":           40,      // current age, spouse B
    "retA":       1500000,     // retirement-fund balance, A  (rands)
    "retB":       1200000,
    "discA":       500000,     // discretionary balance, A
    "discB":       300000,
    "contribRetA":   8000,     // monthly contrib to retirement fund, A
    "contribRetB":   7000,
    "contribDiscA":  3000,     // monthly contrib to discretionary, A
    "contribDiscB":  2000,
    "rNom":          0.09,     // expected nominal return, annual (decimal)
    "cpi":           0.05,     // expected inflation, annual (decimal)
    "esc":           0.05,     // annual contribution escalation (decimal)
    "anchor":        "youngest", // or "oldest" — which spouse hits retirementAge
    "retirementAge": 65,

    "events": [                // one-off capital events, 0..N
      {
        "age":         50,     // spouse-A's age when the event occurs
        "kind":        "inflow",   // or "outflow"
        "amount":      800000,     // rands, positive number
        "description": "Inheritance",
        "note":        "Optional short explainer shown in the report"
      }
    ]
  },

  "baseline": null             // or { "inputs": { ...full inputs block... } }
}
```

### Field notes

- **All rands are ZAR, positive.** Sign on events is inferred from `kind`.
- **`anchor`** decides whether the horizon is measured from the younger or
  older spouse reaching `retirementAge`.
- **`events`** is an array. `age` is spouse-A's age when the event happens.
  If your calculator tracks events on a different anchor, normalise before
  writing the snapshot.
- **`baseline`** is `null` if no baseline is locked. Otherwise
  `{ "inputs": { ...same shape as inputs... } }`. The report's Compare
  slide auto-shows/hides based on this.

### Export pseudocode

```js
function onExportClick() {
  const snapshot = {
    meta: {
      familyName:   state.household.familyName,
      clientName:   state.household.clientName,
      spouseNameA:  state.spouseA.name,
      spouseNameB:  state.spouseB.name,
      preparedDate: formatDate(new Date(), 'D MMMM YYYY'),
      adviser:      'Simple Wealth (Pty) Ltd',
    },
    inputs: {
      ageA:  state.spouseA.age,
      ageB:  state.spouseB.age,
      retA:  state.spouseA.retirementBalance,
      retB:  state.spouseB.retirementBalance,
      discA: state.spouseA.discretionaryBalance,
      discB: state.spouseB.discretionaryBalance,
      contribRetA:  state.spouseA.monthlyRetirementContrib,
      contribRetB:  state.spouseB.monthlyRetirementContrib,
      contribDiscA: state.spouseA.monthlyDiscretionaryContrib,
      contribDiscB: state.spouseB.monthlyDiscretionaryContrib,
      rNom:  state.assumptions.nominalReturn,
      cpi:   state.assumptions.inflation,
      esc:   state.assumptions.contributionEscalation,
      anchor:        state.assumptions.anchor,
      retirementAge: state.assumptions.retirementAge,
      events: state.events.map(e => ({
        age:         e.ageSpouseA,
        kind:        e.kind,
        amount:      Math.abs(e.amount),
        description: e.description,
        note:        e.note || '',
      })),
    },
    baseline: state.baseline ? {
      inputs: serialiseInputs(state.baseline.inputs)
    } : null,
  };

  localStorage.setItem('sw-calc-snapshot', JSON.stringify(snapshot));
  window.open('Retirement Report.html', '_blank');
}
```

**Field-name mapping:** the pseudocode assumes a state-tree shape that
will almost certainly differ from ours. Rename the right-hand sides to
match your actual store; the left-hand sides (snapshot keys) are fixed.

---

## Projection math — one source of truth

The report re-runs the projection from inputs, rather than receiving
pre-computed values. This means the calculator only serialises inputs
and the report stays in lockstep automatically.

The math lives in `report-data.js → project(inputs)`. Key invariants:

- Monthly compounding at `(1 + rNom)^(1/12) - 1`
- Contributions escalate **annually** at `esc`
- Horizon = `retirementAge - refAge`, where `refAge` is the younger
  or older spouse's age based on `anchor`
- Real (today's money) deflates nominal by `cpi` per year
- Monthly income headline = `finalTotalReal * 0.05 / 12`
- Breakdown = starting-balance-compounded + cumulative-contributions +
  growth-on-contributions (growth computed as residual)

**Capital events are currently shown in the report but NOT folded into
the trajectory math.** The calculator's math should match (descriptive
only). If you change that, update both sides together.

---

## Screens / slides in the report

Twelve slides at **1588 × 1123 px** (A4 landscape ratio). Two are
conditional.

| # | Name | Notes |
|---|---|---|
| 01 | Cover | Family name, prepared date, FSP number |
| 02 | The answer | Hero headline + full-width chart + 3-cell outcome strip |
| 03 | The household | Two spouse cards side-by-side, typographic |
| 04 | Assumptions | Editorial table with anchor note |
| 05 | Projection | Full-width nominal stacked-bar chart |
| 06 | Breakdown | Three-ingredients: starting capital, contributions, growth |
| 07 | Capital events | **Conditional** — only renders when `events.length > 0`. Timeline + itemised list. |
| 08 | Compare | **Conditional** — only renders when `baseline !== null`. Two scenario cards side-by-side. |
| 09 | Year by year | Every 5th year + age-milestones; retirement row highlighted |
| 10 | Methodology | Plain-English two-column explainer |
| 11 | Compliance | FSP number, risk language, scope, tax note |
| 12 | Next steps | Closing page — review cadence, contact |

Slide count and `NN / TT` pagination auto-adjust based on which
conditional slides render. Roman numerals (I. II. III. ...) likewise
renumber dynamically — see the `renumberPages()` IIFE in
`report-data.js`.

---

## Design tokens

All defined at `:root` in `Retirement Report.html`. The calculator
already uses a close palette — reuse your existing CSS variables where
they match.

```css
--paper:     #faf7f0    /* page background */
--paper-2:   #f2ede2
--paper-3:   #ebe4d3
--surface:   #ffffff

--ink:       #1a1f26    /* body text */
--ink-2:     #3a4250
--mute:      #7a8292
--faint:     #b4bac4

--hairline:  #e4e1d8    /* dividers */
--line:      #d4cfc2

--navy:      #1f2d3d    /* primary accent */
--navy-2:    #2d3e50
--navy-soft: #38495b

--gold:      #b8893c    /* secondary accent */
--gold-2:    #9c7226
--gold-soft: #e3c987
--gold-pale: #f5ebd1

--pos:       #2f6b3a    /* positive events */
--neg:       #a64236    /* negative events */
```

### Typography

```css
--serif:  'Fraunces',        Georgia, serif;           /* editorial display */
--sans:   'Inter Tight',     -apple-system, sans-serif; /* UI + body */
--mono:   'JetBrains Mono',  ui-monospace, monospace;   /* numerics */
```

**Fonts are loaded from Google Fonts.** If your stack has a font strategy,
swap the CDN link for your internal loader.

### Typographic scale

| Role | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Editorial H1 (cover, closing) | Fraunces | 72px | 300 | -1px |
| Editorial H2 (slide titles) | Fraunces | 52px | 300 | -0.6px |
| Answer headline | Fraunces | 64px | 300 | -1.2px |
| Slide eyebrow | Inter Tight | 11px | 600 | 2.4px, uppercase |
| Slide-foot pagination | Inter Tight | 10.5px | 500 | 1.6px, uppercase |
| Body prose | Fraunces | 17px | 300 | 0 |
| UI body | Inter Tight | 13–15px | 400 | 0 |
| Numerics | JetBrains Mono | tabular, variable | 400/500 | 0 |

Roman numerals (I. II. III. etc.) are rendered in Fraunces italic at
gold (`--gold-2`) for a sidenote feel.

---

## Interactions & behaviour

The report is **mostly static** — no interactivity beyond:

- **Keyboard nav** (←/→) and **page-count overlay**, courtesy of the
  `<deck-stage>` web component in `deck-stage.js`.
- **Print-to-PDF** (`Cmd/Ctrl-P`) — `@page { size: A4 landscape; margin: 0 }`
  produces one slide per A4 page with zero margin loss.
- **localStorage persistence** of the current slide index (the deck
  remembers position across reload).

No user input, no forms, no AJAX. Data arrives once at load via the
snapshot and is rendered.

---

## Conditional slide rendering

Two slides render only when their data is present:

| Slide | Renders when |
|---|---|
| Capital events | `inputs.events.length > 0` |
| Compare | `baseline !== null` |

The conditional logic lives in `report-data.js` at the top of the IIFE —
slides are `.remove()`d from the DOM before rendering, then page numbers
and Roman numerals are assigned by DOM order.

---

## Files in this bundle

```
design_handoff_retirement_report/
├── README.md                          ← you are here
├── Retirement Report.html             ← the report deck
├── report-data.js                     ← projection math + data binding
├── deck-stage.js                      ← <deck-stage> web component
├── assets/
│   └── sw-logo.png                    ← Simple Wealth logo (used on every slide)
└── reference/
    └── Retirement Accumulation.html   ← the live calculator, for context only
```

**To run locally:** open `Retirement Report.html` via any static HTTP
server. Because `report-data.js` is loaded with a relative path, it
needs to be served, not opened from the filesystem (Chrome blocks
`file://` scripts for most things).

---

## Open items for you to decide

1. **Which integration path?** Ship the HTML as a static asset, port to
   your stack, or render server-side. See the three-options table above.
2. **Where does the Export button fit in the existing calculator UI?**
   Check the live calculator (`reference/Retirement Accumulation.html`)
   for a natural home.
3. **Does the calculator's state tree match the pseudocode field names?**
   Adjust the serialiser mapping accordingly.
4. **Should capital events actually fold into the projection math?**
   Currently descriptive on both sides. If yes, change
   `report-data.js → project()` and the calculator together.
5. **Real FSP number.** Three occurrences of `[FSP# — TBC]` in
   `Retirement Report.html` and one in the closing slide. Swap them
   for the real number.
6. **Adviser name / firm line.** Currently hardcoded as
   "Simple Wealth (Pty) Ltd" — confirm that's right for every report.

---

## Questions?

Anything ambiguous in the snapshot contract or projection math, flag
it — the HTML files in this bundle are the source of truth for the
visuals and for the math.
