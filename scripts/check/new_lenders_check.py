"""Independent check of the lenders added in c8a8818 and the minUnconfirmed rule (c82869c). Uses no app
code: derives everything from first principles and data/lenders/*.json, then compares with the dump from
new_lenders_dump.ts.

Usage (from the repo root):
  npx tsx scripts/check/new_lenders_dump.ts > out.json
  python -I scripts/check/new_lenders_check.py out.json .

"exact" means unrounded real-number maths. "whole-VND" is the documented schedule rule, rebuilt here:
interest rounded each month, last instalment clears the balance. Real APR as the app shows it = monthly
IRR x 12; effective = (1 + IRR)^12 - 1. Exits 1 if any row fails.
"""
import json
import math
import os
import sys
from fractions import Fraction as F

sys.stdout.reconfigure(encoding="utf-8")
dump = json.load(open(sys.argv[1], encoding="utf-8-sig"))
root = sys.argv[2]
AMT_TOL, PP_TOL = 1, 0.01
fails, n_rows = [], 0


def rnd(x):
    return math.floor(x + F(1, 2)) if x >= 0 else -math.floor(-x + F(1, 2))


def rate(pct, period):
    return F(str(pct)) / 100 / (12 if period == "yearly" else 1)


def level(P, r, n):
    return F(P, n) if r == 0 else P * r / (1 - (1 + r) ** (-n))


def exact_pays(P, r, n, basis="reducing", amort="annuity"):
    if basis == "flat":
        return [F(P, n) + P * r] * n
    if amort == "equal_principal":
        return [F(P, n) + (P - F(P, n) * k) * r for k in range(n)]
    return [level(P, r, n)] * n


def vnd_pays(P, r, n, basis="reducing", amort="annuity"):
    if basis == "flat":
        pr, i = P // n, rnd(P * r)
        last_interest = rnd(P * r * n) - i * (n - 1)
        return [pr + i] * (n - 1) + [P - pr * (n - 1) + last_interest]
    out, bal = [], P
    lvl = rnd(level(P, r, n))
    for k in range(n):
        i = rnd(bal * r)
        if k == n - 1:
            part = bal
        elif amort == "equal_principal":
            part = P // n
        else:
            part = min(bal, max(0, lvl - i))
        out.append(part + i)
        bal -= part
    return out


def irr(net, pays):
    """Bisection on float cash flows, polished with Newton."""
    net, pays = float(net), [float(p) for p in pays]
    f = lambda x: net - sum(p / (1 + x) ** (t + 1) for t, p in enumerate(pays))
    a, b = -0.5, 1.0
    while f(b) < 0:
        b *= 2
    for _ in range(200):
        m = (a + b) / 2
        if f(m) < 0:
            a = m
        else:
            b = m
    x = (a + b) / 2
    for _ in range(5):
        d = sum((t + 1) * p / (1 + x) ** (t + 2) for t, p in enumerate(pays))
        if d:
            x -= f(x) / d
    return x


def nom(m):
    return m * 1200


def eff(m):
    return ((1 + m) ** 12 - 1) * 100


def check(case, field, mine, app, tol):
    global n_rows
    n_rows += 1
    ok = abs(float(mine) - float(app)) <= tol
    if not ok:
        fails.append((case, field, float(mine), float(app)))
    return "pass" if ok else "FAIL"


def show(case, field, mine, app, tol):
    res = check(case, field, mine, app, tol)
    fmt = (lambda v: f"{float(v):,.2f}") if tol == AMT_TOL else (lambda v: f"{float(v):.3f}%")
    print(f"| {case} | {field} | {fmt(mine)} | {fmt(app)} | {float(app) - float(mine):+,.3f} | {res} |")


cases = {c["id"]: c for c in json.load(open(os.path.join(root, "scripts", "check", "new_lenders_cases.json"), encoding="utf-8"))}

