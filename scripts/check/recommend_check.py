"""Independent check of recommend() on the real lender data. Uses no app code: reads
data/lenders/*.json itself and compares with the dump from recommend_dump.ts.

Usage: python -I scripts/check/recommend_check.py <dump.json> <repo root>
"""
import json
import math
import os
import sys
from datetime import date
from fractions import Fraction as F

sys.stdout.reconfigure(encoding="utf-8")
dump = json.load(open(sys.argv[1], encoding="utf-8-sig"))
root = sys.argv[2]
TODAY = date(2026, 11, 3)
GOODS = {
    "fe-credit/vay-mua-xe-may": "motorbike",
    "fe-credit/vay-mua-dien-thoai-dien-may": "phone",
    "hd-saison/motorbike-installment": "motorbike",
    "hd-saison/electronics-installment": "phone",
    "home-credit/installment-motorbike": "motorbike",
    "home-credit/installment-electronics": "phone",
    "shinhan-finance/motorbike-installment-loan": "motorbike",
}
CAP = 100_000_000


def rnd(x):
    """Nearest whole number, half away from zero."""
    return math.floor(x + F(1, 2)) if x >= 0 else -math.floor(-x + F(1, 2))


def walk(n, key, out):
    if isinstance(n, list):
        for v in n:
            walk(v, key, out)
    elif isinstance(n, dict):
        for k, v in n.items():
            if k == key and isinstance(v, str):
                out.append(v)
            else:
                walk(v, key, out)


products = {}
for fn in sorted(os.listdir(os.path.join(root, "data", "lenders"))):
    if not fn.endswith(".json"):
        continue
    l = json.load(open(os.path.join(root, "data", "lenders", fn), encoding="utf-8"))
    for p in l["products"]:
        if p["productType"] == "credit_card" or p["status"] == "expired":
            continue
        off = [
            r
            for r in p["rates"]
            if r["kind"] == "offered_range"
            and r["minPercent"]["value"] is not None
            and r["maxPercent"]["value"] is not None
            and r["basis"]["value"] != "unknown"
            and r["period"]["value"] != "unknown"
        ]
        rate = (
            next((r for r in off if r["segment"] and "mới" in r["segment"].lower()), None)
            or next((r for r in off if r["segment"] is None), None)
            or (off[0] if off else None)
        )
        dates = []
        walk(p, "retrievedAt", dates)
        stale = (TODAY - date.fromisoformat(min(dates))).days > 90
        products[l["slug"] + "/" + p["id"]] = dict(p=p, l=l, rate=rate, stale=stale)


def monthly_fee(p):
    return sum(
        f["fixedVnd"]["value"]
        for f in p["fees"]
        if f["fixedVnd"]["value"] and f["timing"]["value"] == "monthly" and f["mandatory"]["value"] is True
    )


def schedule(P, pct, period, basis, amort, n):
    """Instalments in whole VND: interest rounded monthly, last instalment clears the balance."""
    r = F(str(pct)) / 100 / (12 if period == "yearly" else 1)
    if basis == "flat":
        i = rnd(P * r)
        pr = P // n
        return [pr + i] * (n - 1) + [P - pr * (n - 1) + i], [P - pr * k for k in range(n)]
    out, bal, opening = [], P, []
    if amort == "equal_principal":
        pr = P // n
        for k in range(n):
            opening.append(bal)
            i = rnd(bal * r)
            part = bal if k == n - 1 else pr
            out.append(part + i)
            bal -= part
    else:
        lvl = rnd(F(P, n)) if r == 0 else rnd(P * r / (1 - (1 + r) ** (-n)))
        for k in range(n):
            opening.append(bal)
            i = rnd(bal * r)
            part = bal if k == n - 1 else min(bal, max(0, lvl - i))
            out.append(part + i)
            bal -= part
    return out, opening


def irr(net, pays):
    f = lambda x: net - sum(p / (1 + x) ** (t + 1) for t, p in enumerate(pays))
    a, b = -0.5, 5.0
    for _ in range(200):
        m = (a + b) / 2
        if f(a) * f(m) <= 0:
            b = m
        else:
            a = m
    return (a + b) / 2


def cost(key, P, n, end, deducted=0, financed=0):
    d = products[key]
    p = d["p"]
    r = d["rate"]
    pct = r["minPercent" if end == "low" else "maxPercent"]["value"]
    s, _ = schedule(P + financed, pct, r["period"]["value"], r["basis"]["value"], p["amortization"]["value"], n)
    fee = monthly_fee(p)
    pays = [x + fee for x in s]
    net = P - deducted
    m = irr(net, pays)
    return dict(
        received=net,
        first=pays[0],
        last=pays[-1],
        max=max(pays),
        totalPaid=sum(pays),
        totalCost=sum(pays) - net,
        irr=m,
        nominal=m * 12,
        effective=(1 + m) ** 12 - 1,
    )


