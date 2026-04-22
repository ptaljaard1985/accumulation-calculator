# Tests

Two separate test suites, both of which must pass before any change ships.

## Python tests — math audits

Location: `tests/python/`. 37 tests.

These implement the accumulation projection from scratch in Python and assert that specific inputs produce specific outputs, checked against closed-form financial formulas where possible (FV of lump sum, ordinary annuity FV, geometric series for escalating contributions, real-rate compounding, CPI deflation).

The point is **cross-implementation validation**. A bug in the JS where a formula is wrong will produce a number that matches no closed-form calculation. The Python tests will catch this. A bug in the JS where the spec was misunderstood will produce numbers consistent with the misunderstood spec — but the Python port will replicate the same bug, so these tests *won't* catch it. That's fine; the JS tests catch the other class of bug.

Structure:

- `conftest.py` — Python port of the calculator's `project()` function, plus `approx()` and `base_inputs()` helpers. Everything non-test-specific lives here.
- `test_core_math.py` — compounding, annuity FV, escalation, CPI deflation, starting-balance compounding, breakdown decomposition, income calculation, linearity, default scenario (17 tests).
- `test_retirement_age.py` — retirement age flexibility, anchor toggle, minimum horizon (9 tests).
- `test_events.py` — capital events: inflow, outflow, currency mode, horizon filtering, cancellation, multi-event composition (11 tests).

Run them with:

```bash
cd tests/python
pip install pytest       # one-time
pytest                   # or `pytest -v` for verbose output
```

Expected output: `37 passed`.

## JS tests — actual shipped code

Location: `tests/js/`. 12 tests.

These exercise the actual JS inside `retirement_accumulation.html` by extracting `project()` via brace-matching and running it under Node. No Jest dependency — just `node run.js` and the built-in `assert` module.

The point is **real-code validation**. Anything the JS actually does is what these tests exercise. Scope issues, closure bugs, typos — these show up here.

Run them with:

```bash
cd tests/js
node run.js
```

Exit code 0 = all pass. Any failure prints a stack trace and exits non-zero.

Expected output: `12 passed, 0 failed`.

## When to add a test

- **Adding a new calculation**: add a Python test that implements the same math in Python and asserts both agree. Add a JS test to confirm the shipped code matches.
- **Fixing a bug**: add a test that fails before the fix and passes after. If it's an algorithmic bug, the JS test catches it. If it's a spec bug, the Python test catches it.
- **Adding a new input or event type**: update `base_inputs()` in `conftest.py` if the new input has a sensible default; add a dedicated test module if the new concept is large enough (e.g. `test_recurring_events.py` if recurring events are ever added).
- **Adding a UI feature**: usually no test needed. UI is verified by eye.

## What the tests *don't* do

- **Rendering.** No headless browser, no visual regression. The UI is simple enough that a developer can spot regressions by opening the file and looking at it.
- **Print preview.** Printed output is checked manually before shipping.
- **Chart.js interactions.** The chart library is trusted.
- **Performance.** The calculator is fast enough that any observable slowdown would be caused by an infinite loop or similar, not a gradual regression.
- **The UI wiring.** Event listeners, slider handlers, DOM updates — these are exercised by hand, not by tests.

## CI

No CI configured in this repo. If you add one, the two commands above (`pytest` in `tests/python` and `node run.js` in `tests/js`) should both exit 0. See the drawdown-calculator repo's `docs/CI.md` for a GitHub Actions template if you want a reference.

## Troubleshooting

**Tests pass locally but the calculator produces a different number in the browser.** This means the extracted JS in `tests/js/run.js` is working on an extracted function, while the browser is running the full page including any DOM side-effects on input parsing. Most likely cause: a difference between what `readInputs()` returns and what the test harness is passing. Re-check the input shape.

**Python and JS tests disagree on a value.** Very rare. Investigate carefully — this means either (a) the Python port in `conftest.py` has drifted from the JS (check recent changes), or (b) there's a genuine implementation bug in one of them. Don't "fix" the test to match the code without understanding which is wrong.

**`ModuleNotFoundError: No module named 'conftest'` when running pytest.** You're not in the `tests/python/` directory. `cd` into it first.
