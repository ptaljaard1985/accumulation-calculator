# Migrating the accumulation tool into the CRM repo

Goal: make the CRM repo the single canonical home for the retirement accumulation
tool, kill the duplicate copy, and put a producer↔consumer contract test around
`sw-review-data` so the export and the tool can never silently drift.

The tool is a **build-free single HTML file** that opens via `file://`, is emailed
to clients, and prints to PDF. Nothing in this migration is allowed to change that.
Next.js already ignores everything outside `app/`, `public/`, and imported files,
so a subtree under `tools/` is invisible to the build — verified by the fact that a
copy already sits untouched at `docs/Meeting Report/`.

---

## Decisions to make first

1. **Target path.** Recommended: a new top-level `tools/accumulation-report/`
   (reads as a tool, not docs; leaves room for a future `tools/drawdown/`). The
   already-present `docs/Meeting Report/` also works but is semantically "docs".
   This guide assumes `tools/accumulation-report/`.
2. **Standalone repo (`calc-accumulation`).** After the move, archive it
   (read-only) — the tool is distributed as a file, not via the repo, so it isn't
   needed. Keep it only if someone works on the tool who must not see CRM internals.
3. **Rename `Meeting Report/`?** Keeping the internal folder name verbatim means
   **zero path edits** (the tests use paths relative to their own location). A
   space in a repo folder name is ugly; an optional rename step is included at the
   end with the exact 3 edits.

---

## What moves, what stays

From the `calc-accumulation` repo, **move** (this is the tool + its support):

```
Meeting Report/retirement_accumulation_v2.html   # the tool (canonical)
Meeting Report/assets/*.png                        # logos (relative refs, keep beside the html)
Meeting Report/*.json                              # sw-review-data fixtures
Meeting Report/*.md                                # contract + integration docs
tests/                                             # pytest (60) + node run.js (93)
docs/                                              # ARCHITECTURE / CALCULATIONS / DESIGN
CLAUDE.md  README.md  tests/README.md              # constraints travel with the tool
```

**Leave / archive** (legacy prototypes, not needed):
`retirement_accumulation.html` (the original warm-paper file — secondary, untested),
`design/`, `export/`, `202606 redesign/`, `new_report.html`.

Preserve the **internal layout** (`Meeting Report/` and `tests/` as siblings under
the new root). The test files resolve their inputs with paths relative to
themselves, so an intact subtree keeps them working with no edits:

- `tests/js/run.js` → `path.join(__dirname, '..', '..', 'Meeting Report', 'retirement_accumulation_v2.html')`
- `tests/python/test_review_aggregation.py` → `Path(__file__).resolve().parents[2] / "Meeting Report" / "<fixture>.json"`

---

## Step 1 — Create the branch and the subtree

In the **CRM repo**:

```bash
git checkout main && git pull
git checkout -b move/accumulation-tool
mkdir -p tools/accumulation-report
```

Bring the files across. Two options:

**(a) Plain copy (simplest; history stays in the archived standalone repo).**
Copy the "what moves" list above into `tools/accumulation-report/`, preserving the
internal structure, then `git add tools/accumulation-report`.

**(b) History-preserving.** In the standalone repo first prune the cruft in a
commit, then in the CRM repo:
```bash
git remote add accum <path-or-url-to-calc-accumulation>
git fetch accum
git read-tree --prefix=tools/accumulation-report/ -u accum/main
# then delete the cruft dirs from tools/accumulation-report/ and commit
```

Sanity check the paths resolve (from `tools/accumulation-report/`):
```bash
( cd tests/js && node run.js )        # expect: 93 passed, 0 failed
( cd tests/python && python -m pytest -q )   # expect: 60 passed
```

---

## Step 2 — Kill the duplicate

The CRM already has a stale copy and possibly stale fixtures under
`docs/Meeting Report/`. Remove the now-superseded **tool** copy:

```bash
git rm "docs/Meeting Report/retirement_accumulation_v2.html"
```

Leave the CRM-maintained **contract** files where they are **iff** they're the
current source of truth (`report-data-contract.md`, the TS types in
`lib/reports/pre-meeting-report-data.ts`, `sample-report-data.json`). If any of
those also came in under `tools/accumulation-report/Meeting Report/`, keep one copy
— the CRM's — and delete the tool-side duplicate to avoid re-introducing drift.

---

## Step 3 — The shared fixture (already done)

The pinned fixture is `fixtures/sample-household-review-data.json` — an anonymised
schema-1.5.0 export (see "Maintaining the fixture" at the end). The tool's tests are
already locked to it (93 JS + 60 Python green). The test files locate it *by name*
via a small resolver, so it works wherever it sits under the tool subtree (here:
`fixtures/`). Just make sure this file travels with the move and the old
`dean-…-2026-07-02.json` is deleted.

---

## Step 4 — Add the tool's CI job

The CRM pipeline is Node-20-only (Vitest). The tool's `node run.js` runs as-is; the
`pytest` suite needs a Python step. Add a **separate, path-scoped** workflow so it
only runs when the tool (or its fixture) changes.

