# Pre-Meeting Report Data Contract

This document defines the shared data shape for generating the Simple Wealth pre-meeting review report.

The report should be treated as a presentation layer. It should receive one reviewed data snapshot, render it, and avoid pulling live values directly from multiple systems.

## Integration Principle

The transfer is **file-based and one-directional** (decided 2026-07-01). There are two related shapes:

- **The CRM review-data export file** — a *subset* the CRM writes to the family's Dropbox folder: the factual data plus a **suggested** planning bucket per account. No projection, no confirmed mapping. Its shape is defined in `crm-report-integration-status-2026-07-01.md` §7.1. This file is also the point-in-time compliance record of the source data.
- **The report snapshot** — the *full* shape defined below, assembled **inside the planning tool** at generation time: the loaded CRM facts, the advisor's confirmed per-account mapping, and the tool's projection outputs. The report HTML renders from this.

Flow:

1. CRM provides factual data (client details, accounts, policies, wills, trusts, planner comments) and writes the review-data file to Dropbox.
2. The planning tool opens the file; the advisor confirms the per-account mapping (retirement / discretionary / ignore) on the tool's mapping screen.
3. The planning tool calculates retirement projection outputs.
4. The tool combines the loaded facts, the confirmed mapping, and the projection into the report snapshot below.
5. The report HTML renders the snapshot into a PDF, saved to Dropbox.

## Data Conventions

| Convention | Rule |
|---|---|
| Currency | Store monetary values as numbers in ZAR. Do not store `R` or formatted strings unless the field is narrative text. |
| Percentages | Store percentages as decimals. Example: `0.09` means `9.00%`. |
| Dates | Store dates as ISO strings: `YYYY-MM-DD`. |
| Ages | Ages may be provided directly for report display, but date of birth should remain the CRM source where possible. |
| Today's money | Use `basis: "todaysMoney"` where values have been inflation-adjusted into present-day terms. |
| Nominal values | Use `basis: "nominal"` where values are future money values. |
| Missing values | Use `null` for known empty values. Avoid placeholder text in data fields. |
| Display formatting | The renderer formats currency, percentages, spacing, and labels. |

## Top-Level Snapshot

| Field | Type | Required | Source | Notes |
|---|---:|---:|---|---|
| `schemaVersion` | string | yes | report system | Increment when the data shape changes. |
| `snapshotId` | string | yes | CRM/report system | Unique ID for the locked review snapshot. |
| `preparedDate` | string | yes | report system | Date shown in the report. |
| `preparedBy` | string | no | CRM | Planner/advisor name if needed later. |
| `firm` | object | yes | static/CRM | Simple Wealth details and FSP number. |
| `clientFamily` | object | yes | CRM | Household/group and individual members. |
| `report` | object | yes | report system | Cover page, page count, and display options. |
| `agenda` | object | yes | report system/CRM | Annual review agenda sections and seasonal check-ins. |
| `accounts` | object | yes | CRM + mapping layer | Account rows, account totals, and asset split values. |
| `retirementProjection` | object | yes | planning tool | Chart series, projection metrics, assumptions, and leverage. |
| `risk` | object | no | CRM | Policy/benefit rows and planner comment. |
| `estate` | object | no | CRM | Wills, trusts, estate liquidity, and estate comment. |
| `notes` | object | yes | report template | Methodology and compliance wording. |

## `firm`

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `name` | string | yes | Example: `Simple Wealth Pty Ltd`. |
| `fspNumber` | string | yes | Example: `50637`. |
| `footerText` | string | yes | Exact footer wording used on every page. |

## `clientFamily`

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `groupId` | string | yes | CRM `client_groups.id`. |
| `displayName` | string | yes | Example: `David and Sarah`. |
| `fullReportTitle` | string | no | Optional title override. |
| `members` | array | yes | Individual people in the client group. |

Member fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `personId` | string | yes | CRM `clients.id`. |
| `firstName` | string | yes | |
| `role` | string | yes | `primary`, `spouse`, `child`, `dependant`, or `other`. |
| `age` | number | yes | Age at `preparedDate`. |
| `dateOfBirth` | string/null | no | Preferred source for future automation. |