print("=== A. Every worked case: exact maths vs engine vs published ===")
print("| case | field | mine | app/published | diff | result |\n|---|---|---|---|---|---|")
derived = {}
for cid, c in cases.items():
    a = dump["direct"][cid]
    r = rate(c["pct"], c["period"])
    fee, ded = c.get("monthlyFee", 0), c.get("deducted", 0)
    ex = [p + fee for p in exact_pays(c["P"], r, c["n"], c["basis"], c.get("amort", "annuity"))]
    whole = [p + fee for p in vnd_pays(c["P"], r, c["n"], c["basis"], c.get("amort", "annuity"))]
    net = c["P"] - ded
    m = irr(net, ex)
    derived[cid] = dict(pay=ex[0], total=sum(ex), m=m, whole=whole, net=net)
    show(cid, "first payment", ex[0], a["first"], AMT_TOL)
    show(cid, "total (whole-VND rule)", sum(whole), a["totalPaid"], AMT_TOL)
    show(cid, "total cost", sum(whole) - net, a["totalCost"], AMT_TOL)
    show(cid, "APR nominal", nom(m), a["nominal"] * 100, PP_TOL)
    show(cid, "APR effective", eff(m), a["effective"] * 100, PP_TOL)
    check(cid, "every instalment (whole-VND rule)", 0, sum(abs(x - y) for x, y in zip(whole, a["rows"])), 0)
    check(cid, "final balance", 0, a["lastBalance"], 0)
    if c.get("pubMonthly"):
        show(cid, "published monthly vs exact", ex[0], c["pubMonthly"], AMT_TOL)
gap = max((abs(float(d["total"]) - dump["direct"][k]["totalPaid"]), k) for k, d in derived.items())
print(f"largest total gap, exact maths vs app (rounding of the level instalment): {gap[0]:.2f} VND on {gap[1]}")

print("\n=== 1. JACCS: what the 12,000 changes ===")
print("Readings: none; 12,000 every month (stored); 12,000 once, spread over the instalments; 12,000 once at t=0.")
print(f"{'loan':>16} {'rate':>7} | {'no fee':>7} {'monthly':>8} {'spread':>7} {'once t0':>8} | {'monthly-spread':>14} {'cost monthly':>13} {'cost spread':>12}")
for P, n in [(10_000_000, 6), (20_000_000, 12), (20_000_000, 24), (10_000_000, 36), (20_000_000, 36), (100_000_000, 36)]:
    for pct in (30, 36.04, 49.92):
        if pct == 30 and n < 15:
            continue
        base = exact_pays(P, rate(pct, "yearly"), n)
        none = nom(irr(P, base))
        mon = nom(irr(P, [p + 12_000 for p in base]))
        spr = nom(irr(P, [p + F(12_000, n) for p in base]))
        once = nom(irr(P - 12_000, base))
        print(f"{P:>13,}/{n:<2} {pct:>7} | {none:7.3f} {mon:8.3f} {spr:7.3f} {once:8.3f} | {mon - spr:14.3f} {float(sum(base) + 12_000 * n - P):13,.0f} {float(sum(base) + 12_000 - P):12,.0f}")
tw = dump["twentyM"]
J = next(x for x in tw["other/12"]["ranked"] if x["key"] == "jaccs/cash-loan")
j30 = exact_pays(20_000_000, rate(30, "yearly"), 12)
j36 = exact_pays(20_000_000, rate(36.04, "yearly"), 12)
print(
    f"Short terms: 30% applies only from 15 months (data note). App low end at 20M/12 uses 30%: first {J['low']['first']:,}, APR {J['low']['nominal'] * 100:.3f}. "
    f"Lowest listed new-customer rate at 12 months, 36.04%: first {float(j36[0]) + 12_000:,.0f}, APR {nom(irr(20_000_000, [p + 12_000 for p in j36])):.3f}, "
    f"total cost {float(sum(j36) + 144_000 - 20_000_000):,.0f} vs {float(sum(j30) + 144_000 - 20_000_000):,.0f}."
)

print("\n=== 2. SFinance: flat to real ===")
print(f"{'term':>4} | {'1.37%/mo flat: %/mo':>20} {'APR':>7} {'eff':>7} | {'35.4%/yr flat: %/mo':>20} {'APR':>7} {'eff':>7} | {'APR +12k on 20M low':>20} {'high':>7}")
for n in (6, 9, 10, 12, 15, 18, 21, 24, 30, 36):
    lo = irr(1, exact_pays(1, rate(1.37, "monthly"), n, "flat"))
    hi = irr(1, exact_pays(1, rate(35.4, "yearly"), n, "flat"))
    lo_f = irr(20_000_000, [p + 12_000 for p in exact_pays(20_000_000, rate(16.44, "yearly"), n, "flat")])
    hi_f = irr(20_000_000, [p + 12_000 for p in exact_pays(20_000_000, rate(35.4, "yearly"), n, "flat")])
    print(f"{n:>4} | {lo * 100:20.3f} {nom(lo):7.2f} {eff(lo):7.2f} | {hi * 100:20.3f} {nom(hi):7.2f} {eff(hi):7.2f} | {nom(lo_f):20.2f} {nom(hi_f):7.2f}")
