"""
Independent check of the loan data store and ranking (commit eb235c7).

Imports nothing from src. Derives payment, total paid, total cost, real APR, fit, order and
verdict from data/store/snapshot.json alone, using exact fractions for money, then compares
with what recommend() returned (scripts/check/store_dump.ts).

Run from the project root:
    npx tsx scripts/check/store_dump.ts > OUT.json
    python -X utf8 scripts/check/store_check.py OUT.json

Tolerances: 1 VND for amounts, 0.01 percentage points for rates.
"""
import glob
import json
import re
import sys
import unicodedata
from datetime import date
from fractions import Fraction as F
from functools import lru_cache
from math import floor

TODAY = date(2026, 11, 5)
STALE_DAYS = 90
CAP = 100_000_000  # src/config/regulatory.ts value, retyped: Circular 43/2016 art. 3(1)

snapshot = json.load(open("data/store/snapshot.json", encoding="utf-8"))
OFFERS = snapshot["offers"]
BY_KEY = {o["key"]: o for o in OFFERS}


# ---------- money and schedules, from first principles ----------

def rnd(x):
    """Nearest dong, half away from zero (DECISIONS #22)."""
    x = F(x)
    return floor(x + F(1, 2)) if x >= 0 else -floor(-x + F(1, 2))


def monthly_i(percent, period):
    return F(str(percent)) / 100 / (1 if period == "monthly" else 12)


def schedule(P, i, n, method):
    """Returns [(payment, opening balance)]. Last instalment absorbs the remainder."""
    rows = []
    bal = P
    if method == "flat":
        even = P // n
        flat_int = rnd(P * i)
        last_int = rnd(P * i * n) - flat_int * (n - 1)
        for m in range(1, n + 1):
            pr = bal if m == n else even
            it = last_int if m == n else flat_int
            rows.append((pr + it, bal))
            bal -= pr
        return rows
    if method == "annuity":
        level = rnd(F(P, n)) if i == 0 else rnd(P * i / (1 - (1 + i) ** (-n)))
    for m in range(1, n + 1):
        it = rnd(bal * i)
        if m == n:
            pr = bal
        elif method == "annuity":
            pr = min(bal, max(0, level - it))
        else:
            pr = P // n
        rows.append((pr + it, bal))
        bal -= pr
    assert bal == 0
    return rows