fails = []
rows = []


def row(case, field, mine, app, kind):
    if kind == "vnd":
        ok = abs(mine - app) <= 1
        ds, ms, a = f"{app - mine:+,}", f"{mine:,}", f"{app:,}"
    elif kind == "pct":
        ok = abs(mine - app) * 100 <= 0.01
        ds, ms, a = f"{(app - mine) * 100:+.2e} pp", f"{mine * 100:.4f}%", f"{app * 100:.4f}%"
    else:
        ok = mine == app
        ds, ms, a = "-" if ok else "DIFF", str(mine), str(app)
    rows.append(f"| {case} | {field} | {ms} | {a} | {ds} | {'PASS' if ok else 'FAIL'} |")
    if not ok:
        fails.append((case, field, ms, a))


# 1. Product figures and ranking
for tag, n in (("t24", 24), ("t12", 12), ("t36", 36)):
    app = dump[tag]
    for x in app["ranked"]:
        for end in ("low", "high"):
            m = cost(x["key"], 20_000_000, n, end)
            for k in ("received", "first", "last", "max", "totalPaid", "totalCost"):
                row(f"{x['key']} {n}m {end}", k, m[k], x[end][k], "vnd")
            for k in ("nominal", "effective"):
                row(f"{x['key']} {n}m {end}", k, m[k], x[end][k], "pct")
    wantk = sorted(
        (x["key"] for x in app["ranked"]),
        key=lambda k: (cost(k, 20_000_000, n, "high")["nominal"], cost(k, 20_000_000, n, "low")["nominal"], k),
    )
    print(tag, "pure cost order:", wantk)
    if products[wantk[0]]["p"]["feesCompleteness"] == "unknown":
        i = next((i for i, k in enumerate(wantk) if products[k]["p"]["feesCompleteness"] != "unknown"), None)
        if i:
            wantk.insert(0, wantk.pop(i))
    row(f"ranking {n}m", "order", wantk, [x["key"] for x in app["ranked"]], "eq")

print("\nSUMMARY")
for tag in ("t12", "t24", "t36"):
    print(tag, "verdict", dump[tag]["verdict"], "ineligible", dump[tag]["ineligible"])
    for i, x in enumerate(dump[tag]["ranked"], 1):
        print(
            i,
            x["key"],
            "feesUnknown" if x["feesAllUnknown"] else "",
            x["fit"],
            "| first",
            x["low"]["first"],
            x["high"]["first"],
            "| last",
            x["low"]["last"],
            x["high"]["last"],
            "| paid",
            x["low"]["totalPaid"],
            x["high"]["totalPaid"],
            "| cost",
            x["low"]["totalCost"],
            x["high"]["totalCost"],
            "| nom %.4f %.4f eff %.4f %.4f"
            % (x["low"]["nominal"] * 100, x["high"]["nominal"] * 100, x["low"]["effective"] * 100, x["high"]["effective"] * 100),
            "|",
            x["sentenceVi"],
            "|",
            x["aprVi"],
        )

# 2. VPBank insurance
print("\nINSURANCE")
VP = "vpbank/vpbank-vay-tin-chap-online"


def prem(open_bal, annual):
    return rnd(sum(open_bal) * F(str(annual)) / 100 / 12)


_, ob_hi = schedule(20_000_000, 59, "yearly", "reducing", "annuity", 24)
_, ob_lo = schedule(20_000_000, 14.4, "yearly", "reducing", "annuity", 24)
pmin_hi, pmax_hi = prem(ob_hi, 1.3), prem(ob_hi, 1.8)
pmin_lo, pmax_lo = prem(ob_lo, 1.3), prem(ob_lo, 1.8)
appi = next(x for x in dump["t24"]["ranked"] if x["key"] == VP)["ins"][0]
print("balances at 59%:", pmin_hi, pmax_hi, " balances at 14.4%:", pmin_lo, pmax_lo, " app:", appi["min"], appi["max"], "mandatory", appi["mandatory"])
ded = cost(VP, 20_000_000, 24, "high", deducted=pmax_hi)
fin = cost(VP, 20_000_000, 24, "high", financed=pmax_hi)
show = ("received", "first", "totalPaid", "totalCost")
print("deducted:", {k: ded[k] for k in show}, "nom %.4f" % (ded["nominal"] * 100))
print("app costHigh:", {k: appi["costHigh"][k] for k in show}, "nom %.4f" % (appi["costHigh"]["nominal"] * 100))
print("financed instead:", {k: fin[k] for k in show}, "nom %.4f" % (fin["nominal"] * 100))
plain = cost(VP, 20_000_000, 24, "high")
print("no insurance high: nom %.4f cost %d" % (plain["nominal"] * 100, plain["totalCost"]))
row("VPBank premium", "max (1.8% on 59% balances)", pmax_hi, appi["max"], "vnd")
row("VPBank premium", "min (1.3% on 59% balances)", pmin_hi, appi["min"], "vnd")
row("VPBank premium", "true low end (1.3% on 14.4% balances)", pmin_lo, appi["min"], "vnd")
row("VPBank costHigh", "totalCost", ded["totalCost"], appi["costHigh"]["totalCost"], "vnd")
row("VPBank costHigh", "nominal", ded["nominal"], appi["costHigh"]["nominal"], "pct")
s, ob = schedule(100_000_000, 20, "yearly", "reducing", "annuity", 12)
pe = prem(ob, 1.6)
s2, _ = schedule(100_000_000 + pe, 20, "yearly", "reducing", "annuity", 12)
print("VPBank page example: plain", s[0], "premium", pe, "financed instalment", s2[0], "page 9,359,500; implied financed premium", round((9359500 / s[0] - 1) * 100_000_000))

