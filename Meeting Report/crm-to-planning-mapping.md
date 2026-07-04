# CRM to Planning Tool and Report Mapping

This document explains how CRM data should flow into the retirement planning tool and the pre-meeting review report.

The main idea: the CRM stores detailed facts, the planning tool needs simplified planning inputs, and the report needs both the detailed facts and the simplified planning outputs.

## Recommended Flow

The transfer is **file-based** (decided 2026-07-01). The CRM exports a review-data file; the planning tool opens it; the report is generated in the tool. Nothing writes back to the CRM.

1. In the CRM, select a client family and click **Export report data**.
2. The CRM gathers household members, assets, held-away balance-sheet items, policies, benefits, estate plans, and the planner comments, applies a **suggested** planning bucket to each account, and writes a review-data JSON file to the family's Dropbox folder. That file is the dated, point-in-time compliance record of the source data.
3. In the planning tool, click **Open** and select the file.
4. The tool shows a **per-account mapping screen**: each account can be set to **Retirement assets**, **Discretionary assets**, or **Ignore** (exclude from the projection). Each starts on the CRM's suggested bucket.
5. On confirm, the tool aggregates the mapping into its planning inputs and runs the projection. The advisor plays scenarios.
6. The advisor exports the report from the tool and saves the PDF to the family's Dropbox folder (the deliverable).

Later: the CRM can bulk-export steps 1–2 for every active family on a schedule, so a fresh review-data file is always waiting and meeting prep is just "open the file".

## System Responsibilities

| System | Responsibility | Should Not Do |
|---|---|---|
| CRM | Store factual data + planner comments; export the review-data file (with **suggested** buckets) to Dropbox. | Calculate retirement projections; run the final mapping; store the tool's overrides. |
| Review-data file | Carry the CRM facts + suggested buckets between the two systems; be the point-in-time source-data record. | — |
| Planning tool | Own the **per-account mapping screen** (retirement / discretionary / ignore), calculate retirement income, capital events, scenarios, contribution leverage, and **render the report**. | Become the long-term source of factual client data. |
| Report | Present the loaded file + the tool's projection elegantly. | Pull live data independently from multiple systems. |

## CRM Source Tables

Based on the current CRM explainer:

| Domain | CRM Source | Grain |
|---|---|---|
| Household | `client_groups` | One household/client family. |
| People | `clients` | One person within a household. |
| Accounts | `assets` | One provider account. |
| Account fund detail | `assets.underlying_funds` and `fund_fact_sheets` | Fund holdings and derived asset allocation. |
| Policies | `insurance_policies` | One policy contract. |
| Benefits | `policy_benefits` | One benefit line inside a policy. |
| Estate facts | `estate_plans` | One estate plan per household member, plus optional group-level row. |

## Asset Mapping

CRM account rows should remain visible on the account summary page. The planning tool should receive consolidated planning buckets.

### Default Bucket Rules

| CRM `assets.type` | Default Planning Bucket | Report Account Type | Notes |
|---|---|---|---|
| `Retirement` | `retirementAssets` | `Retirement` | Included in retirement projection. |
| `Living Annuity` | `retirementAssets` or `excluded` | `Living Annuity` | Usually excluded for accumulation-phase clients unless intentionally modelled. |
| `Discretionary` | `discretionaryAssets` | `Discretionary` | Included as flexible capital unless earmarked for another goal. |
| `Tax-Free` | `discretionaryAssets` | `Tax-Free` | Included as flexible capital by default, but can be overridden. |
| `Endowment` | `discretionaryAssets` | `Endowment` | Include unless restricted/earmarked. |
| unknown/null | `needsReview` | CRM value | Must be reviewed before projection. |

### Account Values

| Report Field | CRM Field | Mapping Rule |
|---|---|---|
| `provider` | `assets.product_provider` | Direct. |
| `accountName` | `assets.investment_vehicle` | Use investment vehicle where available; fallback to account number or mapped label. |
| `type` | `assets.type` | Direct, with display normalisation. |
| `value` | `assets.value` | Direct. |
| `monthlyContribution` | `assets.monthly_contribution` | Direct; use `0` if null. |
| `growthAssetsPercent` | `assets.growth_pct` | Direct decimal. Confirm CRM stores as `0.82`, not `82`. |
| `offshoreAssetsPercent` | `assets.offshore_pct` | Direct decimal. Confirm CRM stores as `0.41`, not `41`. |
| `ownerPersonId` | `assets.client_id` | Direct. Null means group/joint/unattributed. |