ex29 = level(10_000_000, rate(29, "yearly"), 36)
print(f"Calculator 10M/36 at 29%: exact annuity {float(ex29):,.2f}. Lender API emiOrg stored in the data note: 419,070 ({419_070 - float(ex29):+.2f}).")
print(f"   plus 12,000 and rounded up to 1,000: mine {math.ceil((ex29 + 12_000) / 1000) * 1000:,}; published 432,000.")
ex29b = level(55_000_000, rate(29, "yearly"), 36)
print(f"Calculator 55M/36 at 29%: exact annuity {float(ex29b):,.2f}. Lender API emiOrg: 2,304,883 ({2_304_883 - float(ex29b):+.2f}); plus 12,000 rounded up: {math.ceil((ex29b + 12_000) / 1000) * 1000:,}; published 2,317,000.")


def implied_yearly(P, n, pay):
    a, b = 0.0, 3.0
    for _ in range(200):
        m = (a + b) / 2
        if P * (m / 12) / (1 - (1 + m / 12) ** (-n)) < pay:
            a = m
        else:
            b = m
    return a * 100


print(f"   rate implied by emiOrg: 10M/36 {implied_yearly(10_000_000, 36, 419_070):.4f}%; 55M/36 {implied_yearly(55_000_000, 36, 2_304_883):.4f}%")
print(f"   flat rate that equals 29% reducing over 36 months: {float((ex29 * 36 - 10_000_000) / 10_000_000 / 3 * 100):.3f}%/yr")
flat18 = exact_pays(20_000_000, rate(16.44, "yearly"), 18, "flat")
print(
    f"Page example 20M/18 at 16.44% flat: my total {float(sum(flat18)):,.0f}; page 25,110,000 ({25_110_000 - float(sum(flat18)):+,.0f}, not itemised; 18 x 12,000 = 216,000). "
    f"APR of the page's total {nom(irr(20_000_000, [F(25_110_000, 18)] * 18)):.3f} vs flat alone {nom(irr(20_000_000, flat18)):.3f}."
)

print("\n=== 3. minUnconfirmed ===")
products = {}
for fn in sorted(os.listdir(os.path.join(root, "data", "lenders"))):
    if fn.endswith(".json"):
        l = json.load(open(os.path.join(root, "data", "lenders", fn), encoding="utf-8"))
        for p in l["products"]:
            products[l["slug"] + "/" + p["id"]] = p


def chosen_rate(p):
    off = [
        r
        for r in p["rates"]
        if r["kind"] == "offered_range"
        and r["minPercent"]["value"] is not None
        and r["maxPercent"]["value"] is not None
        and r["basis"]["value"] != "unknown"
        and r["period"]["value"] in ("monthly", "yearly")
    ]
    return next((r for r in off if r["segment"] and "mới" in r["segment"].lower()), None) or next((r for r in off if r["segment"] is None), None) or (off[0] if off else None)


def fee_of(p):
    return sum(f["fixedVnd"]["value"] for f in p["fees"] if f["fixedVnd"]["value"] and f["timing"]["value"] == "monthly" and f["mandatory"]["value"] is True)


def low_pct(r, n):
    return r["maxPercent"]["value"] if r.get("minIsPromotional") or r.get("minUnconfirmed") else next((m["percent"] for m in r.get("minByTerm") or [] if n >= m["termMonthsMin"]), r["minPercent"]["value"])


mine_flagged = sorted(k for k, p in products.items() if not p["excludeFromRanking"] and p["status"] != "expired" and p["productType"] != "credit_card" and (chosen_rate(p) or {}).get("minUnconfirmed"))
check("flagged products", "same keys", 0, 0 if mine_flagged == sorted(dump["flaggedKeys"]) else 1, 0)
print("flagged:", [(k, chosen_rate(products[k])["minPercent"]["value"], chosen_rate(products[k])["maxPercent"]["value"]) for k in mine_flagged])
meta = dump["metamorphic"]
print("metamorphic:", {k: v for k, v in meta.items() if k != "examples"})
print("verdict differences with the rule switched off (positive control), examples:", meta["examples"])
for k in ("lowNotHigh", "fitsOnlyLow", "differsFromCollapsed", "wholeSetDiffers"):
    check("minUnconfirmed", k, 0, meta[k], 0)
check("minUnconfirmed", "rule has an effect (control)", 1, 1 if meta["ruleOffVerdictDiffers"] > 0 else 0, 0)

