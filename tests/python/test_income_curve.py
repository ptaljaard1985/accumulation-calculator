"""
Audits for the income-by-retirement-age curve (State 2 "Income" chart).

The chart plots the starting monthly retirement income (today's money) the
household would draw at each possible retirement age. The JS derives the whole
curve from ONE extended projection run to (retirementAge + 10), reading
real.total[i] * 0.05 / 12 at each position.

The correctness claim that makes that single-run shortcut valid:

    income via the extended run, read at the position for age X
      ==
    income via a dedicated projection that retires exactly at age X

These tests verify that claim (positions are independent of horizon length),
plus the headline-consistency property (the marker value equals the configured
retirement age's monthly income) and a closed-form cross-check.
"""

from conftest import project, approx, base_inputs, swr_for_age


def ref_age(inputs):
    youngest = min(inputs['ageA'], inputs['ageB'])
    oldest = max(inputs['ageA'], inputs['ageB'])
    return youngest if inputs['anchor'] == 'youngest' else oldest


def income_curve(inputs):
    """Python port of incomeCurveData(): one extended run, income per age.

    Each candidate age uses its OWN safe withdrawal rate.
    """
    ra = ref_age(inputs)
    ext = dict(inputs, retirementAge=inputs['retirementAge'] + 10)
    pe = project(ext)
    ages = [ra + i for i in range(len(pe['totalReal']))]
    income = [t * swr_for_age(ages[i]) / 12 for i, t in enumerate(pe['totalReal'])]
    marker_index = max(0, inputs['retirementAge'] - ra)
    return dict(ages=ages, income=income, markerIndex=marker_index)


def test_extended_run_matches_dedicated_per_age_projection():
    # For several candidate retirement ages, the income read off the single
    # extended run must equal the income from a projection that retires exactly
    # at that age. This is what lets the chart use one run instead of N.
    inputs = base_inputs(events=[])
    ra = ref_age(inputs)
    curve = income_curve(inputs)
    for age in (48, 52, 60, 65, 72):
        # A dedicated projection that retires exactly at `age` applies the SWR
        # for that age internally, so its monthlyIncomeReal is the per-age
        # income; it must equal the value the single extended run reads off.
        dedicated = project(dict(inputs, retirementAge=age))
        from_curve = curve['income'][age - ra]
        assert approx(dedicated['monthlyIncomeReal'], from_curve, 1.0), (
            f'age {age}: dedicated={dedicated["monthlyIncomeReal"]} curve={from_curve}'
        )


def test_marker_value_equals_headline_income():
    # The vertical marker sits at the configured retirement age; the value there
    # must equal the base projection's monthlyIncomeReal (the outcome-strip
    # headline), so chart and headline never disagree.
    inputs = base_inputs(retirementAge=65, events=[])
    base = project(inputs)
    curve = income_curve(inputs)
    assert approx(curve['income'][curve['markerIndex']],
                  base['monthlyIncomeReal'], 1.0)


def test_marker_consistency_with_events_beyond_retirement():
    # An inflow AFTER the planned retirement age must not change the income at
    # the marker (you would not have it yet if you retired on plan), but must
    # lift the income at a later candidate age.
    ra = 40
    events = [{'age': 68, 'amount': 1_000_000, 'todaysMoney': True, 'kind': 'inflow'}]
    inputs = base_inputs(ageA=ra, ageB=ra, retirementAge=65, events=events)
    base = project(inputs)  # base horizon stops at 65, event is out of horizon
    curve = income_curve(inputs)
    # At the marker (age 65) the curve matches the on-plan headline.
    assert approx(curve['income'][curve['markerIndex']],
                  base['monthlyIncomeReal'], 1.0)
    # At age 70 (after the inflow) income is strictly higher than at age 65.
    assert curve['income'][70 - ra] > curve['income'][65 - ra]


def test_swr_table_and_clamps():
    # Spot-check tabulated values.
    assert swr_for_age(55) == 0.042
    assert swr_for_age(65) == 0.048
    assert swr_for_age(80) == 0.075
    assert swr_for_age(100) == 0.25
    # Below 55: 0.1pp per year under 55, floored at 3.5%.
    assert approx(swr_for_age(54) * 100, 4.1, 1e-9)
    assert approx(swr_for_age(50) * 100, 3.7, 1e-9)
    assert swr_for_age(48) == 0.035   # 4.2 - 0.7 = 3.5 exactly at the floor
    assert swr_for_age(40) == 0.035   # held at the 3.5% floor
    # Above 100: held at the age-100 rate.
    assert swr_for_age(110) == 0.25


def test_closed_form_no_contrib_single_balance():
    # Strip to one balance, no contributions, no events: capital at age X in
    # today's money is balance * ((1+rNom)/(1+cpi))**(X-refAge), so income is
    # that * 0.05/12. Cross-check the curve against this closed form.
    ra = 50
    bal = 4_000_000
    rNom, cpi = 0.09, 0.05
    inputs = base_inputs(
        ageA=ra, ageB=ra, retirementAge=60,
        retA=bal, retB=0, discA=0, discB=0,
        contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        rNom=rNom, cpi=cpi, esc=0, events=[],
    )
    curve = income_curve(inputs)
    for age in (55, 60, 66):
        n = age - ra
        cap = bal * ((1 + rNom) / (1 + cpi)) ** n
        expected = cap * swr_for_age(age) / 12
        assert approx(curve['income'][n], expected, 1.0), (
            f'age {age}: curve={curve["income"][n]} closed-form={expected}'
        )