Create `.github/workflows/accumulation-tool.yml`:

```yaml
name: accumulation-tool

on:
  push:
    branches: [main]
    paths: ['tools/accumulation-report/**']
  pull_request:
    paths: ['tools/accumulation-report/**']

jobs:
  tool-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: JS tests (against the shipped HTML)
        working-directory: tools/accumulation-report/tests/js
        run: node run.js

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Python math audits
        working-directory: tools/accumulation-report/tests/python
        run: |
          pip install pytest
          python -m pytest -q
```

(No `package.json` or `requirements.txt` needed — the JS tests use only Node
built-ins, the Python tests only `pytest`.)

---

## Step 5 — Add the producer↔consumer contract test

This is the payoff: one test, in the CRM's existing Vitest pipeline, that fails the
moment the export drops or renames a field the tool depends on. It rides `npm test`
(no new CI job) because it matches the `*.test.ts` glob.

Place it wherever the CRM keeps tests (e.g. `lib/reports/sw-review-data.contract.test.ts`).
Adjust the two import paths to the CRM's aliases.

```ts
import { describe, it, expect } from 'vitest';
// The ONE shared fixture the accumulation tool also tests against:
import fixture from '../../tools/accumulation/fixtures/sample-household-review-data.json  // adjust to your path';
// The producer's own type — compile-time guarantee the fixture matches the export shape:
import type { ReviewDataFile } from './pre-meeting-report-data';

// Compile-time: if the export type and the fixture diverge, tsc fails here.
const _typed: ReviewDataFile = fixture as ReviewDataFile;

// Runtime: every field the accumulation tool reads from sw-review-data. If the
// CRM export ever drops/renames one of these, this test fails BEFORE it ships and
// breaks the tool. Keep in sync with the tool's importer (tool CLAUDE.md, and the
// reviewData.* reads in retirement_accumulation_v2.html).
describe('sw-review-data contract (CRM export -> accumulation tool)', () => {
  it('envelope the tool dispatches on', () => {
    expect(fixture.kind).toBe('sw-review-data');
    expect(typeof fixture.schemaVersion).toBe('string');
  });

  it('clientFamily.members carry the fields the naming + slot logic read', () => {
    expect(Array.isArray(fixture.clientFamily.members)).toBe(true);
    for (const m of fixture.clientFamily.members as any[]) {
      expect(typeof m.personId).toBe('string');
      expect(typeof m.role).toBe('string');          // primary | spouse | child | dependant | other
      expect(typeof m.firstName).toBe('string');
      if (m.preferredName != null) expect(typeof m.preferredName).toBe('string'); // optional
    }
  });

  it('accounts carry the fields mapping + aggregation read', () => {
    expect(Array.isArray(fixture.accounts)).toBe(true);
    for (const a of fixture.accounts as any[]) {
      expect(typeof a.accountId).toBe('string');
      expect('ownerPersonId' in a).toBe(true);        // string | null (joint)
      expect(typeof a.type).toBe('string');            // Retirement | Tax-Free | Discretionary
      expect(typeof a.accountName).toBe('string');     // "...Preservation..." vs "...Annuity..." sub-order
      expect(a.value === null || typeof a.value === 'number').toBe(true);
      expect(a.monthlyContribution === null || typeof a.monthlyContribution === 'number').toBe(true);
      expect(['retirementAssets', 'discretionaryAssets', 'excluded', null])
        .toContain(a.suggestedBucket ?? null);
    }
  });

  it('has the sections the report pages render', () => {
    expect(fixture.risk).toBeTruthy();               // policyBenefitRows, comments
    expect(fixture.estate).toBeTruthy();             // willRows, powersOfAttorney, trusts, comments, estateLiquidityComment
    expect(fixture.assumptionSeeds).toBeTruthy();    // expectedReturn, expectedInflation, incomeGoalMonthly, lifeExpectancy
  });

  it('projection.comments (if present) fits the report box budget', () => {
    const c = (fixture as any).projection?.comments;
    if (c != null) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeLessThanOrEqual(300);      // the planner-comments box is sized for ~300 chars
    }
  });
});
```

If you want the reverse guard too (the CRM produces exactly this shape), add an
assertion that `assembleReviewData(...)` output for a fixed input deep-equals a
checked-in golden — but the fixture-based contract above already catches the
drift class that has actually bitten us.

---

## Step 6 — Keep the tool isolated

- **ESLint:** add the subtree to `globalIgnores` in `eslint.config.mjs` so lint
  never touches the HTML/JS-in-HTML:
  ```js
  globalIgnores(['tools/accumulation-report/**'])
  ```
- **No imports from CRM code** into the tool (it's a build-free HTML file, so it
  can't anyway — just don't add a build step to it).
- **Not `public/`.** The middleware (`proxy.ts`) doesn't exclude `.html`, so a
  `public/*.html` would be gated behind login and become a URL. Keep the tool a
  pure repo file under `tools/`.