worst = dict(pay=0.0, apr=0.0, eff=0.0, ends=0)
over = 0
for g in dump["topOfRange"]:
    p = products[g["key"]]
    r = chosen_rate(p)
    R = rate(r["maxPercent"]["value"], r["period"]["value"])
    amort = "equal_principal" if p["amortization"]["value"] == "equal_principal" else "annuity"
    P, n, h = g["amountVnd"], g["termMonths"], g["high"]
    ex = [x + fee_of(p) for x in exact_pays(P, R, n, r["basis"]["value"], amort)]
    m = irr(P, ex)
    case = f"{g['key']} {P:,}/{n}"
    check(case, "first", ex[0], h["first"], AMT_TOL)
    check(case, "APR", nom(m), h["nominal"] * 100, PP_TOL)
    check(case, "effective", eff(m), h["effective"] * 100, PP_TOL)
    check(case, "final balance", 0, h["lastBalance"], 0)
    check(case, "rows", 0, sum(abs(a - b) for a, b in zip(vnd_pays(P, R, n, r["basis"]["value"], amort), h["rows"])), 0)
    check(case, "finite", 1, 1 if all(math.isfinite(h[k]) for k in ("irr", "nominal", "effective")) else 0, 0)
    worst["pay"] = max(worst["pay"], abs(float(ex[0]) - h["first"]))
    worst["apr"] = max(worst["apr"], abs(nom(m) - h["nominal"] * 100))
    worst["eff"] = max(worst["eff"], abs(eff(m) - h["effective"] * 100))
    worst["ends"] = max(worst["ends"], abs(h["first"] - h["last"]))
    # Fit and suggested amount at the top rate, from the guideline of 40% of income
    limit = g["monthlyIncomeVnd"] * 2 // 5
    check(case, "fit", 0, 0 if g["fit"] == ("fits" if max(h["rows"]) <= limit else "too_much") else 1, 0)
    if g["suggested"] is not None:
        s = g["suggested"]
        fits = lambda a: max(vnd_pays(a, R, n, r["basis"]["value"], amort)) + fee_of(p) <= limit
        check(case, "suggested fits, next step doesn't", 0, 0 if fits(s) and not fits(s + 100_000) and s < P else 1, 0)
        over += 1
print(f"top-of-range sweep: {len(dump['topOfRange'])} loans, {over} with a suggested amount; largest differences {worst}")
print("engine beyond any published term:")
for s in dump["stress"]:
    m = irr(s["principalVnd"], vnd_pays(s["principalVnd"], rate(s["percent"], "yearly"), s["termMonths"]))
    res = check(f"stress {s['percent']}% {s['principalVnd']:,}/{s['termMonths']}", "APR", nom(m), s["nominal"] * 100, PP_TOL)
    check(f"stress {s['percent']}% {s['principalVnd']:,}/{s['termMonths']}", "final balance", 0, s["lastBalance"], 0)
    print(f"   {s['percent']}%/yr {s['principalVnd']:>11,}/{s['termMonths']:<3}: first {s['first']:>11,} last {s['last']:>12,} APR {s['nominal'] * 100:8.3f} eff {s['effective'] * 100:10.3f} {res}")
lv = level(10_000_000, rate(24, "yearly"), 12)
bal, total = F(10_000_000), F(0)
for k in range(12):
    i = bal * F(2, 100)
    pay = 946_000 if k < 11 else bal + i
    total += pay
    bal = bal + i - pay
print(
    f"Lotte 10M/12 at 24%: exact {float(lv):,.2f}, rounded up to 1,000 = {math.ceil(lv / 1000) * 1000:,} (published 946,000). "
    f"With 946,000 x 11 and a clearing last instalment, monthly model: last {float(pay):,.0f}, total {float(total):,.0f}; published total 11,339,957 ({11_339_957 - float(total):+,.0f})."
)
check("Lotte 10M/12", "rounded up to 1,000", 946_000, math.ceil(lv / 1000) * 1000, 0)

