# CRM-Side To-Dos (fix in the CRM repo, not the planning tool)

**Date:** 2026-07-03
**Scope:** These defects live in the **separate CRM repository** that produces the `sw-review-data` export. They are **not** planning-tool or report-renderer bugs. Each is evidenced by the real export `dean-andre-and-justine-lesley-review-data-2026-07-02.json` (schema 1.3.0) in this folder.

The planning tool must stay tolerant of these until they are fixed (null-safe seeds, `null`-vs-`0` value handling, etc.), but the source data should be corrected at the CRM so downstream artefacts stop compensating.

---

## 1. `assumptionSeeds` exported all-null

**Evidence:** the export carries

```json
"assumptionSeeds": {
  "expectedInflation": null,
  "expectedReturn": null,
  "lifeExpectancy": null,
  "incomeGoalMonthly": null
}
```

**Problem:** with every seed null, the projection runs on the tool's **generic defaults** rather than the household's actual assumptions. For a real review this silently produces a projection that looks specific but isn't.

**Fix:** the CRM export should populate `expectedReturn`, `expectedInflation`, and `incomeGoalMonthly` (and `lifeExpectancy` for the drawdown tool) wherever those values are known for the family — e.g. from the estate/scenario record (`estate_plans.saved_scenario` JSONB: `inflation_rate`, `nominal_return`, `life_expectancy`; `estate_data.monthly_expenses` for the income goal). Emit `null` only where genuinely unknown.

---

## 2. `netWorthItems` "Dr Dean Inc" exported with `value: 0` instead of `null`

**Evidence:**

```json
{
  "description": "Dr Dean Inc",
  "kind": "asset",
  "category": "business_interest",
  "value": 0
}
```

**Problem:** `0` reads as "worthless", but the intent is "**unvalued**" (a business interest we have not put a figure on). This violates the missing-value convention (`null` for known-empty, never a placeholder number) and understates net worth.

**Fix:** export `value: null` for an unvalued item, per the data-contract convention ("Use `null` for known empty values"). The renderer already handles null (shows "—"); a `0` is indistinguishable from a genuinely zero-value asset.

---

## 3. Risk rows: stray `status`, missing `waitingPeriod`

**Evidence:** each `risk.policyBenefitRows[]` entry carries

```json
"status": "active",
"policyNumber": null,
```

but **no** `waitingPeriod` field, while the data contract and report show a **"Waiting period"** column (`policyBenefitRows[].waitingPeriod`, "only where an income-disability benefit exists" — and both Dean and Justine have income-disability cover).

**Problem — two mismatches:**
- The export emits `status`, which the data contract does **not** define. Either the field is meaningful (inactive-policy filtering) and belongs in the contract, or it should be dropped.
- The export omits `waitingPeriod`, which the contract/report **do** define and display. As-is the report renders a blank column even where an income benefit exists.

**Fix (reconcile one way):**
- If inactive-policy filtering is intended: **add `status` to the data contract** (and to the report's active-policy totals rule), and populate it deliberately.
- Add `waiting_period_days` to the risk export so `waitingPeriod` can render, **or** drop the "Waiting period" column and its rule from the contract/report if the CRM will never carry it.

Pick one; do not leave the export and the contract disagreeing in both directions.

---

## 4. `policyNumber` null on both risk rows

**Evidence:** both Dean and Justine risk rows have `"policyNumber": null`.

**Problem:** minor completeness gap. The policy number is not displayed in the current report, but it is the traceability key for a compliance record ("which policy is this cover from?").

**Fix:** populate `insurance_policies.policy_number` in the export where the CRM holds it. Low priority, but it closes a compliance-record gap.

---

## 5. Firm legal name inconsistent across artefacts

**Evidence:** the real export and `sample-review-data.json` use **`Simple Wealth (Pty) Ltd`**, while `sample-report-data.json`, `crm-report-integration-status-2026-07-01.md` §5.1/§7.1, and the report footer/confidentiality text use **`Simple Wealth Pty Ltd`** (no parentheses).

**Problem:** the firm's legal name is stated two different ways across the artefacts that feed one compliance document.

**Fix:** standardise on the SA-registered **`Simple Wealth (Pty) Ltd`** form everywhere, and have every renderer read `firm.name` **from the file** rather than a hardcoded constant, so the export is the single source of truth. (FSP 50637 is already consistent.)
