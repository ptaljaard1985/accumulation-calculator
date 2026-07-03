# Review: CRM Import and Pre-Meeting Report for the V2 Accumulation Tool

Prepared for Pierre Taljaard, Simple Wealth (Pty) Ltd. Scope: the V2 accumulation tool (`retirement_accumulation_v2.html`), the new report design (`report_master.html`), the CRM export (`dean-andre-and-justine-lesley-review-data-2026-07-02.json`, schema 1.3.0), and the contract/mapping/status docs.

## Executive summary

The honest answer to your real question: **the CRM import you believe exists is not built.** When the tool opens a file it only recognises one kind, `sw-accumulation-plan`; your CRM export declares `kind: "sw-review-data"`, so it hits the guard in `applyPlanFile` and is rejected with the alert "That file is not a Simple Wealth accumulation plan, so it was not opened." Nothing loads. There is no per-account mapping screen, no code that reads `accounts` / `suggestedBucket` / `netWorthItems` / `risk` / `estate` / `assumptionSeeds`, and no aggregation of accounts into the `hp-*` planning inputs. Separately, `report_master.html` is a static 8-page mockup (zero `<script>` tags, "David and Sarah" hardcoded on every page) with no renderer wired to any data, and the tool's own live report deck is a different 3-4 page artefact driven only by what you type. Even at the design and data level there are concrete mapping defects, the standout being that **the mapping rules have no slot for child-owned accounts** and would silently drop R407,937.68 of the Lesley family's assets, plus an estate page still built on a superseded schema that would positively assert "No active family trust" for a family that holds the VDW Family Trust.

In short: this is not a "fix the field mappings" job. Stages 4-6 of the integration plan do not exist yet, and the specs those stages would be built from contain real defects that must be corrected before any code is written.

---

## Top issues (ranked)

### 1. [BLOCKER] The tool rejects the CRM export outright — no `sw-review-data` branch exists
- **What:** `applyPlanFile(obj)` only accepts `obj.kind === PLAN_KIND` ('sw-accumulation-plan'); any other kind triggers the not-a-plan alert and `return false`.
- **Evidence:** `retirement_accumulation_v2.html:4673` (`var PLAN_KIND = 'sw-accumulation-plan';`), guard at `4735-4737`. `handlePlanText` (`4821-4826`) parses JSON then calls `applyPlanFile(obj)` directly with no inspection of `obj.kind`. Open is wired at `5472-5473` (`btn-open-plan`, `btn-open-plan-empty` -> `openPlan` -> `showOpenFilePicker` -> `handlePlanText`). Grep for `sw-review-data` across the tool: 0 hits. The real export's `kind` is `sw-review-data` (schemaVersion 1.3.0).
- **Why it matters in a meeting:** The one file the whole CRM handoff produces is bounced. This is the exact opposite of acceptance criterion §7.1 ("recognises `kind: sw-review-data` ... no not-a-plan alert"). Every other finding below is downstream of this gate.
- **Fix:** In `handlePlanText`/`applyPlanFile`, dispatch on `obj.kind` after parse: keep the existing restore path for `PLAN_KIND`; add `if (obj.kind === 'sw-review-data') openMappingScreen(obj)`; only fall through to the friendly alert for genuinely unknown kinds. Treat `schemaVersion` tolerantly across the 1.x range.

### 2. [BLOCKER] No mapping screen and no `accounts[]` -> `hp-*` aggregation
- **What:** Even if the guard passed, there is nowhere for the 13 accounts to go. No Retirement/Discretionary/Ignore UI, no per-(owner, bucket) summation, no reader for `value` / `monthlyContribution` / `source` / `provider` / `type`.
- **Evidence:** Grep over the tool returns 0 for `suggestedBucket`, `accounts`, `netWorthItems`, `assumptionSeeds`, `ownerPersonId`, `clientFamily`, `mapping`. The only `setHpFormatted`-from-data paths are `loadSampleData()` (`4058-4092`, hardcoded David & Sarah) and `applyScenarioContrib()` (`4094-4117`, scenario sliders); neither reads a CRM file. Brief §4.2 requires summing confirmed accounts into `hp-ret-A/B`, `hp-ret-contrib-A/B`, `hp-disc-A/B`, `hp-disc-contrib-A/B`.
- **Why it matters:** This is the core of Stages 4-5. You cannot bucket accounts, cannot correct the CRM's `suggestedBucket`, and the projection inputs are never populated from the export.
- **Fix:** Build the mapping screen per brief §4: one row per account pre-set to `suggestedBucket`; held-away tag for `source==='held_away'`; null value shown as "—" but summed as 0; joint (`ownerPersonId===null`) defaulting to 50/50. On Confirm, aggregate per (spouse-slot, bucket) via `setHpFormatted`, set `hp-age-A/B` and `spouseNames` from `members[]`, then `refresh()`. Retain `accounts`/`netWorthItems`/`risk`/`estate` in memory for the report.

