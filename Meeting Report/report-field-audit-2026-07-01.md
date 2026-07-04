# Pre-Meeting Report — CRM Field Audit

> **➡️ Current-state reference:** the CRM additions below have since **all shipped**. For the complete, up-to-date field mapping (every report field → CRM `table.column`, with derivation rules and remaining work), see [`crm-report-integration-status-2026-07-01.md`](crm-report-integration-status-2026-07-01.md). This audit is retained as the record of *what was decided and added*.

**Date:** 2026-07-01
**Purpose:** Field-by-field check of the pre-meeting report data contract (`report-data-contract.md`) against the live database schema (`db/schema.sql` / `lib/types/database.ts`), so we have one agreed list of CRM additions before building.

This audit assumes the agreed architecture:

- **One-directional flow.** The CRM sends data *out* to the standalone planning tool; nothing writes back. The generated PDF (saved to the client's Dropbox folder) is the record.
- **The planning tool** hydrates from CRM data, lets the advisor adjust assumptions/scenarios, and generates the pre-meeting report itself.
- **Comments are maintained in the CRM** (not typed fresh in the tool each time) and surfaced as boxes on the Risk/Estate tab(s), then pulled into the report.

---

## 1. Already covered — flows automatically, no change needed

| Report area | Source | Notes |
|---|---|---|
| Members, ages, roles | `clients` (age derived from `date_of_birth`) | Complete |
| Account facts: provider, type, value, monthly contribution | `assets` | Complete |
| **Growth / offshore %** | `assets.growth_pct`, `assets.offshore_pct` | Stored `NUMERIC(6,4)` — **decimal**, as the contract requires (`0.82`, not `82`). Resolves the mapping doc's open question. ⚠️ One spot-check of real rows recommended to confirm the fund-facts pipeline writes `0.82` not `82`. |
| Policy table: insurer, policy no., life cover, income disability, capital disability, critical illness, waiting period, beneficiary | `insurance_policies` + `policy_benefits` | Complete. `benefit_type` maps cleanly: `life`/`group_life` → life cover, `income_protection`/`disability` → income disability (monthly), `disability` → capital disability (lump sum), `dread_disease` → critical illness. |
| Wills: has-will, will date, executor, guardians, marital regime, trust name/notes/has-trust | `estate_plans` (+ `estate_data.marital_regime` in JSONB) | Complete |

---

## 2. Needs adding to the CRM — agreed field list

| # | Report field | Current state | Agreed home |
|---|---|---|---|
| 1 | **Held-away & other balance-sheet items** (external investments, property, business, debt) | not in the CRM at all | new separate `balance_sheet_items` table + a **Balance Sheet** tab (see §4). **Built — migration 022.** |
| 2 | **Beneficiary / heirs** (estate) | unstructured, buried in estate notes | new column on `estate_plans` (per-person fact) |
| 3 | **Power of attorney** (estate) | no field | new column on `estate_plans` (per-person fact) |
| 4 | **Risk planning comment** | no field, and no per-group risk record to attach to | new text column on `client_groups` |
| 5 | **Estate liquidity comment** | no field | new text column on `client_groups` |
| 6 | **Estate planning comment** (general) | `estate_plans.notes` exists but is per-person/general | new text column on `client_groups` (household-level) |

### Storage rationale for the comment fields (4–6)

The three planner comments are **household-level** narrative. Rather than hang them off `estate_plans` (which is *per-person*, with a fiddly group-level-row-with-NULL-`client_id` pattern that has already caused NULL-duplicate bugs — TECH_DEBT #61/#62), store all three as plain text columns on **`client_groups`**:

- `risk_review_comment TEXT`
- `estate_liquidity_comment TEXT`
- `estate_planning_comment TEXT`

One clean home, no per-person complication. Surfaced as comment boxes on the Risk/Estate tab(s); the report reads them straight out.

---

## 3. Minor / optional — can stay null or reuse

| Item | Detail | Suggested handling |
|---|---|---|
| **Impairment** column (risk) | No matching value in the `policy_benefits.benefit_type` CHECK constraint | Leave null, or add `'impairment'` to the enum later. Low stakes. |
| **"Will on file: signed / unsigned"** nuance | `estate_plans.has_will` is a plain boolean (Yes/No only) | Accept Yes/No, or capture nuance in notes. Not worth a column. |
| **`displayName`** ("David and Sarah") | `client_groups.name` may be a surname/family label, not a friendly couple name | Derive from members at report time. Not a schema gap. |

---

## 4. Balance-sheet items — the `balance_sheet_items` table (BUILT — migration 022)

**Decision (revised from an earlier `assets.is_held_away` flag):** a **separate** `balance_sheet_items` table, not a flag on `assets`. Rationale: it makes the "only assets I manage" view pure *by construction* — a separate table is never read by AUM, fees, stale-detection, or the Assets-tab summary, so there is **nothing to exclude** (the whole point of the earlier "three exclusions" — now moot). It also fits a shape that spans property, business, and debt, which don't fit the `assets` account shape.

The table holds the household position outside the managed book — held-away investments, primary residence, investment property, business interests, and debt. `kind` (`asset` | `liability`) drives net worth = Σ assets − Σ liabilities.

**`category` taxonomy** (CHECK-constrained, like `assets.type`; income deferred):

```
asset:      retirement_investment, discretionary_investment, primary_residence,
            investment_property, business_interest, cash, other_asset
liability:  debt
```

**Columns:** `client_group_id` (NOT NULL), `client_id` (nullable owner; null = joint/household), `kind`, `category`, `description`, `institution`, `held_via` (flattened ownership, e.g. "Hayes Family Trust"), `value` (nullable — the "R?" case), `value_date`, `monthly_contribution`, `notes`.

Surfaced on a new **Balance Sheet** tab (manual add/edit/delete) with a household net-worth rollup = managed `assets` total + held-away assets − liabilities. The managed Assets tab is **unchanged**.

**Deferred:** feeding held-away *investments* into the report's projection/accounts page, and any combined/net-worth view beyond the tab's rollup. Those are read-time unions of `assets` + `balance_sheet_items` in new `lib/reports/` code — never in the existing managed call sites.

---

## 5. Net additions summary

- **Balance-sheet items:** new `balance_sheet_items` table + Balance Sheet tab (migration 022) — **built**
- **Two estate facts:** beneficiary/heirs + power of attorney (columns on `estate_plans`, migration 023) — **built** (Estate Planning tab)
- **Three comment fields:** `risk_review_comment`, `estate_liquidity_comment`, `estate_planning_comment` (columns on `client_groups`, migration 023) — **built** (risk comment on Risk Planning tab; the two estate comments on Estate Planning tab)

Everything above flows out one-directionally; none of it requires write-back from the tool.

### Resolved

- **Tab split (done):** the combined "Risk and Estate Planning" tab was split into separate **Risk Planning** and **Estate Planning** tabs; the old `/risk-cover` route redirects. The comment boxes live on their respective tabs via the shared `PlanningCommentBox` + `saveGroupComment` action. The client-detail nav also moved to two rows (relationship/activity + financial/planning).
- **Still pending (report itself):** rendering the pre-meeting report from CRM data — including feeding held-away *investments* into the projection/accounts page — is the remaining work (a read-time union of `assets` + `balance_sheet_items` in new `lib/reports/` code).
