"""
Retirement age + anchor toggle:
  - Configurable retirement age (50-75)
  - Youngest anchor uses min(ageA, ageB) as reference
  - Oldest anchor uses max(ageA, ageB) as reference
  - Horizon must be at least 1 year
"""
from conftest import project, approx, base_inputs


class TestRetirementAgeFlexibility:
    def test_retirement_age_60_horizon_20_years(self):
        p = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            retirementAge=60,
        ))
        assert p['years'] == 20

    def test_retirement_age_65_horizon_25_years(self):
        p = project(base_inputs())
        assert p['years'] == 25

    def test_retirement_age_70_horizon_30_years(self):
        p = project(base_inputs(retirementAge=70))
        assert p['years'] == 30


class TestAnchorToggle:
    def test_youngest_anchor_uses_younger_spouse(self):
        # 38 + 42 → youngest is 38 → 65-38 = 27 years
        p = project(base_inputs(
            ageA=42, ageB=38,
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            anchor='youngest',
        ))
        assert p['years'] == 27

    def test_oldest_anchor_uses_older_spouse(self):
        # 38 + 42 → oldest is 42 → 65-42 = 23 years
        p = project(base_inputs(
            ageA=42, ageB=38,
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            anchor='oldest',
        ))
        assert p['years'] == 23

    def test_anchor_irrelevant_when_ages_equal(self):
        p_young = project(base_inputs(anchor='youngest'))
        p_old = project(base_inputs(anchor='oldest'))
        assert p_young['years'] == p_old['years']


class TestRetirementAgeOldestAnchor:
    def test_age_70_oldest_anchor_38_42(self):
        # Oldest is 42, retiring at 70 → 28-year horizon
        p = project(base_inputs(
            ageA=42, ageB=38,
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            anchor='oldest', retirementAge=70,
        ))
        assert p['years'] == 28


class TestMinimumHorizon:
    def test_age_64_retirement_65_produces_1_year(self):
        p = project(base_inputs(
            ageA=64, ageB=64,
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        assert p['years'] == 1

    def test_already_at_retirement_age_clamps_to_1_year(self):
        # Project clamps to minimum 1 year rather than producing a zero-length
        # array. The calculator UI prevents this, but the function handles it.
        p = project(base_inputs(
            ageA=65, ageB=65,
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        assert p['years'] == 1