### 3. [BLOCKER] `report_master.html` is a static mockup — the renderer is unbuilt
- **What:** The 8-page report has no data-binding layer at all.
- **Evidence:** `report_master.html`: 0 `<script>` tags, 0 `data-bind`/`{{`/`${` markers; "David" appears 19x, "Sarah" 18x. Cover title at line 818, page-header metas at 834/914/1004/1137/1250/1372/1466 are all literal HTML. No repo code turns a review-data JSON into this HTML.
- **Why it matters:** There is no path from the CRM export to a printed report. Producing the Lesley report today means hand-editing HTML. Note this is documented, intentional deferred work (status doc marks the renderer "Not yet built") — but it means Stage 6 is not partially done, it is absent.
- **Fix:** After the mapping screen lands, build the Stage 6 renderer that reads the retained CRM facts into the `report_master.html` page structure (accounts / net-worth / risk / estate pages) while sourcing the projection page from the tool's live series. `report_master.html` must become a template the tool populates, not a shipped file.

### 4. [HIGH] Child-owned accounts have no mapping slot — R407,937.68 + R450/mo silently dropped or misrouted
- **What:** The Lesley household has 4 members including two children (Lucy Mae, 11; Logan Ash, 13), each owning a Tax-Free Investment of R203,968.84 (R225/mo), both `suggestedBucket: discretionaryAssets`. The mapping rules define only `primary -> Spouse A`, `spouse -> Spouse B`, and `ownerPersonId === null -> 50/50`. A child's `ownerPersonId` matches a member but resolves to no A/B slot, and is not null, so no rule applies.
- **Evidence:** Real export `accounts[0]` (Lucy, `1d74bc6d...`, lines 49-62) and `accounts[1]` (Logan, `21e34e86...`, lines 63-76); members at lines 30-45. Brief §4.2 lines 97-115, §4.3 lines 126-131. Combined value R407,937.68 = 3.80% of the R10,743,007.09 investable total; combined contrib R450.00.
- **Why it matters:** Either the two TFIs vanish from the projection (discretionary understated 13.96%: R2,514,692.73 mapped vs R2,922,630.41 true) or they get 50/50-split onto the parents, over-counting. The inverse risk is just as bad — honouring `suggestedBucket: discretionaryAssets` would fold the children's earmarked TFSAs into the parents' retirement income. A client looking at their own accounts page will see the children's TFSAs listed but not reflected in the retirement number. Either direction produces a wrong headline income figure. The David/Sarah sample (2 members) never exercises this, so it passes review while the real file is mishandled.
- **Fix:** Add an explicit rule for `role='child'|'dependant'|'other'` owners: default them to Ignore/excluded (a minor's TFI is not the parents' retirement capital), surface them on the mapping screen with a "child" tag so you consciously attribute or exclude each, and never let a non-A/B owner fall through to a silent 0, a 50/50 split, or a crash. Update brief §4.2/§4.3 to cover more than 2 members, and add a child-owned account to `sample-review-data.json` so the acceptance criteria exercise the path.

