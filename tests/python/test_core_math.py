"""
Core projection mechanics:
  - Monthly compounding matches the standard FV formula exactly
  - Contributions match the ordinary annuity FV formula
  - Escalation happens at the start of each 12-month block
  - CPI deflation is exact
  - Growth breakdown sums to total every year
  - Income calc is exactly final_real × 5% / 12
"""
from conftest import project, approx, base_inputs


class TestNoContribCompoundGrowth:
    """No contributions: pure compound growth on starting balance."""

    def test_matches_fv_formula_25_years(self):
        p = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        assert p['years'] == 25
        # Monthly compounding: (1 + r_month)^12 = 1.10 exactly, so 25y FV = 1m × 1.10^25
        expected = 1_000_000 * (1.10 ** 25)
        assert approx(p['finalTotalNom'], expected, 0.5)


class TestFlatContributionAnnuity:
    """Flat monthly contribution, no escalation, no starting balance."""

    def test_matches_ordinary_annuity_fv(self):
        p = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
        ))
        r_month = (1.10) ** (1/12) - 1
        n = 12 * 25
        # Ordinary annuity (end-of-period): FV = PMT × ((1+r)^n - 1) / r
        expected = 10_000 * (((1 + r_month) ** n - 1) / r_month)
        assert approx(p['finalTotalNom'], expected, 2.0)

    def test_cumulative_contributions_are_pmt_times_n(self):
        p = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
        ))
        assert approx(p['totalContribsOverHorizon'], 10_000 * 12 * 25, 0.01)


class TestContributionEscalation:
    """Escalation applies once per year, at the start of each 12-month block."""

    def test_year_1_uses_base_amount(self):
        # With zero return, year 1 = 12 × PMT exactly
        p = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
            rNom=0.0, cpi=0.0, esc=0.06,
        ))
        assert approx(p['cumulContribs'][1], 120_000, 0.01)

    def test_year_2_uses_escalated_amount(self):
        p = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
            rNom=0.0, cpi=0.0, esc=0.06,
        ))
        # Y1: 120 000, Y2 adds 12 × 10 600 = 127 200 → cumul Y2 = 247 200
        assert approx(p['cumulContribs'][2], 247_200, 0.01)

    def test_cumulative_matches_geometric_sum(self):
        p = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
            rNom=0.0, cpi=0.0, esc=0.06,
        ))
        # Σ_{y=0}^{24} PMT × 12 × 1.06^y
        expected = sum(10_000 * 12 * (1.06 ** y) for y in range(25))
        assert approx(p['totalContribsOverHorizon'], expected, 1.0)


class TestCPIDeflation:
    def test_final_real_equals_nominal_divided_by_1_plus_cpi_power_years(self):
        p = project(base_inputs())
        expected = p['finalTotalNom'] / (1.05 ** 25)
        assert approx(p['finalTotalReal'], expected, 0.01)

    def test_position_zero_real_equals_nominal(self):
        # At t=0 there is no deflation
        p = project(base_inputs())
        assert approx(p['totalReal'][0], p['totalNom'][0], 0.001)


class TestStartingBalanceCompounds:
    """The starting-balance series in the breakdown must compound at the
    nominal return with no contributions applied to it."""

    def test_nominal_matches_pure_fv(self):
        p = project(base_inputs(
            retA=2_000_000, retB=0, discA=1_500_000, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=5_000, contribDiscB=0,
        ))
        expected = 3_500_000 * (1.10 ** 25)
        assert approx(p['startSeriesNom'][25], expected, 0.5)

    def test_real_matches_real_rate_compounding(self):
        p = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
        ))
        # Real = nominal / (1+cpi)^n = 1m × 1.10^25 / 1.05^25
        expected = 1_000_000 * (1.10 ** 25) / (1.05 ** 25)
        assert approx(p['startSeriesReal'][25], expected, 1.0)


class TestBreakdownDecomposition:
    """The three components (starting-compounded, contribs, growth) must sum
    exactly to the total every year, in both real and nominal views."""

    def test_real_sums_to_total_every_year(self):
        p = project(base_inputs())
        for i in range(len(p['totalReal'])):
            s = (p['br_real']['initial'][i]
                 + p['br_real']['contribs'][i]
                 + p['br_real']['growth'][i])
            assert approx(s, p['totalReal'][i], 1.0)

    def test_nominal_sums_to_total_every_year(self):
        p = project(base_inputs())
        for i in range(len(p['totalNom'])):
            s = (p['br_nom']['initial'][i]
                 + p['br_nom']['contribs'][i]
                 + p['br_nom']['growth'][i])
            assert approx(s, p['totalNom'][i], 1.0)

    def test_growth_component_is_positive_for_positive_returns(self):
        p = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        # Growth on contributions at 25y should be substantial
        assert p['br_real']['growth'][-1] > 500_000


class TestIncomeCalculation:
    def test_monthly_income_is_exactly_5pct_div_12(self):
        p = project(base_inputs())
        expected = p['finalTotalReal'] * 0.05 / 12
        assert approx(p['monthlyIncomeReal'], expected, 0.0001)


class TestLinearity:
    """Doubling a contribution stream adds exactly one contribution-only FV."""

    def test_doubling_contribution_is_linear(self):
        p1 = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=5_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        p2 = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=10_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        # Contribution-only FV at 5k/mo
        contrib_only = project(base_inputs(
            retA=0, retB=0, discA=0, discB=0,
            contribRetA=5_000, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        expected_diff = contrib_only['finalTotalNom']
        assert approx(p2['finalTotalNom'] - p1['finalTotalNom'], expected_diff, 1.0)


class TestDefaultScenario:
    """Canonical Hayes-family scenario. If these numbers change, something
    material has changed — investigate before updating the expected values."""

    def test_final_real(self):
        p = project(base_inputs())
        assert approx(p['finalTotalReal'], 23_313_210, 200)

    def test_monthly_income(self):
        p = project(base_inputs())
        assert approx(p['monthlyIncomeReal'], 97_138, 5)
