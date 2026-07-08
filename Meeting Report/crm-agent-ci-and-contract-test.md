# CRM agent prompt — CI job + contract test for the moved accumulation tool

> Paste everything below the line to your CRM agent. It is self-contained and
> assumes no prior context (first prompt since the tool was moved in).

---

**Context — a tool was just moved into this repo; set up its CI + a contract test.**

A standalone client-facing tool — the *retirement accumulation calculator* — has just been moved into this repo at **`tools/accumulation/`**. Read `tools/accumulation/CLAUDE.md` first for its hard constraints. Key facts:

- It is a **build-free single HTML file** (`tools/accumulation/retirement_accumulation_v2.html`) that opens via `file://` and is emailed to clients. **Never** bundle it, import it, transform it, or add a build step. It must stay invisible to Next — keep `tools/accumulation/` out of `app/`/`public/` and don't import from it. If it causes lint noise, add `tools/accumulation/**` to `globalIgnores` in `eslint.config.mjs`.
- It consumes this repo's `sw-review-data` export. Its folder:
  ```
  tools/accumulation/
    retirement_accumulation_v2.html
    assets/                # logos
    CLAUDE.md
    fixtures/
      sample-household-review-data.json   # pinned, anonymised sw-review-data fixture (schema 1.5.0)
      anonymize.mjs  goldens.mjs           # go-forward tooling
    tests/
      js/run.js            # 93 tests, plain `node run.js` (Node built-ins only, no deps)
      python/              # 60 pytest tests (pytest only)
  ```
- The tool's test files locate the fixture/HTML **by name** (a small resolver), so their exact folders are flexible.

This is a **read-mostly** task: create two new files, adjust nothing else in the app. Do not modify the tool or its tests.

**Task 1 — CI job for the tool's own tests.** The existing pipeline is Node-only (Vitest) and doesn't cover the tool. Create `.github/workflows/accumulation-tool.yml`, path-scoped so it only runs when the tool changes. It needs a Python step (the tool has a `pytest` suite):

```yaml
name: accumulation-tool
on:
  push:
    branches: [main]
    paths: ['tools/accumulation/**']
  pull_request:
    paths: ['tools/accumulation/**']
jobs:
  tool-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: JS tests (against the shipped HTML)
        working-directory: tools/accumulation/tests/js
        run: node run.js
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Python math audits
        working-directory: tools/accumulation/tests/python
        run: |
          pip install pytest
          python -m pytest -q
```

Leave the existing CRM workflow untouched.

**Task 2 — producer↔consumer contract test.** This is the point of co-locating: a test in the existing Vitest suite that fails the moment the `sw-review-data` export drops or renames a field the tool reads. Create `lib/reports/sw-review-data.contract.test.ts` (adjust the two import paths to this repo's aliases/relative layout):

```ts
import { describe, it, expect } from 'vitest';
// The ONE shared fixture the accumulation tool also tests against:
import fixture from '../../tools/accumulation/fixtures/sample-household-review-data.json';
// The producer's own type — compile-time guarantee the fixture matches the export shape:
import type { ReviewDataFile } from './pre-meeting-report-data';

// Compile-time drift tripwire: if the export type and the fixture diverge, tsc fails here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeCheck: ReviewDataFile = fixture as ReviewDataFile;

// Runtime: every field the accumulation tool reads. If the CRM export drops/renames
// one of these, this fails BEFORE it ships and breaks the tool.
describe('sw-review-data contract (CRM export -> accumulation tool)', () => {
  it('envelope', () => {
    expect(fixture.kind).toBe('sw-review-data');
    expect(typeof fixture.schemaVersion).toBe('string');
  });
  it('members', () => {
    expect(Array.isArray(fixture.clientFamily.members)).toBe(true);
    for (const m of fixture.clientFamily.members as any[]) {
      expect(typeof m.personId).toBe('string');
      expect(typeof m.role).toBe('string');
      expect(typeof m.firstName).toBe('string');
      if (m.preferredName != null) expect(typeof m.preferredName).toBe('string');
    }
  });
  it('accounts', () => {
    expect(Array.isArray(fixture.accounts)).toBe(true);
    for (const a of fixture.accounts as any[]) {
      expect(typeof a.accountId).toBe('string');
      expect('ownerPersonId' in a).toBe(true);              // string | null (joint)
      expect(typeof a.type).toBe('string');
      expect(typeof a.accountName).toBe('string');
      expect(a.value === null || typeof a.value === 'number').toBe(true);
      expect(a.monthlyContribution === null || typeof a.monthlyContribution === 'number').toBe(true);
      expect(['retirementAssets', 'discretionaryAssets', 'excluded', null]).toContain(a.suggestedBucket ?? null);
    }
  });
  it('sections the report renders', () => {
    expect(fixture.risk).toBeTruthy();
    expect(fixture.estate).toBeTruthy();
    expect(fixture.assumptionSeeds).toBeTruthy();
  });
  it('projection.comments fits the report box (<= 300 chars)', () => {
    const c = (fixture as any).projection?.comments;
    if (c != null) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeLessThanOrEqual(300);
    }
  });
});
```

If importing the JSON errors because `tools/` is outside `tsconfig` `include`/`rootDir`, either add that fixture path to `tsconfig`'s `include`, or load it at runtime with `fs.readFileSync` + `JSON.parse` (you lose only the compile-time `_typeCheck`; the runtime assertions still catch drift). `resolveJsonModule` is likely already on in the Next tsconfig.

**Verify:** run `npm test` (the contract test passes), and confirm `npm run build` is unaffected (the tool subtree stays ignored). Report what you created and any path/tsconfig adjustments you made.