### 5. [HIGH] Estate page (and 3 of 4 docs) built on the OLD schema — POA list dropped, will status misstated, existing trust denied
- **What:** `report_master.html`'s estate table uses the pre-1.1.0 shape (per-row "Will on file" + "Power of attorney" columns), hardcoding "Yes, signed" and per-row "No" POA. Schema 1.3.0 moved POA and trusts to separate lists and replaced `willOnFile` with `willStatus` (5 states) plus `testamentaryTrustForMinors`.
- **Evidence:** Estate headers `report_master.html:1387-1398`, hardcoded values 1404/1414/1409/1419; static trust note "No active family trust is currently recorded" 1428-1433. Real data: `willStatus` "On file — unsigned" (Dean) / "Not discussed" (Justine) (json 311/322); `testamentaryTrustForMinors: true` for Dean (316); a separate `powersOfAttorney[]` with 2 items, both unsigned (330-345); `trusts[]` = `[{ name: "VDW Family Trust", ownerName: "Household", trustType: "Inter vivos (living)", trustees: null }]` (346-353). Three docs still describe the old shape: `crm-to-planning-mapping.md` lines 150-162, `crm-report-integration-status §5.8` lines 194-206, and `§7.1` file spec (schemaVersion "1.0.0", trusts as object). Only `report-data-contract.md` (line 226) is current.
- **Why it matters:** For a couple with two minor children, this compliance-facing document would drop both power-of-attorney action items (both unsigned — live to-dos), collapse the will status to a false "Yes, signed" (Dean is unsigned, Justine not discussed), never show the testamentary-trust-for-minors flag, and tell the family in writing they have no trust while they hold the VDW Family Trust. An implementer coding from the stale docs would look for `willOnFile` / `trusts.summary` and render blank, or treat `trusts` as an object and crash on the array.
- **Fix:** Rework the estate page to 1.3.0: a `willRows` table keyed on `willStatus` + a testamentary-trust indicator; a distinct `powersOfAttorney[]` table (name, type, agent, status); a `trusts[]` table (name, owner, type, trustees) with a genuine empty-state only when `trusts.length === 0`. Bring `crm-to-planning-mapping.md` §Estate, `crm-report-integration-status §5.8`, and both `§7.1`/`§2` file specs up to the shape already in `report-data-contract.md`.

### 6. [HIGH] Report deck consumes only live inputs — no CRM facts, no 8-page structure
- **What:** The tool's `buildReportData()` reads only `p.inputs` / `incomeCurveData(inputs)` / live `#client-name`/`#client-date` and produces the Session 19-24 landscape deck (cover, projection, optional scenario, methodology). It never touches `accounts`, `netWorthItems`, `risk`, or `estate`.
- **Evidence:** `buildReportData` at `4972` (`var inputs = p.inputs`), DOM reads at `4982`/`4991`, household rows `5004-5011`, chart from `incomeCurveData` `5014`. `runReportExport` builds 3-4 pages from `baseline.p` / `lastProjection`. The 8-page target (`report_master.html`) is static with no renderer.
- **Why it matters:** Stage 6 ("merge live projection with loaded facts -> 8-page structure") is fiction. ~5 of the 8 pages (agenda x2, accounts, risk, estate) have no implementation anywhere, and the tool's scenario page has no home in the 8-page design — which mis-sets the entire remaining build estimate.
- **Fix:** State plainly in `report-integration-plan.md` that `report_master.html` is a static mockup and the tool's 4-page deck is a separate artefact. Enumerate the missing pages as unbuilt. Decide the fate of the scenario-comparison page. Then build the renderer that binds CRM facts into the 8-page structure.

---

## By theme

### 1. Import implementation status

The CRM -> tool -> report pipeline (integration plan Stages 3-6) does not exist:

| Capability | Status |
|---|---|
| Open `kind: "sw-review-data"` | Not built — rejected with alert (`4735-4737`) |
| Per-account mapping screen | Not built — 0 references |
| `accounts[]` -> `hp-*` aggregation | Not built |
| Retain CRM facts for the report | Not built |
| 8-page report renderer | Not built — `report_master.html` is a static mockup |

The plumbing targets are ready — the mapping-destination inputs (`hp-ret-A/B`, `hp-ret-contrib-A/B`, `hp-disc-A/B`, `hp-disc-contrib-A/B`, `hp-age-A/B`) and the `setHpFormatted(id, n)` setter exist — but no code fills them from a file. The acceptance criteria in brief §7 and status §7.1 are written as if verifiable now ("recognises `kind: sw-review-data`"); they should read "to be implemented," and Stages 4-6 should be marked unbuilt in the status doc.