## `report`

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `type` | string | yes | Example: `preMeetingReview`. |
| `coverKicker` | string | yes | Example: `Pre-meeting review document`. |
| `coverTitle` | string | yes | Usually the client family display name. |
| `coverSubtitle` | string | yes | Short cover explanation with date prepared. |
| `pageCount` | number | yes | Current design uses 9 pages. |
| `includePages` | array | yes | Stable page keys to render. |

Current page keys:

1. `cover`
2. `agendaPrimary`
3. `agendaSecondary`
4. `accounts`
5. `netWorth`
6. `retirementProjection`
7. `risk`
8. `estate`
9. `notes`

## `agenda`

The agenda is a report-friendly checklist. The items should be generic enough to apply to most annual reviews.

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `introText` | string | yes | The short paragraph shown on the first agenda page. |
| `sections` | array | yes | Ordered agenda sections. |
| `seasonalCheckIns` | object | yes | Compact reminder row at the bottom of page 3. |

Agenda section fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `sectionId` | string | yes | Stable ID, e.g. `lifePlanning`. |
| `title` | string | yes | Display heading. |
| `subtitle` | string | no | Short description shown in the left label. |
| `style` | string | no | `gold`, `standard`, or other template style. |
| `page` | number | yes | Agenda page number within the report, usually `2` or `3`. |
| `items` | array | yes | Checklist items. |

Agenda item fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `number` | number | yes | Display number. |
| `text` | string | yes | Generic agenda item. |
| `source` | string | no | Optional source hint, e.g. `static`, `crm`, `projection`. |

## `accounts`

The account page is factual. It should show account-level CRM data and the mapped totals used by the planning tool.

Balance-sheet / net-worth items (business, property, debt) now render on their own `netWorth` page (page 5, after `accounts`) as summary cards plus a balance-sheet table, rather than in a cramped strip under the accounts table.

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `summary` | object | yes | Four top summary cards. |
| `rows` | array | yes | One row per account. |
| `totalsByPerson` | array | yes | Per-person totals inserted after each person's accounts. |
| `householdTotal` | object | yes | Household total row. |

Account row fields:

| Field | Type | Required | Source | Notes |
|---|---:|---:|---|---|
| `accountId` | string | yes | CRM `assets.id` | |
| `ownerPersonId` | string/null | yes | CRM `assets.client_id` | Null means joint/group-level. |
| `ownerName` | string | yes | CRM/mapping | Display owner. |
| `provider` | string | yes | CRM `assets.product_provider` | |
| `type` | string | yes | CRM `assets.type` | Tax wrapper/classification. |
| `accountName` | string | yes | CRM `investment_vehicle` or mapped label | |
| `value` | number | yes | CRM `assets.value` | Current market value in ZAR. |
| `monthlyContribution` | number | yes | CRM `assets.monthly_contribution` | Use `0` if none. |
| `growthAssetsPercent` | number/null | no | CRM `assets.growth_pct` | Decimal, e.g. `0.82`. |
| `offshoreAssetsPercent` | number/null | no | CRM `assets.offshore_pct` | Decimal, e.g. `0.41`. |
| `planningBucket` | string | yes | tool mapping screen | `retirementAssets`, `discretionaryAssets`, or `excluded`. The CRM export supplies a *suggested* value; the advisor confirms it in the tool. **Ignore** on the mapping screen = `excluded`. |
| `includeInProjection` | boolean | yes | tool mapping screen | Whether it feeds the retirement projection. `false` when the advisor sets the account to **Ignore**. |
| `overrideReason` | string/null | no | tool mapping screen | Optional note when the advisor changes the CRM's suggested bucket. |

## `retirementProjection`

The retirement projection page is produced mainly by the planning tool.

| Field | Type | Required | Source | Notes |
|---|---:|---:|---|---|
| `basis` | string | yes | planning tool | `todaysMoney` or `nominal`. |
| `plannedRetirementAge` | number | yes | planning tool | Selected age in the tool. |
| `incomeGoalMonthly` | number | yes | planning tool | Monthly income target in today's money. |
| `projectedStartingIncomeMonthly` | number | yes | planning tool | Main projected income number. |
| `goalProgressPercent` | number | yes | planning tool | Decimal, e.g. `0.9713`. |
| `safeWithdrawalRate` | number | yes | planning tool | Decimal, e.g. `0.048`. |
| `expectedReturn` | number | yes | planning tool | Decimal. |
| `expectedInflation` | number | yes | planning tool | Decimal. |
| `chartSeries` | array | yes | planning tool | Income by retirement age. |
| `planningSnapshot` | object | yes | CRM + planning tool | Current assets, contributions, expected return, inflation. |
| `capitalEvents` | array | no | planning tool/CRM | Capital events included in the projection. |
| `contributionLeverage` | object | yes | planning tool | Impact of extra monthly contribution. |