# 3. Boundaries
print("\nBOUNDARIES")
b = dump["boundaries"]
for k, v in b.items():
    print(k, v["verdict"], "headroom", v["headroom"], "principalOnly", v["principalOnly"], "suggested", v["suggested"], [(x["key"].split("/")[0], x["fit"], x["high"]["max"], x["low"]["max"]) for x in v["ranked"]])
row("exact 40% (1,750,000 / 4,375,000)", "verdict", "ok", b["exact40"]["verdict"], "eq")
row("1 VND income below", "verdict", "depends", b["oneBelow40"]["verdict"], "eq")
row("equal principal: first month over, average under", "verdict", "too_much", b["ep_avgFitsFirstNot"]["verdict"], "eq")
row("principal 833,334 = limit", "not too_much by principal", True, b["principalFits"]["principalOnly"] == 833334 and b["principalFits"]["headroom"] == 833334, "eq")
row("principal 1 VND over", "verdict", "too_much", b["principalFails"]["verdict"], "eq")
row("principal + debt over", "verdict", "too_much", b["principalFailsWithDebt"]["verdict"], "eq")
row("FE highest month 1,617,341 inc. 12,000 fee: exact limit", "fit", "fits", b["feFee_income"]["ranked"][0]["fit"], "eq")
row("FE fee boundary, 1 VND income below", "fit", "fits_only_low", b["feFee_below"]["ranked"][0]["fit"], "eq")
row("no offers, principal = limit", "verdict", "no_data", b["noOffersPrincipalFits"]["verdict"], "eq")
row("no offers, principal 1 VND over", "verdict", "too_much", b["noOffersPrincipalFails"]["verdict"], "eq")
row("only product has unknown fees", "verdict", "depends", b["shinhanOnly"]["verdict"], "eq")
row("debt uses all headroom", "suggested", None, b["allDebt"]["suggested"], "eq")


def eligible(key, g):
    d = products[key]
    p = d["p"]
    e = p["eligibility"]
    a, t = g["amountVnd"], g["termMonths"]
    v = lambda x: x["value"]
    if v(p["amountMinVnd"]) is not None and a < v(p["amountMinVnd"]):
        return False
    if v(p["amountMaxVnd"]) is not None and a > v(p["amountMaxVnd"]):
        return False
    if d["l"]["licenseCategory"] == "finance_company" and a > CAP:
        return False
    if v(p["termMinMonths"]) is not None and t < v(p["termMinMonths"]):
        return False
    if v(p["termMaxMonths"]) is not None and t > v(p["termMaxMonths"]):
        return False
    if v(e["minAge"]) is not None and g["age"] < v(e["minAge"]):
        return False
    if v(e["maxAge"]) is not None and (g["age"] + t / 12 if e["maxAgeAtLoanEnd"] else g["age"]) > v(e["maxAge"]):
        return False
    if v(e["minMonthlyIncomeVnd"]) is not None and g["monthlyIncomeVnd"] < v(e["minMonthlyIncomeVnd"]):
        return False
    return True


cache = {}


def maxpay(key, P, n, end):
    k = (key, P, n, end)
    if k not in cache:
        d = products[key]
        r = d["rate"]
        s, _ = schedule(P, r["minPercent" if end == "low" else "maxPercent"]["value"], r["period"]["value"], r["basis"]["value"], d["p"]["amortization"]["value"], n)
        cache[k] = max(s) + monthly_fee(d["p"])
    return cache[k]


def reliable(k):
    p = products[k]["p"]
    e = p["eligibility"]
    return p["feesCompleteness"] != "unknown" and e["existingCustomerRequired"]["value"] is not True and e["employerRestriction"]["value"] is None