### 2. Field and mapping defects

The real export is structurally clean at the field level: all 13 accounts carry every required field with correct types, all percentages are valid decimals (max offshore 0.9857, none > 1.0), no null account values, all 13 `suggestedBucket`s correct per §6.1, and multi-account-per-(owner,bucket) sums aggregate fine. The defects are in the mapping rules and the specs, not the data shape:

- **[HIGH] Child-owned accounts** — no rule (see Top issue #4).
- **[MEDIUM] Estate schema drift across docs** — 3 of 4 mapping docs describe the pre-1.3.0 estate shape (see Top issue #5). A renderer built from them mis-reads the real file.
- **[MEDIUM] Risk `waitingPeriod` column has no backing field.** `report-data-contract.md:221` and `report_master.html:1275` expect a "Waiting period" value "only where income disability exists," but neither the real export nor `sample-review-data.json` emits a `waitingPeriod` field on risk rows (they carry `personId, personName, insurer, policyNumber, status, lifeCover, incomeDisabilityMonthly, capitalDisability, criticalIllness, impairment, beneficiary`). Both Lesley spouses have income disability (R85,196 / R93,601), so the rule says a value should show, yet there is nothing to show. Conversely `status: "active"` arrives but the contract has no `status` field. Fix: either add `waiting_period_days` to the CRM risk export or drop the column and the rule; add `status` to the contract if the report is meant to filter inactive policies.
- **[LOW] `assumptionSeeds` all null** — spec-compliant fallback to tool defaults, but see Real-data section below.

### 3. The new report format

`report_master.html` is a well-executed 8-page A4-landscape design (assets, A4 landscape, and the exact FSP-50637 footer wording all check out) but it is a design mockup, not a renderer. Pointed at the real export it would be wrong on every page:

- **Cover + 7 page headers** hardcode "David and Sarah" and "28 June 2026"; the real `displayName` is "Dean Andre and Justine Lesley" (long enough to want an overflow check against the 58px cover title once bound).
- **Accounts page** hardcodes 4 rows / 2 owners and summary cards R5,000,000 / R4,000,000 / R1,000,000 / R36,000. The real file has 13 accounts across 4 owners. The fixed 2-owner / 4-row layout has no room for 13 rows or child-owner subtotals. Make it data-driven (loop rows, per-owner subtotals for every distinct owner, household total; compute the summary cards from mapped rows).
- **Estate page** — old schema, false "no trust" (see Top issue #5).
- **Retirement projection page** is fully hardcoded including the SVG chart (R97,130/mo, goal R100,000, snapshot R4,000,000). The real retirement bucket is R7,820,376.68. Wire it to the tool's live series/snapshot; recompute the SVG income curve from `chartSeries`.
- **No `value: null` handling** (contract requires "—" for held-away unknowns) and owner cells expect first-name-only while real `ownerName` is full ("Dean Andre van der Westhuizen"). Add null-value formatting and owner short-name derivation. The real file happens to have no nulls, so this bites the general case.
- **`netWorthItems` has no render home** — the contract's top-level snapshot and the template have no net-worth section, yet the export carries R13,600,000 (Ocuwise Capital business), R0 (Dr Dean Inc), R5,700,000 (residence), -R3,750,000 (bond). For this family those are the largest numbers on the balance sheet. Either add a net-worth page or document explicitly that `netWorthItems` is carried for future use and deliberately not rendered in v1 — do not leave it exported-but-orphaned.

### 4. Real-data quality — the Dean/Justine file

Aggregation math is clean. Household net worth reconciles to **R26,293,007.09**; investment assets that actually drive the projection are **R10,335,069.41 after the two children are dropped** (R10,743,007.09 total less R407,937.68 child-owned). What the tool would set per spouse:

| Input | Dean (Spouse A) | Justine (Spouse B) |
|---|---|---|
| `hp-ret` (retirement balance) | R4,630,416.00 | R3,189,960.68 |
| `hp-ret-contrib` (monthly) | R1,458.35 | R765.77 |
| `hp-disc` (discretionary balance) | R1,676,196.08 | R838,496.65 |
| `hp-age` | 41 | 40 |

Combined retirement R7,820,376.68; combined discretionary (excl. children) R2,514,692.73; total monthly contributions across the file R7,731.54.

Dropped child accounts: **Lucy Mae TFI R203,968.84 + Logan Ash TFI R203,968.84 = R407,937.68**, plus **R450/mo** contributions (R225 each), currently `suggestedBucket: discretionaryAssets` with no valid mapping destination.

Other meeting-material data points:
- **[LOW] `assumptionSeeds` all null** (`expectedInflation`, `expectedReturn`, `lifeExpectancy`, `incomeGoalMonthly`). The projection for a 40/41 couple with a ~24-year horizon would run on the tool's 5/5/5 defaults (0% real return) with a blank income goal — which also disables the goal-progress readout and close-the-gap solver. This is spec-compliant (§4.2: "only if present, else leave defaults"), and 5% is a deliberate conservative default, but it means the headline is not client-specific until you set assumptions live. Surface "CRM supplied no return/inflation/goal — using tool defaults" on the mapping/confirm screen so it is a deliberate choice, not a silent one. Note the §7.5 acceptance test (return 8% / cpi 5% / goal 40000) comes from the David/Sarah sample and does not match production — validate against the real file.
- **[LOW] Contribution-light pots.** Combined retirement contributions (~R2,224/mo) are ~0.34%/yr of the ~R7.82m balance; 4 of 6 retirement accounts have zero ongoing contribution. The projection grows almost entirely on assumed returns, which compounds the sensitivity to the (currently default) return assumption. Not a bug — worth a narrative note.
- **[MEDIUM] Estate readiness.** Neither spouse has a signed will (Dean "On file — unsigned", Justine "Not discussed" with executor/heirs/guardians all null); both POAs unsigned; VDW Family Trust has `trustees: null`; two minor children. The `estateLiquidityComment` asserts "no estate duty or CGT on first death" on the premise that "both spouses leave everything to each other" — but Justine's mutual-will position is undocumented. On a R26.3m estate with minors, a report that shows the liquidity comment without loudly flagging the unsigned/undiscussed wills, unsigned POAs and trustee-less trust would give false comfort. Surface an explicit estate-readiness red-flag block.
- **[LOW] Suspicious duplicate values to confirm.** The two children's TFIs are identical to the cent (value, contrib, growth 0.9832, offshore 0.4225); Dean vs Justine "Investment Platform Unit Trust" differ by only R447.29 with identical R2,083.71 contributions. Likely mirrored couple debit orders / same-fund same-date openings rather than export duplication, but worth an eyeball — if any is a true dupe, `hp-ret-A` / `hp-disc-A` are overstated. Show provider + accountName + accountId on the mapping screen so same-named accounts are visibly distinct.
- **[LOW] `Dr Dean Inc` recorded as value 0** rather than null — reads as "worthless" on a net-worth page when it is more likely unvalued. Confirm and export null / render "—" per the contract's missing-value convention.
- **[LOW] Risk data is coherent** — both spouses covered (Dean life R10,774,885 / income disability R85,196; Justine life R12,191,171 / income disability R93,601). Two follow-ups: `risk.comments` flags Dean's income protection is below his earnings (surface it prominently, do not bury it), and `policyNumber` is null for both rows (minor completeness gap for a compliance record).

### 5. Documentation contradictions

The docs describe two report systems as if they were one and disagree with the real data on schema and estate shape:

- **[MEDIUM] Two report systems conflated.** The tool ships a 3-4 page live deck; `report_master.html` is a separate 8-page static mockup. `report-integration-plan.md` Stage 6 asserts "the tool renders the 8-page report" — false today; nothing bridges them.
- **[HIGH] Estate shape contradiction.** New/1.3.0 shape (real export + `sample-review-data.json` + `report-data-contract.md:224-252`) vs old shape still in `crm-to-planning-mapping.md:150-162`, `crm-report-integration-status §5.8`, `report_master.html:1391-1421`, and `sample-report-data.json:534-565`. Four of six surfaces — including the render template — disagree with the two authoritative newest ones.
- **[MEDIUM] Schema version stated as 1.0.0 in three places** (`planning-tool-mapping-screen-brief.md:32`, `crm-report-integration-status §7.1:280`, `sample-report-data.json:2`) while every real and sample review file is 1.3.0. `sample-report-data.json` is stale in data too (old estate shape, `trusts` as an object) — a renderer coded from it would break on the real array. Add a note that the tool must accept 1.x tolerantly and never hard-fail on a minor bump.
- **[MEDIUM] Acceptance criteria hardcoded to the David/Sarah sample** and cannot pass against the real export (13 accounts / all `managed` / no null values / no held-away; owners across 4 people incl. children; all-null seeds; fractional-cent values). An implementer who "verifies against §7" passes on the sample and ships — false green. Add a second acceptance fixture based on the real Lesley file.
- **[LOW] `sample-report-data.json` stale against its own contract** (schema, estate shape); **[LOW] pipeline naming ambiguity** — Stages 1-2 name `sample-report-data.json` (tool->report snapshot shape) while the real flow consumes the `sample-review-data.json` (CRM->tool transport) shape. Document the two distinct roles and the in-tool transform (review-data + live projection -> report snapshot) that bridges them.
- **[LOW] Firm legal name inconsistent** — "Simple Wealth Pty Ltd" (report artefacts) vs "Simple Wealth (Pty) Ltd" (CRM exports, CLAUDE.md). Pick the parenthesised SA-registered form and have the renderer take `firm.name` from the loaded file rather than a template constant. Note the tool is itself internally split (deck footers use "Pty Ltd", disclaimer uses "(Pty) Ltd").

---

## What to build / fix (sequenced)

**Stage 4 — teach the tool the new file (unblocks everything):**
1. Add the `obj.kind` dispatch in `handlePlanText`/`applyPlanFile`: `PLAN_KIND` -> existing restore; `'sw-review-data'` -> new mapping flow; else -> friendly alert. Additive; must not break existing plan Save/Open round-trip. Accept 1.x `schemaVersion` tolerantly.

**Stage 5 — mapping screen and aggregation:**
2. Build the per-account mapping screen (one row per account, pre-set to `suggestedBucket`, Retirement/Discretionary/Ignore toggle, held-away tag, provider+accountName+accountId shown, null value as "—" summed as 0).
3. **Before wiring the aggregation, add the child/dependant/other owner rule** (default Ignore, visible child tag, per-row owner override). Never let a non-A/B owner fall through to a silent drop or 50/50 split. Update brief §4.2/§4.3 for >2 members.
4. On Confirm, aggregate per (spouse-slot, bucket) into `hp-*`, set `hp-age-A/B` and `spouseNames` from `members[]`, then `refresh()`. When `assumptionSeeds` are null, keep defaults but surface an "assumptions not supplied" banner so you set return/CPI/goal deliberately.
5. Retain `accounts` / `netWorthItems` / `risk` / `estate` in memory for the report.

**Stage 6 — the report renderer:**
6. Reconcile the specs first: update the estate shape to 1.3.0 across `crm-to-planning-mapping.md`, `crm-report-integration-status §5.8`, and both file specs; bump the 1.0.0 version literals; regenerate `sample-report-data.json` to the current contract; resolve the `waitingPeriod`/`status` and firm-name inconsistencies; add a net-worth section to contract + template or document its deliberate absence.
7. Re-cut `report_master.html` into a bindable template: data-driven accounts table (N owners incl. children, per-owner subtotals, computed summary cards); 1.3.0 estate page (will-status table + separate POA table + trusts table + estate-readiness red-flags); null-value and owner short-name handling; bound cover/header names and dates.
8. Build the tool-side renderer that assembles the report snapshot from retained CRM facts + the live projection and populates the 8-page template. Decide the fate of the tool's scenario page.

**Cross-cutting:**
9. Add a second acceptance fixture from the real Lesley file (13 accounts, child owners, all-null seeds, fractional cents, business/bond net-worth) so the criteria exercise the paths the David/Sarah sample never touches.
10. Confirm with the client the suspected duplicate accounts and the `Dr Dean Inc` value-0 before any projection is presented.

Bottom line: the mapping and data-field concerns you flagged are real, but the more important finding is that the import feature you expected to test is not there to test yet. Fix the specs (especially child accounts and the estate schema), then build Stages 4-6 in that order.