Chart point fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `age` | number | yes | Retirement age. |
| `monthlyIncome` | number | yes | Projected starting monthly income. |

Capital event fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `eventId` | string | yes | Stable ID. |
| `age` | number | yes | Age when event occurs. |
| `label` | string | yes | Example: `Inheritance`. |
| `direction` | string | yes | `inflow` or `outflow`. |
| `amount` | number | yes | ZAR amount. |
| `basis` | string | yes | Usually `todaysMoney`. |
| `appliesTo` | string | no | Example: `discretionaryCapital`. |

## `risk`

The policy page is factual. It summarises existing cover by person and insurer.

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `policyBenefitRows` | array | yes | Rows shown in the policy table. |
| `totalsByPerson` | array | yes | Per-person total rows. |
| `comments` | string | no | Planner comment box. |

Policy benefit row fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `personId` | string | yes | Insured/covered person. |
| `personName` | string | yes | |
| `insurer` | string | yes | |
| `policyNumber` | string/null | no | Not currently displayed but useful for traceability. |
| `lifeCover` | number/null | no | Lump-sum death cover. |
| `incomeDisabilityMonthly` | number/null | no | Monthly income protection/income disability benefit. |
| `capitalDisability` | number/null | no | Lump-sum disability benefit. |
| `criticalIllness` | number/null | no | Severe illness/dread disease benefit. |
| `impairment` | number/null | no | Impairment benefit if recorded. |
| `waitingPeriod` | string/null | no | Only applies where income protection/income disability exists. |
| `beneficiary` | string/null | no | Free-text beneficiary. |

## `estate`

The estate page is factual and comment-led. Estate documents are now addable items in the CRM (`estate_items`), so the export carries **three lists**: `willRows` (one per member), `powersOfAttorney`, and `trusts`. (Schema 1.3.0 — 1.1.0 moved POA/trusts to lists + dropped `willRows.powerOfAttorney`; 1.2.0 added `willRows.testamentaryTrustForMinors`; 1.3.0 dropped `trusts[].status`.)

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `willRows` | array | yes | One row per member (marital regime + will facts). |
| `powersOfAttorney` | array | yes | Zero or more POA items across the family. |
| `trusts` | array | yes | Zero or more trusts (household or per-member). |
| `estateLiquidityComment` | string | no | Planner comment box. |
| `comments` | string | no | General planner comment box. |

Will row fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `personId` | string | yes | |
| `name` | string | yes | |
| `maritalRegime` | string/null | no | Display value. |
| `willStatus` | string/null | no | `On file` / `On file — unsigned` / `Has one — not seen` / `None` / `Not discussed`. |
| `willDate` | string/null | no | ISO date the will was signed. |
| `executor` | string/null | no | |
| `beneficiaryHeirs` | string/null | no | |
| `guardians` | string/null | no | |
| `testamentaryTrustForMinors` | boolean | no | Will provides a testamentary trust if minor children inherit. |

Power-of-attorney fields: `personId`, `name`, `poaType` (display), `agent`, `status`.

Trust fields: `name`, `ownerName` (`Household` or member), `trustType` (display), `trustees`.

## `notes`

The notes/disclaimer page can be mostly static, but should be configurable.

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `sections` | array | yes | Methodology/compliance sections. |
| `confidentialityText` | string | yes | Final regulatory/confidentiality note. |

## Validation Rules

Before generating the report:

1. Confirm every visible client/member name is present.
2. Confirm account totals equal the sum of included account rows.
3. Confirm planning snapshot totals match the planning tool inputs.
4. Confirm percentage fields are decimals, not whole percentages.
5. Confirm policy waiting periods only display where an income disability benefit exists.
6. Note a reason when an account's suggested bucket is overridden (optional but encouraged).
7. Confirm the per-account mapping has been reviewed in the tool before producing the final PDF (the loaded review-data file is the fixed source-data record).
