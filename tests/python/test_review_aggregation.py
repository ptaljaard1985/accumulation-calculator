"""
Audit for the CRM review-data -> planning-input aggregation.

The tool imports a CRM "sw-review-data" export (one investment account per row
with a suggested planning bucket) and, on the mapping screen, sums the confirmed
buckets per spouse into the eight planning inputs (hp-ret-A/B, hp-ret-contrib-A/B,
hp-disc-A/B, hp-disc-contrib-A/B).

This module reimplements that aggregation from scratch (second implementation as
audit) and checks it against the real Dean & Justine van der Westhuizen export,
plus the edge cases the 2-member David/Sarah sample never exercises:
child-owned accounts, joint 50/50 splits, null values, and solo clients.

The matching JS unit tests in ../js/run.js exercise the actual shipped functions
(resolveMemberSlots / defaultAccountDecisions / aggregateReviewData); if both
implementations agree on the same real-world numbers, the mapping is trustworthy.
"""

import json
from pathlib import Path

import pytest


def _find(name):
    """Locate a data file by name regardless of folder layout, so this suite works
    both here (under a "Meeting Report/" folder) and after the tool is moved into
    the CRM repo, where the fixture may sit flat. Walk up from this test and check
    each ancestor plus a few common data-folder names."""
    here = Path(__file__).resolve()
    subs = [".", "Meeting Report", "fixtures", "test-data", "data", "tests"]
    for anc in list(here.parents)[:5]:
        for s in subs:
            candidate = anc / s / name
            if candidate.exists():
                return candidate
    raise FileNotFoundError(
        f"could not locate {name} anywhere near {here}"
    )


REAL_FILE = _find("sample-household-review-data.json")


# --- Python port of the tool's pure aggregation helpers --------------------

def resolve_member_slots(members):
    """primary -> A, spouse -> B; anyone else -> 'other'. Solo: first member = A."""
    a = b = None
    for m in members:
        if a is None and m.get("role") == "primary":
            a = m
        elif b is None and m.get("role") == "spouse":
            b = m
    if a is None and members:
        a = members[0]
    slot_by_id = {}
    for m in members:
        slot_by_id[m["personId"]] = "A" if m is a else "B" if m is b else "other"
    return {"A": a, "B": b, "slotById": slot_by_id}


def normalize_bucket(b):
    return b if b in ("retirementAssets", "discretionaryAssets", "excluded") else "excluded"


def owner_slot(account, slots):
    if account.get("ownerPersonId") is None:
        return "joint"
    return slots["slotById"].get(account["ownerPersonId"], "other")


def default_decisions(accounts, slots):
    d = {}
    for a in accounts:
        os = owner_slot(a, slots)
        if os in ("A", "B"):
            d[a["accountId"]] = {"ownerSlot": os, "attributeTo": os,
                                 "bucket": normalize_bucket(a.get("suggestedBucket"))}
        elif os == "joint":
            d[a["accountId"]] = {"ownerSlot": os, "attributeTo": "split",
                                 "bucket": normalize_bucket(a.get("suggestedBucket"))}
        else:  # child / dependant / unknown
            d[a["accountId"]] = {"ownerSlot": os, "attributeTo": "A", "bucket": "excluded"}
    return d


def aggregate(accounts, decisions):
    t = {"A": {"ret": 0.0, "retC": 0.0, "disc": 0.0, "discC": 0.0},
         "B": {"ret": 0.0, "retC": 0.0, "disc": 0.0, "discC": 0.0}}
    included = excluded = 0.0
    for a in accounts:
        dec = decisions.get(a["accountId"], {})
        v = a.get("value") or 0
        c = a.get("monthlyContribution") or 0
        if dec.get("bucket") not in ("retirementAssets", "discretionaryAssets"):
            excluded += v
            continue
        included += v
        bk = "ret" if dec["bucket"] == "retirementAssets" else "disc"
        attr = dec.get("attributeTo", "A")
        if attr == "split":
            t["A"][bk] += v / 2; t["A"][bk + "C"] += c / 2
            t["B"][bk] += v / 2; t["B"][bk + "C"] += c / 2
        else:
            slot = "B" if attr == "B" else "A"
            t[slot][bk] += v; t[slot][bk + "C"] += c
    return {"A": t["A"], "B": t["B"], "includedTotal": included, "excludedTotal": excluded}


# --- Fixtures ---------------------------------------------------------------

@pytest.fixture
def real():
    return json.loads(REAL_FILE.read_text())


@pytest.fixture
def real_default(real):
    slots = resolve_member_slots(real["clientFamily"]["members"])
    dec = default_decisions(real["accounts"], slots)
    return real, slots, dec, aggregate(real["accounts"], dec)


# --- Tests against the real Dean/Justine file -------------------------------

def test_slots(real_default):
    _, slots, _, _ = real_default
    assert slots["A"]["firstName"] == "Alexander" and slots["A"]["role"] == "primary"
    assert slots["B"]["firstName"] == "Robin" and slots["B"]["role"] == "spouse"


def test_children_are_other_slot(real_default):
    _, slots, _, _ = real_default
    kids = [pid for pid, s in slots["slotById"].items() if s == "other"]
    assert len(kids) == 3  # Ella + Max + Noah


