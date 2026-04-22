"""
Capital events:
  - Inflows add to discretionary proportionally to existing balance
  - Outflows remove from discretionary, capped at available balance
  - Today's-money events are inflated by CPI at application year
  - Nominal-flagged events are applied at face value
  - Events outside the projection horizon are ignored
  - Inflow and outflow at the same age cancel to the cent
  - Retirement fund is never touched by events (only discretionary)
"""
from conftest import project, approx, base_inputs


class TestInflow:
    def test_inflow_increases_final_nominal_by_correct_grown_amount(self):
        no_event = project(base_inputs(
            retA=1_000_000, retB=0, discA=500_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        with_event = project(base_inputs(
            retA=1_000_000, retB=0, discA=500_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            events=[dict(age=50, amount=1_000_000, todaysMoney=True, kind='inflow')],
        ))
        # R1m today at CPI=5% → R1m × 1.05^9 at year 10 application
        # Then grows 15 more years at 10% nominal
        nominal_at_arrival = 1_000_000 * (1.05 ** 9)
        grown_15_years = nominal_at_arrival * (1.10 ** 15)
        diff = with_event['finalTotalNom'] - no_event['finalTotalNom']
        assert approx(diff, grown_15_years, 1.0)

    def test_inflow_only_affects_discretionary_not_retirement(self):
        p = project(base_inputs(
            retA=1_000_000, retB=0, discA=0, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            events=[dict(age=50, amount=5_000_000, todaysMoney=False, kind='inflow')],
        ))
        # Retirement pot grows from 1m → 1m × 1.10^25 with no interference
        expected_ret = 1_000_000 * (1.10 ** 25)
        assert approx(p['retNom'][-1], expected_ret, 1.0)


class TestOutflow:
    def test_outflow_reduces_final_by_lost_capital_plus_forgone_growth(self):
        no_event = project(base_inputs(
            retA=0, retB=0, discA=5_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
        ))
        with_event = project(base_inputs(
            retA=0, retB=0, discA=5_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            events=[dict(age=50, amount=1_000_000, todaysMoney=True, kind='outflow')],
        ))
        nominal_at_event = 1_000_000 * (1.05 ** 9)
        forgone = nominal_at_event * (1.10 ** 15)
        diff = no_event['finalTotalNom'] - with_event['finalTotalNom']
        assert approx(diff, forgone, 1.0)

    def test_outflow_capped_at_available_discretionary(self):
        # R10m outflow against R100k disc → only R100k-ish can be removed.
        # Retirement fund is NOT touched.
        p = project(base_inputs(
            retA=5_000_000, retB=0, discA=100_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            events=[dict(age=45, amount=10_000_000, todaysMoney=True, kind='outflow')],
        ))
        # Retirement alone: 5m × 1.10^25
        expected_if_untouched = 5_000_000 * (1.10 ** 25)
        assert approx(p['finalTotalNom'], expected_if_untouched, 50.0)

    def test_outflow_leaves_discretionary_at_zero_if_exceeded(self):
        p = project(base_inputs(
            retA=0, retB=0, discA=500_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            events=[dict(age=45, amount=10_000_000, todaysMoney=False, kind='outflow')],
        ))
        # At year 5 (age 45), disc has grown to 500k × 1.10^5 = 805k
        # Outflow removes all of it
        # From year 5 to 25, disc is zero and stays zero
        # Final nominal = 0
        assert approx(p['finalTotalNom'], 0, 1.0)


class TestCurrencyMode:
    def test_todays_money_event_is_inflated_by_cpi(self):
        baseline = 1_000_000 * (1.10 ** 25)
        pv_only = project(base_inputs(
            retA=0, retB=0, discA=1_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
            events=[dict(age=50, amount=1_000_000, todaysMoney=True, kind='inflow')],
        ))
        fv_only = project(base_inputs(
            retA=0, retB=0, discA=1_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
            events=[dict(age=50, amount=1_000_000, todaysMoney=False, kind='inflow')],
        ))
        # PV event is inflated by 1.05^9 (applied at year 10, which is 9 CPI periods after year 1)
        added_pv = pv_only['finalTotalNom'] - baseline
        added_fv = fv_only['finalTotalNom'] - baseline
        ratio = added_pv / added_fv
        assert approx(ratio, 1.05 ** 9, 0.001)


class TestHorizon:
    def test_event_past_horizon_is_ignored(self):
        no_event = project(base_inputs())
        past_horizon = project(base_inputs(
            events=[dict(age=80, amount=10_000_000, todaysMoney=True, kind='inflow')]
        ))
        assert approx(no_event['finalTotalNom'], past_horizon['finalTotalNom'], 0.5)

    def test_event_before_horizon_start_is_ignored(self):
        no_event = project(base_inputs())
        before_start = project(base_inputs(
            events=[dict(age=35, amount=10_000_000, todaysMoney=True, kind='inflow')]
        ))
        # age 35 < youngest spouse age 40 → yrOffset < 1 → filtered out
        assert approx(no_event['finalTotalNom'], before_start['finalTotalNom'], 0.5)


class TestCancellation:
    def test_inflow_and_outflow_at_same_age_cancel(self):
        no_events = project(base_inputs(
            retA=0, retB=0, discA=5_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
        ))
        both = project(base_inputs(
            retA=0, retB=0, discA=5_000_000, discB=0,
            contribRetA=0, contribRetB=0, contribDiscA=0, contribDiscB=0,
            esc=0.0,
            events=[
                dict(age=50, amount=1_000_000, todaysMoney=False, kind='inflow'),
                dict(age=50, amount=1_000_000, todaysMoney=False, kind='outflow'),
            ],
        ))
        assert approx(no_events['finalTotalNom'], both['finalTotalNom'], 2.0)


class TestMultipleEvents:
    def test_multiple_independent_events_compose(self):
        p_single_a = project(base_inputs(
            events=[dict(age=50, amount=1_000_000, todaysMoney=False, kind='inflow')]
        ))
        p_single_b = project(base_inputs(
            events=[dict(age=55, amount=500_000, todaysMoney=False, kind='inflow')]
        ))
        p_both = project(base_inputs(
            events=[
                dict(age=50, amount=1_000_000, todaysMoney=False, kind='inflow'),
                dict(age=55, amount=500_000, todaysMoney=False, kind='inflow'),
            ]
        ))
        p_none = project(base_inputs())
        # Effects are additive to within float tolerance
        a_effect = p_single_a['finalTotalNom'] - p_none['finalTotalNom']
        b_effect = p_single_b['finalTotalNom'] - p_none['finalTotalNom']
        both_effect = p_both['finalTotalNom'] - p_none['finalTotalNom']
        assert approx(both_effect, a_effect + b_effect, 2.0)


class TestEmptyEventsUnchanged:
    def test_empty_events_list_matches_baseline(self):
        p0 = project(base_inputs(events=[]))
        p1 = project(base_inputs())
        assert approx(p0['finalTotalNom'], p1['finalTotalNom'], 0.001)
        assert approx(p0['finalTotalReal'], p1['finalTotalReal'], 0.001)