- Next / Vitest / tsc already ignore the subtree with zero config.

---

## Step 7 — Update the tool's CLAUDE.md

In `tools/accumulation-report/CLAUDE.md`, record the new home and the fact that the
tool now lives in the CRM repo but stays build-excluded and standalone; bump the
`sw-review-data` schema references to `1.5.0`; note the contract test location and
that a schema change is now one atomic PR (export + tool + fixture + contract test).

---

## Step 8 — Verify and open the PR

From the CRM repo root:

```bash
( cd tools/accumulation-report/tests/js && node run.js )         # 93 passed
( cd tools/accumulation-report/tests/python && python -m pytest -q )  # 60 passed
npm test                                                         # CRM Vitest incl. the new contract test
npm run build                                                    # confirm Next ignores the subtree (build unchanged)
```

Also open `tools/accumulation-report/Meeting Report/retirement_accumulation_v2.html`
via `file://` and print-preview once — the tool must still open and print with no
server. Commit and open the PR. After merge, archive the standalone repo.

---

## Optional cleanup — rename `Meeting Report/`

If you want to drop the space-in-folder name, rename it (e.g. to `report/`) and make
exactly these edits:

- `git mv "tools/accumulation-report/Meeting Report" tools/accumulation-report/report`
- `tests/js/run.js` — the two `'Meeting Report'` path segments → `'report'`
- `tests/python/test_review_aggregation.py` — the `"Meeting Report"` path segment → `"report"`
- the contract-test import path in Step 5 → `.../report/dean-...json`
- (cosmetic) prose references in the `.md` docs

Then re-run the two suites to confirm the paths resolve.

---

## Field reference (what the tool consumes)

Kept here so the contract test's field list stays honest.

- **Envelope:** `kind` (must equal `"sw-review-data"`), `schemaVersion` (read but
  not gated — any version is accepted).
- **`clientFamily`:** `displayName`, `members[]` → `personId`, `role`,
  `firstName`, `preferredName` (optional, falls back to `firstName`), `age`,
  `ownerName`, `lastName`.
- **`accounts[]`:** `accountId`, `ownerPersonId` (string | null), `ownerName`,
  `provider`, `type`, `accountName`, `value`, `monthlyContribution`,
  `growthAssetsPercent`, `offshoreAssetsPercent`, `suggestedBucket`.
- **`netWorthItems[]`**, **`risk`** (`policyBenefitRows`, `comments`),
  **`estate`** (`willRows`, `powersOfAttorney`, `trusts`, `estateLiquidityComment`,
  `comments`), **`assumptionSeeds`** (`expectedReturn`, `expectedInflation`,
  `incomeGoalMonthly`, `lifeExpectancy`).
- **`projection.comments`** — new; optional; ≤ 300 chars.

---

## Maintaining the fixture + contract going forward

**Principle: the fixture is *pinned, anonymised* test data — never a live client export.**
It changes only when the export *format* changes, never because a real client's
numbers moved. That's what keeps the golden-number tests stable.

| What changed | What you do |
|---|---|
| **Export format** (new/renamed field, `schemaVersion` bump) | CRM updates the TS types + `assembleReviewData` + version. Regenerate the pinned fixture at the new shape (see below). The contract test's `const _typed: ReviewDataFile = fixture` line **fails to compile** until you do — that's the tripwire. Add the new field to the contract checklist. If the *tool* needs to read it, wire the consumer + a tool test. One PR, both sides. |
| **Tool only** (a calc/layout change, same format) | Update the tool + its tests (golden numbers only if the *math* changed). Fixture + contract test untouched. |
| **A real client's data** (day-to-day) | Nothing — the pinned fixture is independent. |

**Regenerating the fixture (two options):**

1. **Best — a fixed "Test Household" in the CRM.** Create one fake client with
   stable data. Re-export *it* whenever the format changes → drop it in as the
   fixture. No real data, no anonymisation, and the golden numbers only move when
   you deliberately change that record.
2. **Anonymise a real export.** Run the fresh export through the `anonymize.mjs`
   script (kept alongside the fixture): it fakes the names, generic-ises
   descriptions, rounds values, scrubs third-party names (guardians, executors,
   trustees), and injects a synthetic POA + trust so every report section is
   exercised. Then recompute the golden numbers (`goldens.mjs`) and paste them
   into the two test files.

Either way, the fixture's filename stays `sample-household-review-data.json`
(the tests locate it by that name), and it must remain ≤ the tool's expectations
(e.g. `projection.comments` ≤ 300 chars — the contract test enforces this).

**The current fixture** was produced from the 2026-07-07 export (schema 1.5.0) via
option 2: names → "Alex / Robin Sample" + kids, business/property/debt descriptions
generic-ised, values rounded to the nearest R1 000, third-party names removed, and
a synthetic POA + trust + varied will statuses added so the estate page is fully
covered. Golden numbers are locked to it (93 JS + 60 Python green).
