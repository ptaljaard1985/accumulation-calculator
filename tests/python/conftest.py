"""
Shared test fixtures and Python port of the calculator's core logic.

This module reimplements the accumulation projection in plain Python. Tests
in this directory compare its output against closed-form financial formulas
(FV, annuity FV, geometric series) — NOT against the JS directly.

The design principle is "second implementation as audit": if both the JS and
this Python port produce the same number, and that number matches a closed-form
result, we have high confidence the calculation is correct. If they disagree,
one of them has a bug.

JS-specific bugs (typos, closure issues) are caught by the Node-based test
suite in ../js/run.js, which exercises the actual shipped JS.
"""


def project(inputs):
    """
    Python port of the JS project() function in retirement_accumulation.html.
    Inputs is a dict matching the JS inputs shape:
        ageA, ageB, retA, retB, discA, discB,
        contribRetA, contribRetB, contribDiscA, contribDiscB,
        rNom, cpi, esc,
        anchor ('youngest' | 'oldest'),
        retirementAge (int),
        events (list of {age, amount, todaysMoney, kind})
    """
    ageA = inputs['ageA']
    ageB = inputs['ageB']
    youngest = min(ageA, ageB)
    oldest = max(ageA, ageB)
    ref = youngest if inputs['anchor'] == 'youngest' else oldest
    years = inputs['retirementAge'] - ref
    if years < 1:
        years = 1

    rNom = inputs['rNom']
    cpi = inputs['cpi']
    esc = inputs['esc']
    rMonth = (1 + rNom) ** (1/12) - 1

    retA = inputs['retA']; retB = inputs['retB']
    discA = inputs['discA']; discB = inputs['discB']
    cRetA = inputs['contribRetA']; cRetB = inputs['contribRetB']
    cDiscA = inputs['contribDiscA']; cDiscB = inputs['contribDiscB']

    # Starting-balance tracker: compounds at the nominal return with no
    # contributions. Used by the growth breakdown chart.
    start_balance_nom = retA + retB + discA + discB
    start_run = start_balance_nom

    # Pre-normalise events.
    events = inputs.get('events', [])
    norm_events = []
    for ev in events:
        yr_offset = ev['age'] - ref
        if yr_offset < 1 or yr_offset > years:
            continue
        if not (ev.get('amount', 0) > 0):
            continue
        norm_events.append(dict(ev, yrOffset=yr_offset))

    retNom = [retA + retB]
    discNom = [discA + discB]
    totalNom = [retA + retB + discA + discB]
    cumulContribs = [0]
    startSeriesNom = [start_balance_nom]

    cumul = 0
    for y in range(1, years + 1):
        year_contrib = 0
        for _ in range(12):
            retA = retA * (1 + rMonth) + cRetA
            retB = retB * (1 + rMonth) + cRetB
            discA = discA * (1 + rMonth) + cDiscA
            discB = discB * (1 + rMonth) + cDiscB
            start_run = start_run * (1 + rMonth)
            year_contrib += cRetA + cRetB + cDiscA + cDiscB
        cumul += year_contrib
        # Escalate for next year (start of each 12-month block)
        cRetA *= (1 + esc); cRetB *= (1 + esc)
        cDiscA *= (1 + esc); cDiscB *= (1 + esc)

        # Apply events at end of this year
        for ev in norm_events:
            if ev['yrOffset'] == y:
                if ev['todaysMoney']:
                    nominal_amt = ev['amount'] * ((1 + cpi) ** (y - 1))
                else:
                    nominal_amt = ev['amount']
                if ev['kind'] == 'inflow':
                    total = discA + discB
                    if total > 0:
                        wA = discA / total
                        discA += nominal_amt * wA
                        discB += nominal_amt * (1 - wA)
                    else:
                        discA += nominal_amt
                else:  # outflow
                    avail = discA + discB
                    remove = min(avail, nominal_amt)
                    if avail > 0:
                        wAo = discA / avail
                        discA -= remove * wAo
                        discB -= remove * (1 - wAo)

        retNom.append(retA + retB)
        discNom.append(discA + discB)
        totalNom.append(retA + retB + discA + discB)
        cumulContribs.append(cumul)
        startSeriesNom.append(start_run)

    # Deflate to real terms
    totalReal = [v / (1 + cpi) ** i for i, v in enumerate(totalNom)]
    cumulContribsReal = [v / (1 + cpi) ** i for i, v in enumerate(cumulContribs)]
    startSeriesReal = [v / (1 + cpi) ** i for i, v in enumerate(startSeriesNom)]

    # Growth breakdown: three components that sum to total every year.
    #   A. starting balance, compounded
    #   B. cumulative contributions (rand contributed, not grown)
    #   C. growth on contributions = total - A - B
    br_real = {
        'initial': list(startSeriesReal),
        'contribs': list(cumulContribsReal),
        'growth': [
            max(0, totalReal[i] - startSeriesReal[i] - cumulContribsReal[i])
            for i in range(len(totalReal))
        ]
    }
    br_nom = {
        'initial': list(startSeriesNom),
        'contribs': list(cumulContribs),
        'growth': [
            max(0, totalNom[i] - startSeriesNom[i] - cumulContribs[i])
            for i in range(len(totalNom))
        ]
    }

    return dict(
        years=years,
        totalNom=totalNom,
        totalReal=totalReal,
        retNom=retNom,
        discNom=discNom,
        cumulContribs=cumulContribs,
        cumulContribsReal=cumulContribsReal,
        startSeriesNom=startSeriesNom,
        startSeriesReal=startSeriesReal,
        br_real=br_real,
        br_nom=br_nom,
        finalTotalNom=totalNom[-1],
        finalTotalReal=totalReal[-1],
        monthlyIncomeReal=totalReal[-1] * 0.05 / 12,
        totalContribsOverHorizon=cumulContribs[-1],
    )


def approx(a, b, tol=1.0):
    """Float-safe equality within tolerance (rand amount)."""
    return abs(a - b) <= tol


def base_inputs(**overrides):
    """
    Shorthand scenario constructor. Returns sensible defaults that you can
    override per test. Mirrors the calculator's default 'Hayes family' case
    when called with no arguments.
    """
    defaults = dict(
        ageA=40, ageB=40,
        retA=1_500_000, retB=1_200_000,
        discA=500_000, discB=300_000,
        contribRetA=8_000, contribRetB=7_000,
        contribDiscA=3_000, contribDiscB=2_000,
        rNom=0.10, cpi=0.05, esc=0.06,
        anchor='youngest', retirementAge=65,
        events=[],
    )
    defaults.update(overrides)
    return defaults
