# Calculations

The maths the calculator implements. This is the document to check when you disagree with a number the calculator produces; the test suite in `tests/python/` exercises every rule below against a fresh Python implementation.

## Overall structure

- Projections are annual, starting at year 1 (the first year after today) and running through year N where N = `retirement_age − reference_spouse_age`, minimum 1.
- The reference spouse is the youngest or oldest, depending on the anchor toggle. "Youngest reaches 65" (default) uses `min(ageA, ageB)` as the reference.
- Each year: 12 months of compounding and contribution, then contribution escalation for the next year, then any capital events for this year.
- Position `i` in every series represents the start of year `i+1`. Position 0 is today's balance (before any growth or contributions).

## Growth

All four pots (retirement A, retirement B, discretionary A, discretionary B) grow at the same nominal return `rNom`. No asset-class separation. No stochastic modelling. One knob.

Monthly compounding: `r_month = (1 + rNom)^(1/12) − 1`. This gives `(1 + r_month)^12 = 1 + rNom` exactly, so annualised growth matches the input. Each month:

```
balance = balance × (1 + r_month) + monthly_contribution
```

Contribution is applied after growth (end-of-period / ordinary annuity). This is standard for retirement-fund platforms in South Africa.

## Contribution escalation

Contributions escalate once per year at the start of each new 12-month block. Year 1 uses the base amount the user entered; year 2 uses base × (1+esc); year 3 uses base × (1+esc)^2; etc.

Cumulative nominal contributions over N years from base PMT at escalation rate e:

```
total_nominal_contribs = Σ_{y=0}^{N-1} PMT × 12 × (1 + e)^y
                       = PMT × 12 × ((1 + e)^N − 1) / e     (if e > 0)
```

The Python audits check this against the closed-form geometric sum.

## Deflation to real terms

```
real[i] = nominal[i] / (1 + cpi)^i
```

Applied to every series (totals, balances, contributions, starting-balance-compounded). Position 0 is unscaled, so real and nominal agree at t=0.

The final projection's real value is just `nominal_final / (1 + cpi)^N`.

## Starting-balance-compounded series

A separate tracker that holds "what would the starting capital alone be worth at each future year, with no contributions". Grows at the same monthly rate as the real balances:

```
start_tracker_month = start_tracker_month × (1 + r_month)   // every month, no contribution
```

In nominal terms, at year N: `start_tracker = initial_capital × (1 + rNom)^N`.
In real terms, at year N: `start_tracker_real = initial_capital × ((1 + rNom) / (1 + cpi))^N`.

Used by the growth-breakdown chart to decompose each year's total into three components.

## Growth breakdown decomposition

Each year's total can be split into three additive components:

- **A. Starting balance, compounded** — the starting-balance-compounded tracker above. Represents what the original capital alone is worth.
- **B. Cumulative contributions** — rand contributed so far, with no growth credited to this component.
- **C. Growth on contributions** — the remainder: `total − A − B`. Captures all the investment growth that happened on contributions.

**The three components sum exactly to the year's total.** This is verified in the Python audit for every year of every test scenario, in both real and nominal views.

Note: capital events are absorbed into component C. A large inflow will show as a one-year step-up in the growth layer, not as a separate component. This is an intentional simplification — the breakdown chart is most useful when no large events are present, and the methodology note flags this.

## Monthly income at retirement

```
monthly_income_today = final_real × swr(retirement_age) / 12
```

where `swr(age)` is an **age-based safe withdrawal rate**, not a flat 5%. The age is the reference spouse's age on retirement (`refAge + years`, which equals the configured retirement age in the normal case). **Before tax.** **Not a drawdown simulation** — for that, the household graduates to the drawdown calculator at retirement.

### The SWR schedule

A shorter remaining horizon supports a higher sustainable draw, so the rate rises with the age at retirement. Tabulated for ages 55-100:

| Age | SWR | Age | SWR | Age | SWR | Age | SWR |
|----:|----:|----:|----:|----:|----:|----:|----:|
| 55 | 4.2% | 67 | 5.0% | 79 | 7.2% | 91 | 14.4% |
| 56 | 4.3% | 68 | 5.1% | 80 | 7.5% | 92 | 15.3% |
| 57 | 4.3% | 69 | 5.2% | 81 | 8.0% | 93 | 16.2% |
| 58 | 4.4% | 70 | 5.3% | 82 | 8.5% | 94 | 17.1% |
| 59 | 4.4% | 71 | 5.5% | 83 | 9.0% | 95 | 18.0% |
| 60 | 4.5% | 72 | 5.7% | 84 | 9.5% | 96 | 19.4% |
| 61 | 4.6% | 73 | 5.8% | 85 | 10.0% | 97 | 20.8% |
| 62 | 4.6% | 74 | 6.0% | 86 | 10.7% | 98 | 22.2% |
| 63 | 4.7% | 75 | 6.2% | 87 | 11.4% | 99 | 23.6% |
| 64 | 4.7% | 76 | 6.5% | 88 | 12.1% | 100 | 25.0% |
| 65 | 4.8% | 77 | 6.7% | 89 | 12.8% | | |
| 66 | 4.9% | 78 | 7.0% | 90 | 13.5% | | |

**Out-of-range ages.** Below 55 the rate drops 0.1pp per year under 55 from the age-55 value (4.2%), floored at 3.5% (so age 48 and below all sit at 3.5%). Above 100 the rate is held at the age-100 value (25%). Ages are integers; no interpolation.

Income at age 65 is now 4.8%, not the old flat 5%. The same `swr(age)` drives both the headline (at the configured retirement age) and the Income chart (at each candidate age), so the chart's marker value always equals the headline. The methodology note makes clear this is a planning approximation, not a guaranteed sustainable rate.

## Capital events

Each event has `{ age, amount, todaysMoney (bool), kind ('inflow' | 'outflow') }`. Age is in the reference spouse's age. Applied at the end of the designated year, after growth and contributions.

Year offset:
```
yr_offset = event_age − reference_spouse_age_today
```

Events with `yr_offset < 1` or `yr_offset > years` are silently filtered out.

Nominal rand at application:
```
if todaysMoney:
    nominal_amt = amount × (1 + cpi)^(yr_offset − 1)
else:
    nominal_amt = amount
```

(Note: `yr_offset − 1`, not `yr_offset`, because today's-money event at year 1 has had no CPI time yet.)

### Inflow

Proportional to current discretionary balance:

```
total_disc = discA + discB
if total_disc > 0:
    weight_A = discA / total_disc
    discA += nominal_amt × weight_A
    discB += nominal_amt × (1 − weight_A)
else:
    discA += nominal_amt   # all to A by convention when both disc are zero
```

Retirement fund is never touched. This is deliberate: in practice, inheritances and bonuses typically land in discretionary (RA contribution caps, tax treatment, flexibility). If the adviser wants to model an RA top-up they do it by increasing the monthly retirement contribution — but such inflows are usually not lumpy.

### Outflow

Proportional to discretionary, capped at available:

```
available = discA + discB
remove = min(available, nominal_amt)
if available > 0:
    weight_A = discA / available
    discA -= remove × weight_A
    discB -= remove × (1 − weight_A)
```

If the outflow exceeds discretionary, the excess is silently ignored. The retirement fund is not touched. This is intentional — it surfaces the "you cannot fund a house purchase from your RA" reality in the projection, without the tool trying to model early-access mechanics.

## What's *not* modelled

- **Tax on contributions.** The user enters the monthly contribution as-paid (whatever actually goes into the fund). Section 10C deductions, PAYE adjustments, and pension-fund contribution deductibility are not modelled — the methodology note states this.
- **Tax on investment income.** Ignored for the accumulation phase.
- **Platform fees, advice fees.** The user should adjust the expected return downward if they want to account for these.
- **Asset allocation.** One expected return, not a split between equity/bonds/cash/offshore.
- **Contribution breaks, career changes, salary drops.** The model assumes the current monthly contribution continues with annual escalation. Usefully wrong — provides a default trajectory to compare scenarios against.
- **Recurring capital events.** Only one-off events are modelled in v1.
- **Regulatory caps on retirement contributions** (27.5% of remuneration, R350k cap). The user is responsible for entering realistic numbers.
- **Post-retirement modelling.** The calculator stops at retirement age. The drawdown calculator takes over from there.
