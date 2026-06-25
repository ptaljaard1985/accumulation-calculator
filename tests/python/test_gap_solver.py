"""
Audit for the "closing the gap" solver and the contribution-leverage readout.

The calculator turns the income goal into action: it states how much extra
contribution, or how many extra years, would hit the goal, and what each extra
R1 000/month buys. These features rest on one property: projected monthly income
is AFFINE in the total monthly contribution (I(c) = I0 + k*c). This module
re-implements the solver from scratch on top of the Python port of project() and
checks both the property and the solved figures.
"""

import math

from conftest import project, approx, base_inputs


# ---- from-scratch reimplementation of the JS solver helpers ----

def total_contribs(inp):
    return (inp['contribRetA'] + inp['contribRetB'] +
            inp['contribDiscA'] + inp['contribDiscB'])


def bump_contribs(inp, delta_total):
    """Raise total monthly contribution by delta_total, preserving the split."""
    out = dict(inp)
    T = total_contribs(inp)
    if T > 0:
        f = (T + delta_total) / T
        out['contribRetA'] = inp['contribRetA'] * f
        out['contribRetB'] = inp['contribRetB'] * f
        out['contribDiscA'] = inp['contribDiscA'] * f
        out['contribDiscB'] = inp['contribDiscB'] * f
    else:
        each = delta_total / 4
        out['contribRetA'] = each
        out['contribRetB'] = each
        out['contribDiscA'] = each
        out['contribDiscB'] = each
    return out


def marginal_income_per_1000(inp):
    i0 = project(inp)['monthlyIncomeReal']
    i1 = project(bump_contribs(inp, 1000))['monthlyIncomeReal']
    return i1 - i0


def solve_gap_routes(inp):
    goal = inp.get('incomeGoal', 0) or 0
    if not (goal > 0):
        return None
    p0 = project(inp)
    if not (p0['years'] >= 1):
        return None
    i0 = p0['monthlyIncomeReal']
    if i0 >= goal:
        return None
    shortfall = goal - i0

    k = marginal_income_per_1000(inp) / 1000.0
    contrib = None
    contrib_reachable = False
    if k > 1e-9:
        contrib = math.ceil((shortfall / k) / 100) * 100  # round up to R100
        contrib_reachable = True

    ret_age = ret_years = None
    ret_reachable = False
    for age in range(inp['retirementAge'] + 1, inp['retirementAge'] + 21):
        inc = project(dict(inp, retirementAge=age))['monthlyIncomeReal']
        if inc >= goal:
            ret_age = age
            ret_years = age - inp['retirementAge']
            ret_reachable = True
            break

    return dict(
        shortfall=shortfall,
        contribPerMonth=contrib, contribReachable=contrib_reachable,
        retAge=ret_age, retYears=ret_years, retReachable=ret_reachable,
    )


# ---- tests ----

def test_income_is_affine_in_contribution():
    """The slope of income vs contribution is constant (independent of step)."""
    inp = base_inputs(rNom=0.09, esc=0.05)
    i0 = project(inp)['monthlyIncomeReal']

    def slope(delta):
        return (project(bump_contribs(inp, delta))['monthlyIncomeReal'] - i0) / delta

    assert approx(slope(1_000), slope(50_000), 1e-4)


def test_marginal_income_matches_independent_runs():
    inp = base_inputs()
    k = marginal_income_per_1000(inp)
    i0 = project(inp)['monthlyIncomeReal']
    i1 = project(bump_contribs(inp, 1_000))['monthlyIncomeReal']
    assert approx(k, i1 - i0, 1e-6)
    assert k > 0


def test_solved_contribution_closes_goal():
    base = project(base_inputs())['monthlyIncomeReal']
    goal = base + 15_000
    inp = base_inputs(incomeGoal=goal)
    r = solve_gap_routes(inp)
    assert r is not None and r['contribReachable']

    hit = project(bump_contribs(inp, r['contribPerMonth']))['monthlyIncomeReal']
    assert hit >= goal - 0.5
    # One R100 step less must fall short (round-up correctness).
    miss = project(bump_contribs(inp, r['contribPerMonth'] - 100))['monthlyIncomeReal']
    assert miss < goal


def test_retire_later_route_is_first_clearing_age():
    base = project(base_inputs())['monthlyIncomeReal']
    goal = base + 8_000
    inp = base_inputs(incomeGoal=goal)
    r = solve_gap_routes(inp)
    assert r is not None and r['retReachable']

    first = None
    for age in range(inp['retirementAge'] + 1, inp['retirementAge'] + 21):
        if project(dict(inp, retirementAge=age))['monthlyIncomeReal'] >= goal:
            first = age
            break
    assert r['retAge'] == first
    assert r['retYears'] == first - inp['retirementAge']


def test_no_goal_or_goal_met_returns_none():
    # No incomeGoal key at all -> treated as 0 -> no routes.
    assert solve_gap_routes(base_inputs()) is None
    # Goal already comfortably met -> no gap to close.
    met = project(base_inputs())['monthlyIncomeReal']
    assert solve_gap_routes(base_inputs(incomeGoal=met - 5_000)) is None