### Consolidated Planning Inputs

| Planning Input | Calculation |
|---|---|
| `retirementAssets.currentBalance` | Sum account values where `planningBucket = retirementAssets` and `includeInProjection = true`. |
| `retirementAssets.monthlyContribution` | Sum monthly contributions for the same included retirement bucket. |
| `discretionaryAssets.currentBalance` | Sum account values where `planningBucket = discretionaryAssets` and `includeInProjection = true`. |
| `discretionaryAssets.monthlyContribution` | Sum monthly contributions for the same included discretionary bucket. |
| `accounts.householdTotal.value` | Sum all visible account rows, whether included in projection or not. |

## Mapping Overrides

Mapping happens **in the planning tool**, per account, on the mapping screen — not in a CRM screen. For each account the advisor confirms or changes:

| Override | Example |
|---|---|
| `planningBucket` | A discretionary unit trust earmarked for a house deposit is set to **Ignore** (excluded). |
| `includeInProjection` | A tax-free investment is shown on the accounts page but excluded from retirement modelling (Ignore). |
| `ownerPersonId` | A group-level imported account is attributed to a specific spouse. |
| `accountName` | A raw provider label is given a cleaner display name. |
| `overrideReason` | Optional note when the CRM's suggested bucket is changed. |

These choices live in the tool session and the generated report — they are **not written back to the CRM**. The one-directional flow means the CRM re-emits its default suggestions on the next export and the advisor re-confirms. Illustrative override record (kept with the report, not in the CRM):

```json
{
  "assetId": "asset-david-ut",
  "field": "planningBucket",
  "from": "discretionaryAssets",
  "to": "excluded",
  "reason": "Earmarked for short-term property deposit",
  "reviewedIn": "planning tool",
  "reviewedAt": "2026-06-28T10:30:00+02:00"
}
```

## Capital Events

Capital events may originate in the planning tool, CRM notes, or meeting preparation.

Recommended fields:

| Field | Meaning |
|---|---|
| `age` | Client age when the event occurs. |
| `label` | Short name, e.g. `Inheritance`, `Property purchase`, `Education cost`. |
| `direction` | `inflow` or `outflow`. |
| `amount` | ZAR value. |
| `basis` | `todaysMoney` or `nominal`. |
| `appliesTo` | Usually `discretionaryCapital`. |

Capital events should be confirmed before relying on a projection.

## Risk Mapping

CRM policies are stored as policy contracts with child benefit rows. The report wants one visible row per person/insurer combination, plus person totals.

### Benefit Mapping

| CRM `policy_benefits.benefit_type` | Report Column | Rule |
|---|---|---|
| `life` | `lifeCover` | Use `sum_assured`. |
| `group_life` | `lifeCover` | Use `sum_assured`. |
| `income_protection` | `incomeDisabilityMonthly` | Use `monthly_benefit`; show waiting period if present. |
| `disability` | `capitalDisability` or `incomeDisabilityMonthly` | Use `sum_assured` for lump sum; use `monthly_benefit` for income benefit. |
| `dread_disease` | `criticalIllness` | Use `sum_assured`. |
| `funeral` | optional/excluded | Usually not shown in this report unless needed. |
| `credit_life` | optional/excluded | Usually excluded from personal cover summary unless relevant. |

### Waiting Period Rule

Display `waitingPeriod` only where the row has an income disability or income protection benefit.

If no income benefit exists, show a dash or leave blank.

## Estate Mapping

Estate documents are now **addable items** in the CRM (`estate_items`), so the estate block carries **three lists** — `willRows` (one per member), `powersOfAttorney`, and `trusts` — plus the two planner comment boxes (schema 1.3.0). There is no longer a `willOnFile` field and no per-will-row `powerOfAttorney` field.

### `willRows[]` — one per member