bad = {"verdict": 0, "keys": 0, "suggest_notfit": 0, "suggest_notmax": 0, "suggest_other": 0, "missed": 0, "already_fits": 0}
examples = {}
checked = 0
for g in dump["grid"]:
    inc, debt, a, n = g["monthlyIncomeVnd"], g["existingDebtVnd"], g["amountVnd"], g["termMonths"]
    limit = inc * 2 // 5
    head = max(0, limit - debt)
    keys = [
        k
        for k, d in products.items()
        if GOODS.get(k) in (None, g["purpose"]) and not d["p"]["excludeFromRanking"] and d["rate"] is not None and not d["stale"] and eligible(k, g)
    ]
    if sorted(keys) != sorted(g["keys"]):
        bad["keys"] += 1
        examples.setdefault("keys", (g, keys))
        continue
    fit = {}
    for k in keys:
        fit[k] = "fits" if debt + maxpay(k, a, n, "high") <= limit else "fits_only_low" if debt + maxpay(k, a, n, "low") <= limit else "too_much"
    if inc <= 0:
        want = "no_income"
    elif -(-a // n) + debt > limit:
        want = "too_much"
    elif not keys:
        want = "no_data"
    elif all(fit[k] == "too_much" for k in keys):
        want = "too_much"
    elif any(fit[k] == "fits" and reliable(k) for k in keys):
        want = "ok"
    else:
        want = "depends"
    if want != g["verdict"]:
        bad["verdict"] += 1
        examples.setdefault("verdict", (g, want, fit))
    s = g["suggested"]
    if s is not None:
        checked += 1
        best = g["keys"][0]
        if debt + maxpay(best, s, n, "high") > limit:
            bad["suggest_notfit"] += 1
            examples.setdefault("notfit", (g, maxpay(best, s, n, "high")))
        if s + 100_000 < a and debt + maxpay(best, s + 100_000, n, "high") <= limit:
            bad["suggest_notmax"] += 1
            examples.setdefault("notmax", g)
        if s >= a or s % 100_000:
            bad["suggest_other"] += 1
            examples.setdefault("other", g)
        if debt + maxpay(best, a, n, "high") <= limit:
            bad["already_fits"] += 1
            examples.setdefault("already_fits", g)
    elif want not in ("ok", "no_income") and g["keys"] and head > 0:
        best = g["keys"][0]
        lo = products[best]["p"]["amountMinVnd"]["value"] or 0
        p = max(1_000_000, -(-lo // 100_000) * 100_000)
        up = -(-a // 100_000) * 100_000
        if p < a and head >= maxpay(best, p, n, "high") and head < maxpay(best, up, n, "high"):
            bad["missed"] += 1
            examples.setdefault("missed", g)
print("\nGRID cases", len(dump["grid"]), "with suggestion", checked, bad)
for k, v in examples.items():
    print(" ex", k, str(v)[:700])
print("floor check", dump["floorChecked"], "mismatches", dump["floorMismatch"])

print("\nSYNTHETIC mandatory insurance")
for k, v in dump["synthetic"].items():
    x = v["ranked"][0]
    print(k, v["verdict"], "headroom", v["headroom"], "suggested", v["suggested"], "high max", x["high"]["max"], "low max", x["low"]["max"], "received low/high", x["low"]["received"], x["high"]["received"])
    sg = v["suggested"]
    if sg:
        fin = rnd(F(sg) * F(10, 100))
        mp = schedule(sg + (fin if k == "added" else 0), 59, "yearly", "reducing", "annuity", 24)[0][0]
        print("  real instalment at suggested amount incl. financed premium:", mp, "headroom", v["headroom"], "fits" if mp <= v["headroom"] else "DOES NOT FIT")

print("\nLANDING", dump["landing"])
m = irr(24_000_000, [1_360_000] * 24)
print("mine: instalment", 24_000_000 // 24 + rnd(F(24_000_000) * F("0.015")), "total", 24_000_000 + 24 * 360_000, "nom %.4f eff %.4f" % (m * 1200, ((1 + m) ** 12 - 1) * 100))
row("landing", "total", 32_640_000, dump["landing"]["totalPaid"], "vnd")
row("landing", "nominal", m * 12, dump["landing"]["nominal"], "pct")
print("\nPROBES")
for p in dump["probes"]:
    print(p)
print("\nROWS", len(rows), "PASS", sum(" PASS |" in r for r in rows), "FAIL", sum(" FAIL |" in r for r in rows))
print("\n".join(r for r in rows if "12m" not in r and "36m" not in r))
print("\nFAILURES", len(fails))
for f in fails:
    print(f)
