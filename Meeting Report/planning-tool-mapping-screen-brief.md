# Planning Tool — "Open CRM data" + Per-Account Mapping Screen

**Audience:** the agent/developer who maintains the standalone Simple Wealth retirement accumulation tool (`retirement_accumulation.html` / `_v2.html`).
**Date:** 2026-07-01
**Companion files (read alongside this brief):**
- `sample-review-data.json` — a **real-shaped** example of the file you will open (in this folder).
- `crm-report-integration-status-2026-07-01.md` §7.1 — the file spec.
- `report-integration-plan.md` — the end-to-end flow (Stages 3–6).

> The in-repo `retirement_accumulation_v2.html` under this folder is only a **reference copy**. Implement against the live tool you maintain; keep it a standalone single file.

---

## 1. What you're building

The CRM now has an **Export report data** button that writes a JSON file (`kind: "sw-review-data"`) — the client family's facts for a pre-meeting review. Your job is to let the tool **open that file** and turn it into a projection.

Add two things to the tool:

1. **Recognise the new file** in the existing "Open a saved plan" flow.
2. **A per-account mapping screen**: the file lists every investment account; the advisor sets each one to **Retirement**, **Discretionary**, or **Ignore**. The tool then aggregates the confirmed mapping into the planning inputs it already uses, runs the projection, and (later) renders the report.

**One-directional rule:** the tool only *reads* the file. Nothing is written back to the CRM. The advisor's mapping lives in the tool session (and the eventual report), never back in the CRM. On the next export the CRM re-emits its default suggestions and the advisor re-confirms.

---

## 2. The file contract

Open `sample-review-data.json` next to this brief — that is the exact shape. Key points:

- `kind` is always `"sw-review-data"`. **The tool's current `applyPlanFile()` rejects any file whose `kind` isn't its own plan kind** — you must add a branch for this new kind (see §3).
- `schemaVersion` is `"1.0.0"`. Treat it tolerantly (additive fields may appear later); only hard-branch on a future major change.
- **Percentages are decimals** (`0.82` = 82%, `growthAssetsPercent` / `offshoreAssetsPercent` / `assumptionSeeds.*`). Multiply by 100 for any percent slider.
- **Currency is plain ZAR numbers** (no `R`, no separators).
- **`value` can be `null`** — a deliberate "R?" (unknown value) on a held-away account. Treat null as 0 for the projection sum, but surface it on the mapping row as "—" so the advisor knows it's unknown.
- Missing data is `null`, never placeholder text.

### `accounts[]` — the rows for the mapping screen

Each entry is one investment account (managed **or** held-away):