print("\n=== 5. Ranked products at 20M, in the order the app ranks them ===")
print("| purpose/term | # | product | quoted | low first | high first | low last | high last | low total | high total | low cost | high cost | low APR | high APR | low eff | high eff | fit |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
for key, v in tw.items():
    order = []
    for i, g in enumerate(v["ranked"], 1):
        p = products[g["key"]]
        r = chosen_rate(p)
        n = int(key.split("/")[1])
        am = "equal_principal" if p["amortization"]["value"] == "equal_principal" else "annuity"
        fee = fee_of(p)
        ends = {}
        for end, pct in (("low", low_pct(r, n)), ("high", r["maxPercent"]["value"])):
            R, a = rate(pct, r["period"]["value"]), g[end]
            ex = [x + fee for x in exact_pays(20_000_000, R, n, r["basis"]["value"], am)]
            whole = [x + fee for x in vnd_pays(20_000_000, R, n, r["basis"]["value"], am)]
            m = irr(20_000_000, ex)
            ends[end] = nom(m)
            case = f"{key} {g['key']} {end}"
            check(case, "first vs exact", ex[0], a["first"], AMT_TOL)
            check(case, "every instalment", 0, sum(abs(x - y) for x, y in zip(whole, a["rows"])), 0)
            check(case, "total", sum(whole), a["totalPaid"], AMT_TOL)
            check(case, "APR", nom(m), a["nominal"] * 100, PP_TOL)
            check(case, "effective", eff(m), a["effective"] * 100, PP_TOL)
            check(case, "final balance zero", 0, a["lastBalance"], 0)
            check(case, "principal repaid = borrowed", 20_000_000, a["principalSum"], 0)
            check(case, "cost = paid - received", a["totalPaid"] - a["received"], a["totalCost"], 0)
            check(case, "rows sum to total", sum(a["rows"]), a["totalRepaid"], 0)
            check(case, "all integers", 1, 1 if all(isinstance(x, int) for x in a["rows"] + [a["first"], a["last"], a["totalPaid"], a["totalCost"], a["received"]]) else 0, 0)
            check(case, "finite rates", 1, 1 if all(math.isfinite(a[k]) for k in ("irr", "nominal", "effective")) else 0, 0)
        order.append((ends["high"], ends["low"], g["key"]))
        L, H = g["low"], g["high"]
        flag = ("*" if r.get("minUnconfirmed") else "") + ("^" if r.get("minIsPromotional") else "")
        q = f"{r['minPercent']['value']}-{r['maxPercent']['value']} {r['basis']['value']} {'y' if r['period']['value'] == 'yearly' else 'm'}{flag}"
        print(f"| {key} | {i} | {g['key']} | {q} | {L['first']:,} | {H['first']:,} | {L['last']:,} | {H['last']:,} | {L['totalPaid']:,} | {H['totalPaid']:,} | {L['totalCost']:,} | {H['totalCost']:,} | {L['nominal'] * 100:.2f} | {H['nominal'] * 100:.2f} | {L['effective'] * 100:.2f} | {H['effective'] * 100:.2f} | {g['fit']} |")
    want = [o[2] for o in sorted(order)]
    if want and products[want[0]]["feesCompleteness"] == "unknown":
        i = next((i for i, k in enumerate(want) if products[k]["feesCompleteness"] != "unknown"), None)
        if i:
            want.insert(0, want.pop(i))
    got = [g["key"] for g in v["ranked"]]
    check(key, "order", 0, 0 if want == got else 1, 0)
    if want != got:
        print("   ORDER DIFFERS, mine:", want)
    print(f"   {key}: verdict {v['verdict']}; ineligible {[(a.split('/')[1], b) for a, b in v['ineligible']]}")

print("\n=== SFinance with its 12,000 collection fee, which the app leaves out (mandatory: null) ===")
for n in (12, 24, 36):
    v = tw[f"other/{n}"]
    others = [g["high"]["nominal"] * 100 for g in v["ranked"] if g["key"] != "sfinance/vay-tien-mat"]
    S = next(g for g in v["ranked"] if g["key"] == "sfinance/vay-tien-mat")
    hi = nom(irr(20_000_000, [x + 12_000 for x in exact_pays(20_000_000, rate(35.4, "yearly"), n, "flat")]))
    lo = nom(irr(20_000_000, [x + 12_000 for x in exact_pays(20_000_000, rate(16.44, "yearly"), n, "flat")]))
    now = [g["key"] for g in v["ranked"]].index("sfinance/vay-tien-mat") + 1
    pos = sum(1 for a in others if a < hi) + 1
    print(f"20M/{n}: app {S['low']['nominal'] * 100:.2f}-{S['high']['nominal'] * 100:.2f}, with fee {lo:.2f}-{hi:.2f}; cost +{12_000 * n:,}; rank {now} -> {pos} of {len(v['ranked'])}")

print("\n=== VietCredit: repayment method is unknown, the app assumes annuity ===")
R = rate(89, "yearly")
an = exact_pays(20_000_000, R, 12)
ep = exact_pays(20_000_000, R, 12, "reducing", "equal_principal")
print(f"20M/12 at 89%: annuity {float(an[0]):,.0f} a month, total {float(sum(an)):,.0f}; equal principal first {float(ep[0]):,.0f} last {float(ep[-1]):,.0f}, total {float(sum(ep)):,.0f}")

print(f"\nROWS {n_rows} FAILURES {len(fails)}")
for f in fails[:60]:
    print("   FAIL", f)
sys.exit(1 if fails else 0)