Will facts come mainly from `estate_plans`, joined to `clients` for the name.

| Report Field | CRM Source | Notes |
|---|---|---|
| `personId` | `estate_plans.client_id` | |
| `name` | `clients.first_name` | |
| `maritalRegime` | `estate_plans.estate_data.marital_regime` | Convert enum to human wording. `null` if unknown. |
| `willStatus` | `estate_plans.will_status` | One of `On file` / `On file — unsigned` / `Has one — not seen` / `None` / `Not discussed`. Replaces the old boolean `willOnFile`. |
| `willDate` | `estate_plans.will_date` | ISO date the will was signed; `null` if none/unknown. Display year if space is tight. |
| `executor` | `estate_plans.executor` | |
| `beneficiaryHeirs` | `estate_plans.beneficiary_heirs` | Structured field (migration 023). |
| `guardians` | `estate_plans.guardian_nominations` | |
| `testamentaryTrustForMinors` | `estate_plans.testamentary_trust` | Boolean — the will provides a testamentary trust if minor children inherit. |

### `powersOfAttorney[]` — zero or more across the family

A separate list, no longer a per-will-row field.

| Report Field | CRM Source | Notes |
|---|---|---|
| `personId` | `estate_items.client_id` | Person granting the POA. |
| `name` | `clients.first_name` | |
| `poaType` | `estate_items.poa_type` | Display string, e.g. `General`, `Healthcare`. |
| `agent` | `estate_items.agent` | Appointed agent/attorney. |
| `status` | `estate_items.status` | Display string, e.g. `On file`, `On file — unsigned`. |

### `trusts[]` — zero or more, household or per-member

A separate list (an **array**, not an object — the old `trusts.summary` / `trusts.hasTrust` object is gone).

| Report Field | CRM Source | Notes |
|---|---|---|
| `name` | `estate_items.trust_name` | Trust name. |
| `ownerName` | `estate_items.client_id` → member name, else `Household` | `Household` for a group-level trust, or the owning member's name. |
| `trustType` | `estate_items.trust_type` | Display string, e.g. `Inter vivos (living)`, `Testamentary`. |
| `trustees` | `estate_items.trustees` | Free text; `null` if unknown. |

### Estate comments

| Report Field | CRM Source | Notes |
|---|---|---|
| `estateLiquidityComment` | `client_groups.estate_liquidity_comment` | Free text planner comment. |
| `estate.comments` | `client_groups.estate_planning_comment` | Free text planner comment. |

## Fields Likely Needed in CRM Later

> **Audited + decided (2026-07-01):** this list has since been checked field-by-field against the live schema and narrowed to an agreed set of additions. See [`report-field-audit-2026-07-01.md`](report-field-audit-2026-07-01.md) for the concrete spec (held-away assets, two estate facts, three household-level comment fields). Notably, mapping overrides are **not** persisted — the one-directional flow means the advisor re-confirms unusual buckets in the tool each review.

The current CRM already has a strong base. The report may benefit from these additional fields:

| Area | Suggested Field | Reason |
|---|---|---|
| Assets | `planning_bucket_override` | Store mapping corrections year to year. |
| Assets | `include_in_retirement_projection` | Avoid re-deciding exclusions each review. |
| Assets | `planning_purpose_note` | Explain if an account is earmarked for another goal. |
| Estate | `beneficiary_heirs_summary` | Avoid burying this in general notes. |
| Estate | `has_power_of_attorney` | Dedicated estate page column. |
| Estate | `estate_liquidity_comment` | Pull directly into report. |
| Risk | `risk_planner_comment` | Pull directly into report. |
| Client group | `annual_review_comments` | General pre-meeting framing. |

## Data Quality Checks

Run these before creating the PDF:

1. Every account has a provider, type, owner label, and value.
2. Every account has a reviewed `planningBucket`.
3. Percent values are decimals.
4. Per-person totals match account rows.
5. Household totals match per-person totals.
6. Policy benefit totals match policy rows.
7. Waiting periods only appear where relevant.
8. Wills and estate facts have either a value or a deliberate `Unknown`.
9. Projection assumptions match the planning tool values.
10. Final report snapshot has been locked.