def test_children_default_excluded(real_default):
    real, slots, dec, _ = real_default
    child_accts = [a for a in real["accounts"]
                   if owner_slot(a, slots) == "other"]
    assert len(child_accts) == 6  # 3 children, 2 tax-free/discretionary accounts each
    for a in child_accts:
        assert dec[a["accountId"]]["bucket"] == "excluded"


def test_real_golden_numbers(real_default):
    _, _, _, t = real_default
    assert round(t["A"]["ret"], 2) == 2840000.00
    assert round(t["A"]["retC"], 2) == 10500.00
    assert round(t["A"]["disc"], 2) == 209000.00
    assert round(t["A"]["discC"], 2) == 3000.00
    assert round(t["B"]["ret"], 2) == 925000.00
    assert round(t["B"]["retC"], 2) == 15800.00
    assert round(t["B"]["disc"], 2) == 260000.00
    assert round(t["B"]["discC"], 2) == 3000.00


def test_child_assets_excluded_total(real_default):
    _, _, _, t = real_default
    # The three children's excluded tax-free/discretionary accounts.
    assert round(t["excludedTotal"], 2) == 201000.00


def test_included_plus_excluded_equals_all_account_value(real_default):
    real, _, _, t = real_default
    total = sum(a["value"] or 0 for a in real["accounts"])
    assert round(t["includedTotal"] + t["excludedTotal"], 2) == round(total, 2)
    assert round(total, 2) == 4435000.00


def test_suggested_buckets_follow_type_rule(real):
    # Retirement (incl. held-away) -> retirementAssets; Tax-Free / Discretionary
    # -> discretionaryAssets.
    rule = {"Retirement": "retirementAssets",
            "Retirement (held-away)": "retirementAssets",
            "Tax-Free": "discretionaryAssets",
            "Discretionary": "discretionaryAssets"}
    for a in real["accounts"]:
        assert a["suggestedBucket"] == rule[a["type"]], a["accountName"]


def test_percentages_are_decimals(real):
    for a in real["accounts"]:
        for k in ("growthAssetsPercent", "offshoreAssetsPercent"):
            if a.get(k) is not None:
                assert 0.0 <= a[k] <= 1.0, (a["accountName"], k, a[k])


# --- Edge cases the sample never exercises ---------------------------------

def test_child_override_to_A_lands_on_A():
    """If the advisor includes a child account and attributes it to A, it lands on A."""
    members = [
        {"personId": "p", "role": "primary", "firstName": "P", "age": 40},
        {"personId": "s", "role": "spouse", "firstName": "S", "age": 40},
        {"personId": "k", "role": "child", "firstName": "K", "age": 10},
    ]
    accts = [{"accountId": "k1", "ownerPersonId": "k", "value": 100000,
              "monthlyContribution": 500, "suggestedBucket": "discretionaryAssets"}]
    slots = resolve_member_slots(members)
    dec = default_decisions(accts, slots)
    assert dec["k1"]["bucket"] == "excluded"          # default Ignore
    # Advisor overrides: include as discretionary, attribute to A.
    dec["k1"]["bucket"] = "discretionaryAssets"
    dec["k1"]["attributeTo"] = "A"
    t = aggregate(accts, dec)
    assert t["A"]["disc"] == 100000 and t["A"]["discC"] == 500
    assert t["B"]["disc"] == 0


def test_joint_account_splits_50_50():
    members = [
        {"personId": "p", "role": "primary", "firstName": "P", "age": 40},
        {"personId": "s", "role": "spouse", "firstName": "S", "age": 40},
    ]
    accts = [{"accountId": "j1", "ownerPersonId": None, "value": 200000,
              "monthlyContribution": 1000, "suggestedBucket": "retirementAssets"}]
    slots = resolve_member_slots(members)
    dec = default_decisions(accts, slots)
    assert dec["j1"]["attributeTo"] == "split"
    t = aggregate(accts, dec)
    assert t["A"]["ret"] == 100000 and t["B"]["ret"] == 100000
    assert t["A"]["retC"] == 500 and t["B"]["retC"] == 500


def test_null_value_counts_as_zero():
    members = [{"personId": "p", "role": "primary", "firstName": "P", "age": 40}]
    accts = [{"accountId": "h1", "ownerPersonId": "p", "value": None,
              "monthlyContribution": 0, "suggestedBucket": "retirementAssets"}]
    slots = resolve_member_slots(members)
    dec = default_decisions(accts, slots)
    t = aggregate(accts, dec)
    assert t["A"]["ret"] == 0


def test_solo_client_maps_everything_to_A():
    members = [{"personId": "p", "role": "primary", "firstName": "P", "age": 55}]
    accts = [
        {"accountId": "r", "ownerPersonId": "p", "value": 1000000,
         "monthlyContribution": 5000, "suggestedBucket": "retirementAssets"},
        {"accountId": "d", "ownerPersonId": "p", "value": 500000,
         "monthlyContribution": 2000, "suggestedBucket": "discretionaryAssets"},
    ]
    slots = resolve_member_slots(members)
    assert slots["B"] is None
    dec = default_decisions(accts, slots)
    t = aggregate(accts, dec)
    assert t["A"]["ret"] == 1000000 and t["A"]["disc"] == 500000
    assert t["B"]["ret"] == 0 and t["B"]["disc"] == 0


def test_unknown_suggested_bucket_defaults_excluded():
    assert normalize_bucket(None) == "excluded"
    assert normalize_bucket("needsReview") == "excluded"
    assert normalize_bucket("retirementAssets") == "retirementAssets"