| Field | Use in the mapping screen |
|---|---|
| `accountId` | Row key |
| `ownerPersonId` | The member who owns it. `null` = joint / household (see §4.3) |
| `ownerName` | Display owner ("David Bennett" / "Joint / household") |
| `source` | `"managed"` (from the CRM's managed book) or `"held_away"` (external). Display as a small tag |
| `provider` | Display |
| `type` | Display (e.g. "Retirement", "Discretionary", "Retirement (held-away)") |
| `accountName` | Display |
| `value` | The balance to bucket (may be `null`) |
| `monthlyContribution` | The contribution to bucket (0 if none) |
| `growthAssetsPercent` / `offshoreAssetsPercent` | Optional display only (decimals, may be null) |
| `suggestedBucket` | `"retirementAssets"` / `"discretionaryAssets"` / `"excluded"` — the **starting** selection for the row's toggle |

### `netWorthItems[]`, `risk`, `estate`, `assumptionSeeds`

- `netWorthItems[]` — property / business / cash / debt. **Not** investment accounts and **not** part of the projection. Keep them for the report's net-worth view; ignore them on the mapping screen.
- `risk`, `estate` — factual tables + planner comments for the report pages. Retain in memory; don't touch on the mapping screen.
- `assumptionSeeds` — optional pre-fills (decimals): `expectedInflation`, `expectedReturn`, `lifeExpectancy`, `incomeGoalMonthly`. Any may be `null`.

---

## 3. Extend "Open" to recognise the file

In the existing open/restore path (`applyPlanFile(obj)` in the reference copy):

- Today it does roughly: `if (obj.kind !== PLAN_KIND) { alert("not a Simple Wealth plan"); return }`.
- **Add a branch:** if `obj.kind === 'sw-review-data'`, route to the new mapping flow (§4) instead of the plan-restore path. The existing plan-file behaviour is unchanged for its own kind.

Recommended: keep the same "Open a saved plan" button; detect the kind after parsing and dispatch. Reject anything that is neither kind with the existing friendly alert.

---

## 4. The mapping screen

### 4.1 Layout

Render one row per `accounts[]` entry:

```
Owner            Provider · Type            Account            Value      Contrib     Bucket
David Bennett    Allan Gray · Retirement    Retirement annuity  R2 000 000  R15 000    (•) Retirement  ( ) Discretionary  ( ) Ignore
David Bennett    Allan Gray · Discretionary Unit trust            R500 000   R3 000    ( ) Retirement  (•) Discretionary  ( ) Ignore
Sarah Bennett    10X · Retirement (held-away) Preservation fund        —        R0     (•) Retirement  ( ) Discretionary  ( ) Ignore
```

- Each row's toggle **starts on `suggestedBucket`** (`excluded` → "Ignore").
- Show a "held-away" tag where `source === "held_away"`.
- Show `value: null` as "—".
- A **Confirm / Build projection** button applies the mapping and proceeds to the existing projection view.

### 4.2 Aggregation → the tool's existing inputs

Map the two scenario members to the tool's spouse slots, then sum the **confirmed** buckets per (spouse, bucket) into the inputs the tool already drives:

**Member → spouse slot**
- `role: "primary"` → **Spouse A**; `role: "spouse"` → **Spouse B**.
- Set the names from `firstName` (the tool's `spouseNames.A` / `.B`) and the ages into `hp-age-A` / `hp-age-B` from `members[].age`.
- (The tool's youngest/oldest retirement anchor keeps working off the ages.)

**Per account, once bucketed** (skip any row set to **Ignore**):
- Resolve the owner's slot: `ownerPersonId` matches a member → that member's slot (A/B). `ownerPersonId === null` (joint) → see §4.3.
- Add `value` (null → 0) to that slot's bucket balance, and `monthlyContribution` to that slot's bucket contribution.

**Target input fields** (from the reference copy; set via the tool's `setHpFormatted(id, value)`):

| Bucket total | Spouse A field | Spouse B field |
|---|---|---|
| Retirement balance | `hp-ret-A` | `hp-ret-B` |
| Retirement monthly contribution | `hp-ret-contrib-A` | `hp-ret-contrib-B` |
| Discretionary balance | `hp-disc-A` | `hp-disc-B` |
| Discretionary monthly contribution | `hp-disc-contrib-A` | `hp-disc-contrib-B` |

So: `hp-ret-A` = Σ `value` of accounts where (owner = A, confirmed bucket = Retirement); `hp-ret-contrib-A` = Σ their `monthlyContribution`; and likewise for B and for Discretionary. Ignore-bucketed accounts contribute to nothing.

**Assumption seeds** (optional; only if present, else leave the tool's defaults):
- `assumptionSeeds.expectedReturn` (decimal) → the `return` slider as a percent (`× 100`).
- `assumptionSeeds.expectedInflation` → the `cpi` slider (`× 100`).
- `assumptionSeeds.incomeGoalMonthly` → the `income-goal` input.
- `assumptionSeeds.lifeExpectancy` — the accumulation tool has no life-expectancy input; ignore it here (it's for the drawdown tool).
- Leave `esc` (contribution escalation) and `retirement-age` at their current defaults unless you choose to prompt for them.

After setting inputs, call the tool's existing refresh/projection routine.

### 4.3 Joint / household accounts (`ownerPersonId === null`)

A joint account has no single owner. On the mapping row, show owner "Joint / household" and let the advisor pick how to attribute it. **Default: split the value and contribution 50/50 across Spouse A and Spouse B** (matching how the CRM's estate planner treats joint assets). Allow the advisor to override to "all A" or "all B" on the row if they prefer. The chosen split feeds the same per-slot sums in §4.2.

If there is only one scenario member (solo client), everything maps to Spouse A.

---

## 5. Retain for the report

Keep the full opened file in memory after mapping. The eventual report pages read:
- `accounts[]` (with the advisor's confirmed bucket per row) — the accounts page.
- `netWorthItems[]` — the net-worth view.
- `risk` (policy rows + `comments`) — the risk page.
- `estate` (will rows + trust + the two comments) — the estate page.
- `clientFamily`, `firm`, `exportedAt`/`exportedBy` — headers / cover.

The projection page comes from the tool's own calculation (driven by the aggregated inputs above).

---

## 6. Constraints

1. **Stay a standalone single file.** No server dependency, no network calls. The file is opened from disk / Dropbox by the advisor.
2. **Don't break the existing plan Save/Open.** The `sw-review-data` branch is additive; the tool's own plan files must still round-trip.
3. **Schema-version tolerantly.** Accept unknown extra fields; only hard-fail on a future incompatible major version.
4. **Decimals in, percents on sliders.** Convert `× 100` where a slider expects a percent.
5. **Null-safe.** `value: null` → 0 in sums, "—" in the UI.
6. **No write-back.** The mapping is session-only; never attempt to send anything to the CRM.

---

## 7. Acceptance criteria

Open `sample-review-data.json` and verify:

1. The tool recognises `kind: "sw-review-data"` and opens the mapping screen (no "not a Simple Wealth plan" alert).
2. Four account rows render, each pre-set to its `suggestedBucket`; the held-away preservation fund shows "—" for value and a "held-away" tag.
3. With the suggested buckets confirmed and the joint items ignored (they're in `netWorthItems`, not `accounts`):
   - Spouse A (David): `hp-ret-A = 2 000 000`, `hp-ret-contrib-A = 15 000`, `hp-disc-A = 500 000`, `hp-disc-contrib-A = 3 000`.
   - Spouse B (Sarah): `hp-ret-B = 2 000 000` (the R2m RA; the null-value preservation fund adds 0), `hp-ret-contrib-B = 15 000`, `hp-disc-B = 0`, `hp-disc-contrib-B = 0`.
4. Setting David's unit trust to **Ignore** drops `hp-disc-A` to `0` and re-runs the projection.
5. `return` slider ≈ 8%, `cpi` slider ≈ 5%, `income-goal` = 40 000 (from `assumptionSeeds`).
6. The projection renders from those inputs; `risk` / `estate` / `netWorthItems` are retained for the report but don't affect the projection.

---

## 8. Master prompt (for the tool-maintaining agent)

> You maintain the Simple Wealth standalone retirement **accumulation** tool (a single HTML file). Add the ability to open a CRM-exported **`sw-review-data`** file and map its accounts into a projection.
>
> Read `docs/Meeting Report/planning-tool-mapping-screen-brief.md` and the attached `sample-review-data.json` (that JSON is the exact file shape). Implement:
> 1. In the existing "Open a saved plan" flow, recognise `kind: "sw-review-data"` and branch to a new mapping screen (the current code rejects unknown kinds — don't break that for real plan files).
> 2. A per-account mapping screen: one row per `accounts[]` entry, each toggled **Retirement / Discretionary / Ignore**, pre-set to the row's `suggestedBucket`. Show owner, provider·type, account name, value (null → "—"), contribution, and a "held-away" tag for `source: "held_away"`.
> 3. On confirm, aggregate per (spouse, bucket) into the existing inputs `hp-ret-A/B`, `hp-ret-contrib-A/B`, `hp-disc-A/B`, `hp-disc-contrib-A/B`; set `hp-age-A/B` and spouse names from `members[]` (primary→A, spouse→B); pre-fill `return` / `cpi` / `income-goal` from `assumptionSeeds` (decimals → percent for sliders). Joint accounts (`ownerPersonId: null`) default to a 50/50 A/B split, advisor-overridable.
> 4. Retain the full file in memory (accounts, netWorthItems, risk, estate, comments) for the report pages; the projection comes from the tool's own calculation.
>
> Constraints: keep it a standalone single file, no network calls, don't break existing plan Save/Open, treat the schema version tolerantly, and never write anything back to the CRM. Verify against the acceptance criteria in §7 of the brief.