def irr(net, payments):
    """Monthly r with net = sum(p / (1+r)^t). Bisection, so it can't wander off to another root."""
    def npv(r):
        d, s = 1.0, 0.0
        for p in payments:
            d /= 1 + r
            s += p * d
        return s - net

    lo, hi = -0.5, 5.0
    assert npv(lo) > 0 > npv(hi)
    for _ in range(120):
        mid = (lo + hi) / 2
        if npv(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def method_of(o):
    r = o["rate"]
    if r["basis"] == "flat":
        return "flat"
    return o["amortization"] or "annuity"


def premium(ins, o, amount, n, end_percent, end):
    """Premium at one end ('low'/'high') of its range, or None if it can't be computed."""
    lo, hi = ins["ratePercentMin"], ins["ratePercentMax"]
    hi = lo if hi is None else hi
    pct = lo if end == "low" else hi
    m = ins["method"]
    if m == "fixed":
        return ins["fixedVnd"]
    if pct is None:
        return None
    pct = F(str(pct))
    if m == "percent_of_principal":
        return rnd(amount * pct / 100)
    if m == "annual_rate_on_insured_amount":
        tiers = ins["insuredTiers"]
        if not tiers:
            return None
        t = next(t for t in tiers if t["termMonthsMax"] is None or n <= t["termMonthsMax"])
        return rnd(amount * F(str(t["multiplier"])) * pct / 100 * n / 12)
    if m == "annual_rate_on_declining_balance":
        r = o["rate"]
        rows = schedule(amount, monthly_i(end_percent, r["period"]), n, method_of(o))
        return rnd(sum(b for _, b in rows) * pct / 100 / 12)
    return None


def charges_at(o, amount, n, end, end_percent):
    out = []
    for ins in o["insurance"]:
        if ins["mandatory"] is not True:
            continue
        p = premium(ins, o, amount, n, end_percent, end)
        if p is None:
            continue
        c = ins["collection"]
        if c == "monthly":
            # Spread over the term, rounded up to whole VND.
            out.append((-(-p // n), "monthly"))
        else:
            out.append((p, c if c in ("added_to_loan", "paid_upfront") else "deducted_from_payout"))
    return out


def cost(o, amount, n, percent, charges):
    r = o["rate"]
    deducted = sum(a for a, t in charges if t == "deducted_from_payout")
    financed = sum(a for a, t in charges if t == "added_to_loan")
    upfront = sum(a for a, t in charges if t == "paid_upfront")
    monthly = sum(f["amountVnd"] for f in o["monthlyFees"]) + sum(a for a, t in charges if t == "monthly")
    P = amount + financed
    rows = schedule(P, monthly_i(percent, r["period"]), n, method_of(o))
    pays = [p + monthly for p, _ in rows]
    received = amount - deducted
    total_paid = sum(pays) + upfront
    m_irr = irr(received - upfront, pays)
    return {
        "received": received,
        "upfront": upfront,
        "financed": P,
        "first": pays[0],
        "last": pays[-1],
        "max": max(pays),
        "totalPaid": total_paid,
        "totalCost": total_paid - received,
        "irr": m_irr,
        "apr": m_irr * 12,
        "effective": (1 + m_irr) ** 12 - 1,
    }


@lru_cache(maxsize=None)
def both_ends(key, amount, n):
    o = BY_KEY[key]
    r = o["rate"]
    hi_pct = r["maxPercent"]
    high = cost(o, amount, n, hi_pct, charges_at(o, amount, n, "high", hi_pct))
    if r.get("minIsPromotional") or r.get("minUnconfirmed"):
        return high, high, hi_pct
    lo_pct = r["minPercent"]
    for t in r.get("minByTerm") or []:
        if n >= t["termMonthsMin"]:
            lo_pct = t["percent"]
            break
    return cost(o, amount, n, lo_pct, charges_at(o, amount, n, "low", lo_pct)), high, lo_pct


# ---------- filter, fit, order, verdict, from the written rules ----------

def fits_purpose(goods, purpose):
    if goods is None:
        return True
    if goods == "other_goods":
        return purpose == "goods"
    if goods == "any_goods":
        return purpose in ("goods", "phone", "motorbike")
    return goods == purpose


def problems(o, need):
    out = []
    a, t, age, inc = need["amountVnd"], need["termMonths"], need["age"], need["monthlyIncomeVnd"]
    if o["amountMinVnd"] is not None and a < o["amountMinVnd"]:
        out.append("amount_too_low")
    if o["category"] == "finance_company" and a > CAP:
        out.append("over_finance_company_cap")
    elif o["amountMaxVnd"] is not None and a > o["amountMaxVnd"]:
        out.append("amount_too_high")
    if o["termMinMonths"] is not None and t < o["termMinMonths"]:
        out.append("term_too_short")
    if o["termMaxMonths"] is not None and t > o["termMaxMonths"]:
        out.append("term_too_long")
    if o["minAge"] is not None and age < o["minAge"]:
        out.append("too_young")
    if o["maxAge"] is not None:
        at = age + F(t, 12) if o["maxAgeAtLoanEnd"] else age
        if at > o["maxAge"]:
            out.append("too_old")
    if o["minMonthlyIncomeVnd"] is not None and inc < o["minMonthlyIncomeVnd"]:
        out.append("income_too_low")
    return out


INCOME_DOC = re.compile(r"thu nhập|lương", re.I)
FIT_RANK = {"fits": 0, "fits_only_low": 1, "too_much": 2}


def barrier(o, need):
    docs = o["documents"] or []
    return need["incomeProof"] in ("none", "cash_salary") and any(INCOME_DOC.search(unicodedata.normalize("NFC", d)) for d in docs)


def derive(need, offers=None):
    a, n, inc, debt = need["amountVnd"], need["termMonths"], need["monthlyIncomeVnd"], need["existingDebtVnd"]
    limit = inc * 2 // 5  # exact 40%, floored
    room = max(0, limit - debt)
    ranked, inel, insuff = [], {}, []
    for o in (OFFERS if offers is None else offers):
        if not fits_purpose(o["goods"], need["purpose"]):
            continue
        stale = (TODAY - date.fromisoformat(o["oldestRetrievedAt"])).days > STALE_DAYS
        if o["excludeFromRanking"] or o["rate"] is None or stale:
            insuff.append(o["key"])
            continue
        p = problems(o, need)
        if p:
            inel[o["key"]] = p
            continue
        low, high, lo_pct = both_ends(o["key"], a, n)
        r = o["rate"]
        ok = lambda pay: debt + pay <= limit
        fit = "fits" if ok(high["max"]) and not r.get("floorOnly") else "fits_only_low" if ok(low["max"]) else "too_much"
        ranked.append({
            "key": o["key"], "fit": fit, "low": low, "high": high, "lo_pct": lo_pct,
            "barrier": barrier(o, need), "floor": bool(r.get("floorOnly")),
            "official": r["sourceType"] == "official", "feesUnknown": o["feesCompleteness"] == "unknown",
        })
    ranked.sort(key=lambda x: (FIT_RANK[x["fit"]], x["barrier"], x["floor"], x["high"]["apr"], x["low"]["apr"], not x["official"], x["key"]))
    if ranked and ranked[0]["feesUnknown"]:
        i = next((j for j, x in enumerate(ranked) if not x["feesUnknown"]), 0)
        if i > 0:
            ranked.insert(0, ranked.pop(i))

    def reliable(x):
        o = BY_KEY[x["key"]]
        r = o["rate"]
        return (x["official"] and not x["floor"] and not r.get("maxIsReference") and o["minAge"] is not None and o["maxAge"] is not None
                and not x["feesUnknown"] and o["existingCustomerRequired"] is not True and o["employerRestriction"] is None)

    principal_only = -(-a // n)
    official = [x for x in ranked if x["official"]]
    if inc <= 0:
        v = "no_income"
    elif debt + principal_only > limit:
        v = "too_much"
    elif not ranked:
        v = "no_data"
    elif all(x["fit"] == "too_much" for x in (official or ranked)):
        v = "too_much"
    elif any(x["fit"] == "fits" and reliable(x) for x in ranked):
        v = "ok"
    else:
        v = "depends"
    return {"verdict": v, "headroom": room, "principalOnly": principal_only, "ranked": ranked, "ineligible": inel, "insufficient": insuff, "reliable": [x["key"] for x in ranked if reliable(x)]}


def vnd(x):
    return f"{x:,}"


def pc(x):
    return f"{x * 100:.3f}"


FIELDS = ["received", "upfront", "first", "last", "max", "totalPaid", "totalCost"]


def compare_cost(mine, app):
    out = []
    for f in FIELDS:
        if abs(mine[f] - app[f]) > 1:
            out.append(f"{f}: mine {vnd(mine[f])} app {vnd(app[f])} diff {vnd(app[f] - mine[f])}")
    for f in ("apr", "effective"):
        if abs(mine[f] - app[f]) * 100 > 0.01:
            out.append(f"{f}: mine {pc(mine[f])} app {pc(app[f])}")
    return out


def optional_insurance(o, amount, n):
    """Insurance outside the headline cost: premium range and the cost at the top rate if taken."""
    out = []
    r = o["rate"]
    for ins in o["insurance"]:
        if ins["mandatory"] is True:
            continue
        lo = premium(ins, o, amount, n, r["minPercent"], "low")
        hi = premium(ins, o, amount, n, r["maxPercent"], "high")
        if lo is None or hi is None:
            continue
        c = ins["collection"]
        t = c if c in ("added_to_loan", "paid_upfront") else "deducted_from_payout"
        out.append({"name": ins["nameVi"], "min": lo, "max": hi, "costHigh": cost(o, amount, n, r["maxPercent"], [(hi, t)])})
    return out


def main():
    dump = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    cases = dump["cases"]

    # ----- 1. the main case, every ranked offer -----
    main_case = next(c for c in cases if c["name"] == "main")
    mine = derive(main_case["need"])
    print("## 1. 20M/24m, income 15M, debt 0, age 28, bank_salary, other")
    print(f"ranked: mine {len(mine['ranked'])}, app {len(main_case['ranked'])}. ineligible app {len(main_case['ineligible'])}, insufficient app {len(main_case['insufficient'])}")
    print("key | quote | end pct | received | payment max | total paid | total cost | APR% mine | APR% app | fails")
    app_by_key = {r["key"]: r for r in main_case["ranked"]}
    fails = 0
    for x in mine["ranked"]:
        o = BY_KEY[x["key"]]
        r = o["rate"]
        flags = "".join(c for c, k in (("P", "minIsPromotional"), ("U", "minUnconfirmed"), ("F", "floorOnly"), ("R", "maxIsReference"), ("I", "basisInferred")) if r.get(k))
        extras = f"mf={sum(f['amountVnd'] for f in o['monthlyFees'])}" if o["monthlyFees"] else ""
        extras += " ins=" + ",".join(i["method"][:6] + "/" + i["collection"][:6] for i in o["insurance"] if i["mandatory"] is True) if any(i["mandatory"] is True for i in o["insurance"]) else ""
        a = app_by_key.get(x["key"])
        for end, pct_ in (("low", x["lo_pct"]), ("high", r["maxPercent"])):
            m = x[end]
            if a is None:
                print(f"{x['key']} MISSING IN APP")
                fails += 1
                continue
            d = compare_cost(m, a[end])
            fails += bool(d)
            print(f"{x['key']} | {r['minPercent']}-{r['maxPercent']} {r['basis'][:4]} {r['period'][:1]} {flags} {extras} | {end} {pct_} | {vnd(m['received'])} | {vnd(m['max'])} | {vnd(m['totalPaid'])} | {vnd(m['totalCost'])} | {pc(m['apr'])} | {pc(a[end]['apr'])} | {'FAIL ' + '; '.join(d) if d else 'ok'}")
    print(f"cost mismatches in main case: {fails}")

    # ----- 2/3. order and verdict, every case -----
    print("\n## 2-3. Order and verdict, all cases")
    order_bad = verdict_bad = cost_bad = fit_bad = elig_bad = head_bad = 0
    examples = []
    fee_jumps = []
    ok_with_only_barrier = []
    fired = official_ties = 0
    for c in cases:
        if c["name"].startswith("synthetic/"):
            continue
        m = derive(c["need"])
        mine_keys = [x["key"] for x in m["ranked"]]
        app_keys = [x["key"] for x in c["ranked"]]
        if mine_keys != app_keys:
            order_bad += 1
            if len(examples) < 8:
                i = next((j for j, (p, q) in enumerate(zip(mine_keys, app_keys)) if p != q), None)
                examples.append(f"ORDER {c['name']} at {i}: mine {mine_keys[i] if i is not None else mine_keys} app {app_keys[i] if i is not None else app_keys}")
        if m["verdict"] != c["verdict"]:
            verdict_bad += 1
            if len(examples) < 8:
                examples.append(f"VERDICT {c['name']}: mine {m['verdict']} app {c['verdict']}")
        if m["headroom"] != c["headroom"]:
            head_bad += 1
            if len(examples) < 8:
                examples.append(f"HEADROOM {c['name']}: mine {m['headroom']} app {c['headroom']}")
        if {k: sorted(v) for k, v in m["ineligible"].items()} != {i["key"]: sorted(i["reasons"]) for i in c["ineligible"]}:
            elig_bad += 1
        app_map = {x["key"]: x for x in c["ranked"]}
        for x in m["ranked"]:
            a = app_map.get(x["key"])
            if a is None:
                continue
            if a["fit"] != x["fit"]:
                fit_bad += 1
            if bool(a["needsIncomeProofNote"]) != x["barrier"]:
                examples.append(f"BARRIER {c['name']} {x['key']}")
            for end in ("low", "high"):
                d = compare_cost(x[end], a[end])
                if d:
                    cost_bad += 1
                    if len(examples) < 8:
                        examples.append(f"COST {c['name']} {x['key']} {end}: {d}")
        raw = sorted(m["ranked"], key=lambda x: (FIT_RANK[x["fit"]], x["barrier"], x["floor"], x["high"]["apr"], x["low"]["apr"], not x["official"], x["key"]))
        if raw and raw[0]["feesUnknown"]:
            fired += 1
        for p_, q_ in zip(raw, raw[1:]):
            if p_["official"] != q_["official"] and p_["high"]["apr"] == q_["high"]["apr"] and p_["low"]["apr"] == q_["low"]["apr"] and p_["fit"] == q_["fit"] and p_["barrier"] == q_["barrier"] and p_["floor"] == q_["floor"]:
                official_ties += 1
        # A product moved to first by the unknown-fees rule, jumping over a better fit group.
        if len(m["ranked"]) > 1 and m["ranked"][1]["feesUnknown"] and FIT_RANK[m["ranked"][0]["fit"]] > FIT_RANK[m["ranked"][1]["fit"]]:
            fee_jumps.append((c["name"], m["ranked"][0]["key"], m["ranked"][0]["fit"], m["ranked"][1]["key"], m["ranked"][1]["fit"]))
        # "ok" where every reliable fitting loan needs income papers the person said they lack.
        if m["verdict"] == "ok" and not any(x["fit"] == "fits" and x["key"] in m["reliable"] and not x["barrier"] for x in m["ranked"]):
            ok_with_only_barrier.append(c["name"])
    print(f"cases {len(cases)}: order mismatches {order_bad}, verdict {verdict_bad}, headroom {head_bad}, fit {fit_bad}, eligibility {elig_bad}, cost rows {cost_bad}")
    for e in examples:
        print("  " + e)
    print(f"cases where raw first place had unknown fees (rule fired): {fired}; official-vs-other exact ties: {official_ties}")
    print(f"unknown-fee rule lifted a worse-fit loan over a better-fit one: {len(fee_jumps)} cases")
    for f in fee_jumps[:6]:
        print("  ", f)
    print(f"verdict ok though every reliable fitting loan asks for papers the borrower lacks: {len(ok_with_only_barrier)} cases, e.g. {ok_with_only_barrier[:4]}")

    for name in ("main", "proof_none", "tight", "tight_proof_none"):
        c = next(x for x in cases if x["name"] == name)
        m = derive(c["need"])
        print(f"\n### {name}: verdict mine {m['verdict']} app {c['verdict']}; headroom mine {vnd(m['headroom'])} app {vnd(c['headroom'])}; suggested app {c['suggested']}")
        print(f"reliable offers: {m['reliable']}")
        print(f"reliable and fits: {[x['key'] for x in m['ranked'] if x['fit'] == 'fits' and x['key'] in m['reliable']]}")
        print(f"official count {sum(x['official'] for x in m['ranked'])}, official too_much {sum(x['official'] and x['fit'] == 'too_much' for x in m['ranked'])}")
        print("rank | key | fit | barrier | floor | feesUnk | src | APR high | APR low | app same place?")
        app_keys = [x["key"] for x in c["ranked"]]
        for i, x in enumerate(m["ranked"]):
            print(f"{i + 1} | {x['key']} | {x['fit']} | {int(x['barrier'])} | {int(x['floor'])} | {int(x['feesUnknown'])} | {BY_KEY[x['key']]['rate']['sourceType'][:4]} | {pc(x['high']['apr'])} | {pc(x['low']['apr'])} | {'yes' if i < len(app_keys) and app_keys[i] == x['key'] else 'NO'}")

    # ----- optional insurance, shown separately on the card -----
    print("\n## Optional insurance, main case")
    bad = 0
    for a in main_case["ranked"]:
        o = BY_KEY[a["key"]]
        mine_ins = optional_insurance(o, 20_000_000, 24)
        if len(mine_ins) != len(a["insurance"]):
            print(f"COUNT {a['key']}: mine {len(mine_ins)} app {len(a['insurance'])}")
            bad += 1
        for mi, ai in zip(mine_ins, a["insurance"]):
            d = compare_cost(mi["costHigh"], ai["costHigh"])
            if mi["min"] != ai["min"] or mi["max"] != ai["max"]:
                d.append(f"premium mine {mi['min']}-{mi['max']} app {ai['min']}-{ai['max']}")
            bad += bool(d)
            c = mi["costHigh"]
            print(f"{a['key']} | {mi['name'][:40]} | premium {vnd(mi['min'])}-{vnd(mi['max'])} | received {vnd(c['received'])} | payment {vnd(c['max'])} | total {vnd(c['totalPaid'])} | cost {vnd(c['totalCost'])} | APR {pc(c['apr'])} vs app {pc(ai['costHigh']['apr'])} | {'FAIL ' + '; '.join(d) if d else 'ok'}")
    print(f"optional insurance mismatches: {bad}")

    # ----- paths no real row reaches, on what-if copies of real rows -----
    print("\n## What-if rows (dump only, nothing written back)")
    for name, offers in dump["synthetic"].items():
        c = next(x for x in cases if x["name"] == f"synthetic/{name}")
        for o in offers:
            BY_KEY[o["key"]] = o
        m = derive(c["need"], offers)
        app_map = {x["key"]: x for x in c["ranked"]}
        same_order = [x["key"] for x in m["ranked"]] == [x["key"] for x in c["ranked"]]
        fails = 0
        print(f"### {name}: {len(m['ranked'])} ranked; order {'same' if same_order else 'DIFFERENT'}; verdict mine {m['verdict']} app {c['verdict']}")
        for x in m["ranked"]:
            a = app_map[x["key"]]
            for end in ("low", "high"):
                d = compare_cost(x[end], a[end])
                if d:
                    fails += 1
                    print(f"  FAIL {x['key']} {end} at {x['lo_pct'] if end == 'low' else BY_KEY[x['key']]['rate']['maxPercent']}%: {'; '.join(d)}")
            if name in ("paths", "tie", "feeJump"):
                print(f"  {x['key']} | fit {x['fit']} / app {a['fit']} | low: rec {vnd(x['low']['received'])} pay {vnd(x['low']['max'])} total {vnd(x['low']['totalPaid'])} APR {pc(x['low']['apr'])} | high: rec {vnd(x['high']['received'])} pay {vnd(x['high']['max'])} total {vnd(x['high']['totalPaid'])} APR {pc(x['high']['apr'])}")
        print(f"  cost mismatches {fails}; app order: {[x['key'] for x in c['ranked']][:6]}")

    # ----- how the disputed figures would read -----
    print("\n## What a different reading would give, 20M/24m")
    base = {"insurance": [], "monthlyFees": [], "amortization": "annuity"}

    def alt(label, percent, basis, period, monthly_fee=0, deducted=0):
        o = {**base, "rate": {"basis": basis, "period": period}, "monthlyFees": [{"amountVnd": monthly_fee}] if monthly_fee else []}
        c = cost(o, 20_000_000, 24, percent, [(deducted, "deducted_from_payout")] if deducted else [])
        print(f"{label}: {percent} {basis} {period} | received {vnd(c['received'])} | payment {vnd(c['max'])} | total {vnd(c['totalPaid'])} | APR {pc(c['apr'])} | effective {pc(c['effective'])}")

    alt("Mcredit as in the snapshot", 6.25, "flat", "monthly")
    alt("Mcredit if the 6.25 were reducing", 6.25, "reducing", "monthly")
    alt("VietCredit MoMo as in the snapshot", 5.92, "flat", "monthly")
    alt("VietCredit MoMo if reducing", 5.92, "reducing", "monthly")
    alt("VietCredit MoMo at the page's calculator rate", 3.24, "flat", "monthly")
    alt("VietCredit's own published ceiling", 89, "reducing", "yearly")
    alt("JACCS motorbike at the aggregator's 49.9", 49.9, "reducing", "yearly", 12_000)
    alt("JACCS motorbike at the official 50.1266", 50.1266, "reducing", "yearly", 12_000)
    alt("HD SAISON cash, app listing 34.78", 34.78, "flat", "yearly")
    alt("HD SAISON cash, official ceiling 2.94/month", 2.94, "flat", "monthly")
    alt("HD SAISON cash, official ceiling 4.99/month reducing", 4.99, "reducing", "monthly")
    alt("Sacombank card loan, floor 1", 1, "flat", "monthly")
    alt("Sacombank card loan, official top 1.5", 1.5, "flat", "monthly")
    alt("Home Credit motorbike, 33.94 flat", 33.94, "flat", "yearly", 11_000)
    alt("Home Credit motorbike, 49.5 reducing", 49.5, "reducing", "yearly", 11_000)
    alt("Sacombank online 9.6 with its 300,000 disbursement fee", 9.6, "reducing", "yearly", 0, 300_000)
    alt("TPBank 0.6/month low end", 0.6, "reducing", "monthly")
    alt("TPBank at Viettel Money's 10.8%/yr low end", 10.8, "reducing", "yearly")
    alt("TPBank at the 9.65%/yr base rate", 9.65, "reducing", "yearly")

    # ----- 4. data plausibility -----
    print("\n## 4. Plausibility")
    ranked_offers = [o for o in OFFERS if o["rate"] and not o["excludeFromRanking"]]
    print(f"ranked products {len(ranked_offers)} of {len(OFFERS)}")
    for o in OFFERS:
        r = o["rate"]
        if r:
            if r["period"] == "monthly" and r["maxPercent"] > 10:
                print(f"PERIOD monthly>10: {o['key']} {r['maxPercent']}")
            if r["period"] == "yearly" and 0 < r["maxPercent"] < 1:
                print(f"PERIOD yearly<1: {o['key']} {r['maxPercent']}")
            if r["minPercent"] > r["maxPercent"]:
                print(f"MIN>MAX: {o['key']} {r['minPercent']} {r['maxPercent']}")
        for note in o["rateNotes"]:
            vals = [v for v in (note["minPercent"], note["maxPercent"]) if v is not None]
            if note["period"] == "monthly" and any(v > 10 for v in vals):
                print(f"NOTE monthly>10: {o['key']} {note}")
            if note["period"] == "yearly" and any(0 < v < 1 for v in vals):
                print(f"NOTE yearly<1: {o['key']} {note}")
            if len(vals) == 2 and vals[0] > vals[1]:
                print(f"NOTE MIN>MAX: {o['key']} {note}")
    for o in ranked_offers:
        r = o["rate"]
        if not r.get("sourceUrl") or not r.get("retrievedAt"):
            print(f"NO SOURCE: {o['key']}")

    print("\nYearly-equivalent rate and APR at the high end, 20M/24m, for every ranked offer the term allows (highest first):")
    rows = []
    for o in ranked_offers:
        a, n = 20_000_000, 24
        if (o["termMinMonths"] or 0) > n or (o["termMaxMonths"] or 999) < n:
            n = o["termMaxMonths"] or o["termMinMonths"]
        low, high, _ = both_ends(o["key"], a, n)
        rows.append((high["apr"], o["key"], n, o["rate"]))
    for apr, k, n, r in sorted(rows, key=lambda t: -t[0]):
        ye = r["maxPercent"] * (12 if r["period"] == "monthly" else 1)
        print(f"{pc(apr)}% | {k} | {n}m | {r['maxPercent']} {r['basis'][:4]} {r['period'][:1]} (x12 = {ye:.2f}%/yr) | {'inferred' if r['basisInferred'] else 'stated'} | {r['sourceType']}")

    # archive joined with snapshot
    archive = {}
    for f in glob.glob("data/lenders/*.json"):
        d = json.load(open(f, encoding="utf-8"))
        for p in d["products"]:
            archive[f"{d['slug']}/{p['id']}"] = (d, p)

    print("\nArchive vs snapshot: figure present, basis provenance, read date, old documents")
    retrieved_bumped = old_missing = 0
    for o in ranked_offers:
        r = o["rate"]
        d, p = archive[o["key"]]
        same_max = [x for x in p["rates"] if x["maxPercent"]["value"] == r["maxPercent"] and x["period"]["value"] == r["period"]]
        same_any = [x for x in p["rates"] if r["maxPercent"] in (x["maxPercent"]["value"], x["minPercent"]["value"])]
        if r["sourceType"] == "official" and not same_any and "lookup" not in r["sourceUrl"]:
            print(f"NOT IN ARCHIVE: {o['key']} max {r['maxPercent']}")
        for x in same_any:
            prov = x["basis"].get("provenance")
            if prov != "stated" and not r["basisInferred"] and x["basis"]["value"] in ("flat", "reducing"):
                print(f"BASIS flagged stated, archive says {prov}: {o['key']} {x['maxPercent']['value']} {x['basis']['value']} kind={x['kind']}")
        reads = [x["maxPercent"].get("retrievedAt") or x["minPercent"].get("retrievedAt") for x in same_any]
        reads = [x for x in reads if x]
        if reads and min(reads) < r["retrievedAt"]:
            retrieved_bumped += 1
            print(f"READ DATE moved: {o['key']} archive {min(reads)} snapshot {r['retrievedAt']}")
        docs = [x["maxPercent"].get("sourceDocumentDate") or x["minPercent"].get("sourceDocumentDate") for x in same_any]
        docs = [x for x in docs if x]
        if docs and r["oldDocumentDate"] is None:
            age = (TODAY - date.fromisoformat(min(docs))).days
            if age > 365:
                old_missing += 1
                print(f"OLD DOC not flagged: {o['key']} doc {min(docs)} ({age} days)")
        # An official offered range in the archive that the snapshot doesn't use.
        for x in p["rates"]:
            if x["kind"] == "offered_range" and x["maxPercent"]["value"] != r["maxPercent"] and x["basis"]["value"] != "unknown" and (not x.get("segment") or "mới" in (x.get("segment") or "").lower() or "thường" in (x.get("segment") or "").lower()):
                print(f"OFFICIAL RANGE NOT USED: {o['key']} archive {x['minPercent']['value']}-{x['maxPercent']['value']} {x['basis']['value']} {x['period']['value']} doc {x['maxPercent'].get('sourceDocumentDate')}; snapshot {r['minPercent']}-{r['maxPercent']} {r['basis']} {r['period']} {r['sourceType']}")
    print(f"read dates moved: {retrieved_bumped}; old documents unflagged: {old_missing}")

    print("\nResearch rows vs snapshot")
    checked = same = 0
    for f in sorted(glob.glob("data/research/secondary/*.json")):
        for row in json.load(open(f, encoding="utf-8")):
            o = BY_KEY.get(row["key"])
            if o is None or row["maxPercent"] is None and row["minPercent"] is None or not o["rate"]:
                continue
            r = o["rate"]
            url_match = row["sourceUrl"] and r["sourceUrl"].rstrip("/") == row["sourceUrl"].rstrip("/")
            if not url_match:
                print(f"not the rate source: {row['key']} row {row['minPercent']}-{row['maxPercent']} {row.get('period')} {row['sourceName']}; snapshot {r['minPercent']}-{r['maxPercent']} {r['period']} {r['sourceName']}")
                continue
            checked += 1
            ok = (row["minPercent"] in (r["minPercent"], None) or r.get("floorOnly")) and (row["maxPercent"] in (r["maxPercent"], None)) and row["sourceType"] == r["sourceType"] and row.get("period") == r["period"]
            same += bool(ok)
            date_note = ""
            if row["sourceDate"] and r["oldDocumentDate"] is None and (TODAY - date.fromisoformat(row["sourceDate"])).days > 365:
                date_note = f" OLD ROW DATE {row['sourceDate']} not flagged"
            print(f"{'same' if ok else 'DIFF'}: {row['key']} row {row['minPercent']}-{row['maxPercent']} {row.get('basis')} {row.get('period')} {row['sourceType']} scope {row['scope']}; snapshot {r['minPercent']}-{r['maxPercent']} {r['basis']} {r['period']} {r['sourceType']} scope {r['scope']} read {r['retrievedAt']} row read {row.get('retrievedAt')}{date_note}")
    print(f"rows used as the rate source: {checked}, matching: {same}")

    # ----- 5. worked example -----
    print("\n## 5. /cach-xep-hang worked example")
    P, n = 20_000_000, 24
    interest = P * 15 // 1000
    total = P + interest * n
    received = P - 400_000
    pay = F(total, n)
    r5 = irr(received, [float(pay)] * n)
    print(f"interest/month {vnd(interest)}; payment {float(pay):,.2f}; received {vnd(received)}; total {vnd(total)}; cost {vnd(total - received)}")
    print(f"monthly IRR {r5 * 100:.4f}%; x12 {r5 * 1200:.3f}%; effective {((1 + r5) ** 12 - 1) * 100:.3f}%")
    # Without the fee, for reference.
    r5b = irr(P, [float(pay)] * n)
    print(f"same loan with no fee: x12 {r5b * 1200:.3f}%")
    e = dump["example"]
    print(f"app: received {vnd(e['received'])} total {vnd(e['totalPaid'])} cost {vnd(e['totalCost'])} apr {pc(e['apr'])} effective {pc(e['effective'])} first {vnd(e['first'])} last {vnd(e['last'])}; shown {e['shownVi']}")


if __name__ == "__main__":
    main()
