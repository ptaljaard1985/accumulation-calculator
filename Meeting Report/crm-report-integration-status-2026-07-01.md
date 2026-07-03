# CRM ↔ Pre-Meeting Report — Integration Status & Field Mapping

**Date:** 2026-07-01
**Supersedes (as the current-state reference):** the field-by-field checks in [`report-field-audit-2026-07-01.md`](report-field-audit-2026-07-01.md). The audit recorded *what needed adding*; this document records *what now exists* and the complete field mapping after that work shipped.
**Companion specs:** [`report-data-contract.md`](report-data-contract.md) (the report's data shape), [`crm-to-planning-mapping.md`](crm-to-planning-mapping.md) (mapping rules), [`report-integration-plan.md`](report-integration-plan.md) (the staged build path), [`report-template-notes.md`](report-template-notes.md) (the HTML template).

---

## 1. Purpose

A single, current-state reference for how CRM data flows into the standalone retirement-planning tool and the pre-meeting review report. It lists **every report field, its CRM source (table.column), the transformation, and its build status** — so the eventual report renderer can be written straight from this document.

**How to read the status column:**

| Symbol | Meaning |
|---|---|
| ✅ CRM | Sourced directly from a CRM column — exists today |
| 🧮 Computed | Derived/aggregated in the (future) report-gathering function from CRM data |
| 🔗 Mapped | Produced by a mapping rule (asset buckets, benefit columns) — rules defined below |
| 🔢 Tool | Produced by the planning tool, not the CRM |
| 📄 Static | Report-system / template constant (firm, agenda, notes) |
| ⏳ Deferred | Not yet built (the renderer, the hydration, the projection wiring) |

---

## 2. Architecture (agreed 2026-07-01)

Data moves between the CRM and the planning tool as a **file**, not a live connection. This was chosen over an embedded/hydration route because it is simpler to build, reuses machinery the tool already ships (its "Open a saved plan" feature), and produces a compliance record for free.

- **File-based, one-directional flow.** The CRM **exports** a review-data file for a client family (a JSON snapshot of the facts the report needs) and saves it to that family's Dropbox folder. The planning tool **opens** that file, reusing its existing "Open a saved plan" mechanism. Nothing writes back to the CRM. The exported file *is* the point-in-time compliance record of "what data fed this report"; the generated report PDF, also saved to Dropbox, is the deliverable.
- **The tool stays standalone.** It keeps the walk-in use case and the interactive scenario play, and gains no live dependency on the CRM — it just reads a file.
- **Per-account mapping happens in the tool.** The exported file carries every account as its own row with a *suggested* planning bucket. Inside the tool a **mapping screen** lets the advisor set each account, per account, to **Retirement assets**, **Discretionary assets**, or **Ignore** (exclude from the projection). The tool then aggregates the confirmed mapping into the planning inputs it runs on. These overrides are made fresh each review and are **not persisted back to the CRM** (that would reintroduce write-back). On a re-export the CRM re-emits its default suggestions and the advisor re-confirms.
- **Comments are maintained in the CRM** (not typed fresh each time) and surfaced as boxes on the Risk Planning / Estate Planning tabs; they travel in the exported file and are pulled into the report.
- **The report is a presentation layer** over one loaded file plus the tool's own projection; it must not pull live values independently from multiple systems.
- **Superseded:** the earlier CRM-side mapping-review screen, the live hydration route (`window.__SW_PREFILL__` injection), and the `planning_review_snapshots` database table. All three are replaced by the file + in-tool mapping (see §7 and `report-integration-plan.md`).

---

## 3. Build status — what now exists

Since the original design docs, the following CRM-side work shipped (all merged):

| Area | What shipped | Migration / code |
|---|---|---|
| **Held-away & other balance-sheet items** | New `balance_sheet_items` table (held-away investments, property, business, debt) + a Balance Sheet tab with net-worth rollup. Kept **separate** from `assets` so the managed-book views stay pristine | migration 022 |
| **Structured estate facts** | `estate_plans.beneficiary_heirs` + `estate_plans.power_of_attorney` (were free-text notes) | migration 023 |
| **Household planner comments** | `client_groups.risk_review_comment`, `estate_liquidity_comment`, `estate_planning_comment` (surfaced on the Risk/Estate tabs via a shared `PlanningCommentBox`) | migration 023 |
| **Risk & Estate split** | The combined tab became separate **Risk Planning** and **Estate Planning** tabs; old `/risk-cover` redirects | — |
| **Impairment cover** | `'impairment'` added to `policy_benefits.benefit_type` | migration 024 |
| **Benefit→column mapping** | `lib/risk/benefit-columns.ts` — the exact mapping the report's Risk Summary needs, **already shared** between the Risk Planning table and the future report | — |

**Net result:** every CRM-side field the report needs now exists. The remaining work is the **report itself** (§7).

---

## 4. CRM source tables (relevant to the report)

| Table | Grain | Report sections it feeds |
|---|---|---|
| `client_groups` | One household | clientFamily, planner comments (risk/estate) |
| `clients` | One person in a household | clientFamily members, owner names, ages, estate will rows |
| `assets` | One **managed** investment account (read-only, from provider imports) | accounts, retirementProjection inputs |
| `balance_sheet_items` | One **held-away / other** position (manual) | accounts (held-away investments), retirementProjection inputs, net worth |
| `insurance_policies` | One policy contract | risk |
| `policy_benefits` | One benefit line within a policy | risk |
| `estate_plans` | One per household member (+ optional group-level row) | estate, retirementProjection assumptions (JSONB) |

**The combined investment picture** (managed + held-away) is a **read-time union of `assets` + `balance_sheet_items`**, performed only in the new report-gathering function — never in the existing managed-investment code paths.

---

## 5. Field-by-field mapping

Report field names follow `report-data-contract.md`. CRM sources are `table.column`.

### 5.1 `firm` — 📄 Static

| Report field | Type | Source | Notes |
|---|---|---|---|
| `name` | string | `SIMPLE_WEALTH_BRANDING` (`lib/constants.ts`) | "Simple Wealth Pty Ltd" |
| `fspNumber` | string | constant | "50637" |
| `footerText` | string | constant | Exact per-page footer |

### 5.2 `clientFamily` — ✅ CRM / 🧮 Computed

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `groupId` | string | `client_groups.id` | Direct |
| `displayName` | string | 🧮 derive from members' `clients.first_name` | e.g. "David and Sarah"; fall back to `client_groups.name` |
| `fullReportTitle` | string/null | 🧮 optional override | Defaults to `displayName` |
| `members[].personId` | string | `clients.id` | Direct |
| `members[].firstName` | string | `clients.first_name` | Direct (`preferred_name` if you prefer) |
| `members[].role` | string | `clients.role_in_group` | `primary`/`spouse`/`child`/`dependant`/`other` |
| `members[].age` | number | 🧮 from `clients.date_of_birth` | Age at `preparedDate` (`lib/utils/age.ts`) |
| `members[].dateOfBirth` | string/null | `clients.date_of_birth` | ISO date |

### 5.3 `report` — 📄 Static / 🧮 Computed

Cover kicker/title/subtitle, `pageCount`, `includePages` are template/report-system values; `coverTitle` = `displayName`, `coverSubtitle` includes `preparedDate`.

### 5.4 `agenda` — 📄 Static

The annual-review agenda (35 items across life planning, cash flow, investment, retirement, risk, estate, tax, other) + seasonal check-ins are **template constants**, not client data. See `sample-report-data.json` for the canonical content.

### 5.5 `accounts` — ✅ CRM + 🔗 Mapped (union of `assets` + `balance_sheet_items`)

**Row source split:**
- **Managed investment accounts** → `assets` rows.
- **Held-away investments** → `balance_sheet_items` rows where `category IN ('retirement_investment','discretionary_investment')`.
- Property / business / debt (`balance_sheet_items` other categories) feed **net worth**, not the investment accounts page.

**Account row fields:**

| Report field | Type | Managed source (`assets`) | Held-away source (`balance_sheet_items`) | Mapping |
|---|---|---|---|---|
| `accountId` | string | `assets.id` | `balance_sheet_items.id` | Direct |
| `ownerPersonId` | string/null | `assets.client_id` | `balance_sheet_items.client_id` | Null = joint/household |
| `ownerName` | string | 🧮 from `clients` | 🧮 from `clients` | Member name or "Joint / household" |
| `provider` | string | `assets.product_provider` | `balance_sheet_items.institution` | Direct |
| `type` | string | `assets.type` | 🔗 from `category` | Display label (see §6.1) |
| `accountName` | string | `assets.investment_vehicle` (fallback `account_number`) | `balance_sheet_items.description` | — |
| `value` | number | `assets.value` | `balance_sheet_items.value` | ZAR; **held-away `value` is nullable** (the "R?" case) — render "—" |
| `monthlyContribution` | number | `assets.monthly_contribution` | `balance_sheet_items.monthly_contribution` | `0` if null |
| `growthAssetsPercent` | number/null | `assets.growth_pct` | (usually null) | **Decimal** — stored `NUMERIC(6,4)`, e.g. `0.82` ✔ verified |
| `offshoreAssetsPercent` | number/null | `assets.offshore_pct` | (usually null) | **Decimal** `NUMERIC(6,4)` |
| `planningBucket` | string | 🔗 §6.1 | 🔗 §6.1 | `retirementAssets`/`discretionaryAssets`/`excluded` |
| `includeInProjection` | boolean | 🔗/tool | 🔗/tool | Default from bucket; advisor overrides in the tool (not persisted) |
| `overrideReason` | string/null | tool | tool | Only when overridden in the tool |

**`accounts.summary`** (four cards) — 🧮 computed:

| Field | Computation |
|---|---|
| `totalInvestmentAssets` | Σ all included investment account `value` (managed + held-away investments) |
| `retirementAssets` | Σ `value` where `planningBucket = retirementAssets` |
| `discretionaryAssets` | Σ `value` where `planningBucket = discretionaryAssets` |
| `monthlyContributions` | Σ `monthlyContribution` across included accounts |

`totalsByPerson[]` and `householdTotal` — 🧮 per-person and household sums of value/contribution (+ value-weighted growth/offshore %).

### 5.6 `retirementProjection` — 🔢 Tool (inputs 🧮 from CRM)

Outputs are the tool's; the **planning-snapshot inputs originate CRM-side**.

| Report field | Type | Origin |
|---|---|---|
| `basis` | string | 🔢 Tool (`todaysMoney`/`nominal`) |
| `plannedRetirementAge` | number | 🔢 Tool |
| `incomeGoalMonthly` | number | 🔢 Tool |
| `projectedStartingIncomeMonthly` | number | 🔢 Tool |
| `goalProgressPercent` | number | 🔢 Tool (decimal) |
| `safeWithdrawalRate` | number | 🔢 Tool (age-based SWR schedule) |
| `expectedReturn` / `expectedInflation` | number | 🔢 Tool (advisor assumptions; decimals) |
| `chartSeries[]` (`age`, `monthlyIncome`) | array | 🔢 Tool |
| `planningSnapshot.retirementAssets.currentBalance` | number | 🧮 Σ retirement-bucket balances (managed + held-away) |
| `planningSnapshot.retirementAssets.monthlyContribution` | number | 🧮 Σ retirement-bucket contributions |
| `planningSnapshot.discretionaryAssets.*` | number | 🧮 Σ discretionary-bucket balances/contributions |
| `capitalEvents[]` (`age`, `label`, `direction`, `amount`, `basis`, `appliesTo`) | array | 🔢 Tool (advisor enters in the tool) |
| `contributionLeverage` | object | 🔢 Tool |

Optional CRM assumption seeds: `estate_plans.saved_scenario` JSONB (`inflation_rate`, `nominal_return`, `life_expectancy`) can pre-fill the tool's return/inflation; `estate_data.monthly_expenses` can seed the income goal.

### 5.7 `risk` — ✅ CRM + 🔗 Mapped (`insurance_policies` + `policy_benefits`)

One row per person/insurer. **Benefit→column mapping is `lib/risk/benefit-columns.ts`** (shared with the Risk Planning tab table):

| Report column | Source | Rule |
|---|---|---|
| `lifeCover` | `policy_benefits.sum_assured` | Σ where `benefit_type IN ('life','group_life')` |
| `incomeDisabilityMonthly` | `policy_benefits.monthly_benefit` | Σ where `benefit_type IN ('income_protection','disability')` |
| `capitalDisability` | `policy_benefits.sum_assured` | Σ where `benefit_type = 'disability'` |
| `criticalIllness` | `policy_benefits.sum_assured` | Σ where `benefit_type = 'dread_disease'` |
| `impairment` | `policy_benefits.sum_assured` | Σ where `benefit_type = 'impairment'` (migration 024) |
| `beneficiary` | `policy_benefits.beneficiary` | Distinct set across the policy's benefits, joined `"; "` |

(`funeral`, `credit_life` are **excluded** from this table, matching the contract.)

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `policyBenefitRows[].personId` | string | `insurance_policies.client_id` | Insured person |
| `policyBenefitRows[].personName` | string | 🧮 from `clients` | — |
| `policyBenefitRows[].insurer` | string | `insurance_policies.provider` | Direct |
| `policyBenefitRows[].policyNumber` | string/null | `insurance_policies.policy_number` | — |
| `policyBenefitRows[].lifeCover` … `impairment` | number/null | 🔗 see above | Per-policy roll-up |
| `policyBenefitRows[].waitingPeriod` | string/null | `policy_benefits.waiting_period_days` | Format to text; show only where an income-disability benefit exists |
| `policyBenefitRows[].beneficiary` | string/null | 🔗 see above | — |
| `totalsByPerson[]` | array | 🧮 | Per-person column sums (active policies) |
| `comments` | string/null | `client_groups.risk_review_comment` ✅ | Maintained on the Risk Planning tab |

### 5.8 `estate` — ✅ CRM (`estate_plans` + `estate_items` + `clients`)

Schema 1.3.0 carries **three lists**: `willRows` (one per member), `powersOfAttorney`, and `trusts`. There is no `willOnFile` field and no per-will-row `powerOfAttorney` field; POA and trusts are their own lists sourced from `estate_items`.

**`willRows[]`** — one per member (`estate_plans` joined to `clients`):

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `willRows[].personId` | string | `estate_plans.client_id` | — |
| `willRows[].name` | string | `clients.first_name` | — |
| `willRows[].maritalRegime` | string/null | `estate_plans.estate_data.marital_regime` (JSONB) | Enum → human wording (`in_community`/`anc_with_accrual`/`anc_without_accrual`) |
| `willRows[].willStatus` | string/null | `estate_plans.will_status` | `On file` / `On file — unsigned` / `Has one — not seen` / `None` / `Not discussed`. Replaces the old boolean `willOnFile` (captures the signed/unsigned nuance). |
| `willRows[].willDate` | string/null | `estate_plans.will_date` | Year or ISO date |
| `willRows[].executor` | string/null | `estate_plans.executor` | Direct (`executor_contact` also available) |
| `willRows[].beneficiaryHeirs` | string/null | `estate_plans.beneficiary_heirs` ✅ | **Structured** (migration 023) |
| `willRows[].guardians` | string/null | `estate_plans.guardian_nominations` | Direct |
| `willRows[].testamentaryTrustForMinors` | boolean | `estate_plans.testamentary_trust` | Will provides a testamentary trust if minor children inherit (schema 1.2.0) |

**`powersOfAttorney[]`** — zero or more across the family (`estate_items`):

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `powersOfAttorney[].personId` | string | `estate_items.client_id` | Person granting the POA |
| `powersOfAttorney[].name` | string | `clients.first_name` | — |
| `powersOfAttorney[].poaType` | string | `estate_items.poa_type` | Display string (e.g. `General`, `Healthcare`) |
| `powersOfAttorney[].agent` | string | `estate_items.agent` | Appointed agent/attorney |
| `powersOfAttorney[].status` | string | `estate_items.status` | Display string (e.g. `On file`, `On file — unsigned`) |

**`trusts[]`** — zero or more, household or per-member (`estate_items`). This is an **array**, not the old `trusts.hasTrust`/`trusts.summary` object:

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `trusts[].name` | string | `estate_items.trust_name` | Trust name |
| `trusts[].ownerName` | string | `estate_items.client_id` → member name, else `Household` | `Household` for a group-level trust, or the owning member |
| `trusts[].trustType` | string | `estate_items.trust_type` | Display string (e.g. `Inter vivos (living)`, `Testamentary`) |
| `trusts[].trustees` | string/null | `estate_items.trustees` | Free text; `null` if unknown |

**Estate comments:**

| Report field | Type | Source | Mapping |
|---|---|---|---|
| `estateLiquidityComment` | string/null | `client_groups.estate_liquidity_comment` ✅ | Maintained on the Estate Planning tab |
| `comments` | string/null | `client_groups.estate_planning_comment` ✅ | Maintained on the Estate Planning tab |

### 5.9 `notes` — 📄 Static

Methodology + confidentiality sections are template constants (`confidentialityText` carries the FSP-50637 wording).

---

## 6. Derivation rules

### 6.1 Asset → planning bucket

**Managed accounts (`assets.type`):**

| `assets.type` | Default `planningBucket` | Notes |
|---|---|---|
| `Retirement` | `retirementAssets` | In projection |
| `Living Annuity` | `retirementAssets` or `excluded` | Usually excluded for accumulation-phase clients |
| `Discretionary` | `discretionaryAssets` | Flexible capital |
| `Tax-Free` | `discretionaryAssets` | Overridable |
| `Endowment` | `discretionaryAssets` | Include unless earmarked |
| null | `needsReview` | Advisor confirms in the tool |

**Held-away items (`balance_sheet_items`, `kind = 'asset'`):**

| `category` | Feeds |
|---|---|
| `retirement_investment` | `retirementAssets` (projection) |
| `discretionary_investment` | `discretionaryAssets` (projection) |
| `primary_residence`, `investment_property`, `business_interest`, `cash`, `other_asset` | **Net worth only** — not the projection or accounts-investment page |
| `debt` (`kind = 'liability'`) | **Net worth only** (subtracts) |

These are the CRM's **suggested defaults** only. The advisor sets the final bucket per account on the tool's mapping screen — **Retirement**, **Discretionary**, or **Ignore** (exclude from the projection) — and the confirmed choice lives in the report snapshot, never back in the CRM. `Ignore` = `planningBucket: 'excluded'` + `includeInProjection: false`.

### 6.2 Owner / age / display resolution
- **ownerName**: `clients.first_name`+`last_name` by `client_id`; null `client_id` → "Joint / household".
- **age**: computed from `clients.date_of_birth` at `preparedDate`.
- **displayName**: derive a friendly couple/family label from members (fallback `client_groups.name`).

### 6.3 Conventions (from the data contract)
- Currency: ZAR numbers (no `R` prefix in data; the renderer formats).
- Percentages: **decimals** (`0.82`, not `82`) — confirmed for `assets.growth_pct`/`offshore_pct` (`NUMERIC(6,4)`).
- Dates: ISO `YYYY-MM-DD`.
- Missing: `null`, never placeholder text.

---

## 7. What still needs building (⏳)

The CRM data is complete; the transfer + report pipeline is not. Build order (file-based flow):

1. **CRM review-data export function** — a new `lib/reports/` function (mirroring `lib/reports/compliance-report.ts`) that assembles one client group into the **review-data file** shape (§7.1): members, the `assets` ∪ `balance_sheet_items` union with a *suggested* bucket per account, the risk rows via `lib/risk/benefit-columns.ts`, the estate rows, and the three planner comments. **This is the only sanctioned place the asset union happens.**

2. **CRM "Export report data" button + Dropbox write** — a button on the client group (e.g. a new "Report" surface or the Overview tab) that runs the export function and writes the JSON to the family's Dropbox folder via the existing `lib/dropbox/client.ts` `uploadFile()` (the same fail-soft pattern Compliance Export uses). The written file is the dated compliance snapshot of source data.

3. **Tool: open the review-data file** — the planning tool's existing "Open a saved plan" flow (`applyPlanFile`) learns a second file `kind` (`sw-review-data`). On opening a review-data file it routes to the mapping screen (step 4) instead of the plan-restore path. (The tool's current guard rejects any file whose `kind` isn't its plan kind, so this branch is required.)

4. **Tool: per-account mapping screen** — the tool renders every account from the file with its owner and its CRM-suggested bucket, and lets the advisor set each to **Retirement / Discretionary / Ignore**. On confirm, the tool aggregates per (owner, bucket) into its existing planning inputs (`hp-ret-A/B`, `hp-disc-A/B`, contributions). The non-planning data (per-account detail, risk, estate, comments) is retained in tool memory to feed the report.

5. **Tool: report generation** — the tool merges its live projection with the loaded facts and renders the 8-page report HTML (`report_master.html` structure): projection page from the tool's own series; accounts / risk / estate pages from the loaded file.

6. **Report → Dropbox** — advisor prints the report to PDF and saves it to the family's Dropbox folder (the deliverable). MVP is manual print-then-drop (matching the estate-planner and compliance-export print flows); a Dropbox auto-push can follow.

7. **Bulk scheduled export (later)** — a CRM cron that runs the step-1/2 export for every active client family on a schedule and writes each file to its Dropbox folder, so a fresh review-data file is always waiting. Meeting prep then becomes "open the file" with no CRM step at meeting time.

Deferred beyond v1: an on-screen combined net-worth view, and auto-generating the Figma-style household summary map — both read from the same `assets` ∪ `balance_sheet_items` union.

### 7.1 The review-data export file (CRM → tool)

One JSON file per client family, written to the family's Dropbox folder. It is a **subset** of the full report snapshot (`report-data-contract.md`): the CRM-sourced facts only — no projection outputs, no confirmed mapping (those are produced in the tool). Shape:

```jsonc
{
  "kind": "sw-review-data",            // tool guard recognises this and routes to the mapping screen
  "schemaVersion": "1.3.0",            // tool treats 1.x tolerantly: accept unknown extra fields, hard-branch only on a future major
  "exportedAt": "2026-07-01T09:30:00+02:00",
  "exportedBy": "Pierre Taljaard",
  "firm": { "name": "Simple Wealth Pty Ltd", "fspNumber": "50637" },
  "clientFamily": {
    "groupId": "...",
    "displayName": "David and Sarah",
    "members": [ { "personId": "...", "firstName": "David", "role": "primary",
                   "age": 48, "dateOfBirth": "1978-04-15" } ]
  },
  "accounts": [                         // one row per managed OR held-away investment account
    {
      "accountId": "...",
      "ownerPersonId": "...",           // null = joint / household
      "ownerName": "David",
      "source": "managed",              // "managed" (assets) | "held_away" (balance_sheet_items)
      "provider": "Allan Gray",
      "type": "Retirement",
      "accountName": "Retirement annuity",
      "value": 2000000,                 // null allowed for held-away "R?" case
      "monthlyContribution": 15000,
      "growthAssetsPercent": 0.82,      // decimal, may be null
      "offshoreAssetsPercent": 0.41,    // decimal, may be null
      "suggestedBucket": "retirementAssets"   // CRM default; advisor confirms/overrides in the tool
    }
  ],
  "netWorthItems": [ /* balance_sheet_items that feed net worth only: property, business, debt */ ],
  "risk": { "policyBenefitRows": [ /* ... */ ], "comments": "..." },
  "estate": {                           // 1.3.0: three lists — willRows, powersOfAttorney, trusts (trusts is an ARRAY)
    "willRows": [
      { "personId": "...", "name": "David", "maritalRegime": "ANC with accrual",
        "willStatus": "On file",        // On file | On file — unsigned | Has one — not seen | None | Not discussed
        "willDate": "2023-06-01", "executor": "...", "beneficiaryHeirs": "...",
        "guardians": "...", "testamentaryTrustForMinors": true }
    ],
    "powersOfAttorney": [
      { "personId": "...", "name": "David", "poaType": "Healthcare",
        "agent": "Sarah", "status": "On file" }
    ],
    "trusts": [
      { "name": "Bennett Family Trust", "ownerName": "Household",
        "trustType": "Inter vivos (living)", "trustees": "..." }
    ],
    "estateLiquidityComment": "...", "comments": "..."
  },
  "assumptionSeeds": {                  // optional pre-fills for the tool's assumptions
    "expectedInflation": 0.05, "expectedReturn": 0.08, "lifeExpectancy": 95,
    "incomeGoalMonthly": null
  }
}
```

`suggestedBucket` is the CRM's default only. The **confirmed** bucket, `includeInProjection`, and any `overrideReason` are produced by the tool's mapping screen (step 4) and live in the report snapshot, never back in the CRM.

---

## 8. Data-quality checks (run before generating a report)

1. Every investment account has a provider, type, owner label, and value (held-away `value` may be a deliberate "R?" null).
2. Every account has a bucket confirmed on the tool's mapping screen (Retirement / Discretionary / Ignore); no account left on the CRM's suggested default unreviewed.
3. Percentages are decimals.
4. Per-person totals match account rows; household total matches per-person totals.
5. Risk benefit column totals match the underlying `policy_benefits`.
6. Waiting periods appear only where an income-disability benefit exists.
7. Wills/estate facts have a value or a deliberate "Unknown".
8. Projection planning-snapshot balances match the bucket sums fed to the tool.
9. Net worth = managed assets + held-away assets − liabilities.

---

## 9. Provenance

- Model for interactive AI features: **`claude-sonnet-5`** (`lib/anthropic/models.ts`; the report renderer, if it uses AI narrative, should read the constant, not hardcode).
- Migrations that established the report fields: **022** (`balance_sheet_items`), **023** (estate facts + planner comments), **024** (`impairment` benefit type).
- Shared mapping code ready for reuse: **`lib/risk/benefit-columns.ts`**.
- Related tabs the advisor maintains the data on: **Assets** (managed), **Balance Sheet** (held-away/net worth), **Risk Planning** (policies + risk comment), **Estate Planning** (wills/beneficiaries/POA/trust + estate comments), **Survivor Scenario** (the estate calculator).
