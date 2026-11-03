"""Independent check of the loan maths after the lender data update. Uses no app code: derives
everything from first principles and data/lenders/*.json, then compares with the dump from
lender_update_dump.ts.

Usage (from the repo root):
  npx tsx scripts/check/lender_update_dump.ts > out.json
  python -I scripts/check/lender_update_check.py out.json .

Conventions: "exact" means unrounded real-number maths, so a difference from the app shows the app's
rounding. Real APR as the app shows it = monthly IRR x 12; effective = (1 + IRR)^12 - 1.
"""
import json
import os
import sys
from datetime import date, timedelta
from fractions import Fraction as F

sys.stdout.reconfigure(encoding="utf-8")
dump = json.load(open(sys.argv[1], encoding="utf-8-sig"))
root = sys.argv[2]
AMT_TOL = 1
PP_TOL = 0.01


def irr(net, pays):
    """Monthly IRR by bisection, then polished with Newton. Plain floats on exact cash flows."""
    net, pays = float(net), [float(p) for p in pays]
    f = lambda x: net - sum(p / (1 + x) ** (t + 1) for t, p in enumerate(pays))
    a, b = -0.9, 1.0
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
        if d == 0:
            break
        x -= f(x) / d
    return 0.0 if abs(x) < 1e-13 else x


def monthly_rate(pct, period):
    return F(str(pct)) / 100 / (12 if period == "yearly" else 1)


def pmt(P, r, n):
    """Exact level instalment."""
    return F(P, n) if r == 0 else P * r / (1 - (1 + r) ** (-n))


def exact_pays(P, pct, period, basis, n, amort="annuity"):
    """Exact (unrounded) instalments as Fractions."""
    r = monthly_rate(pct, period)
    if basis == "flat":
        return [F(P, n) + P * r] * n
    if amort == "equal_principal":
        return [F(P, n) + (P - F(P, n) * k) * r for k in range(n)]
    return [pmt(P, r, n)] * n


def opening_balances(P, pct, period, n):
    r = monthly_rate(pct, period)
    p = pmt(P, r, n)
    out, b = [], F(P)
    for _ in range(n):
        out.append(b)
        b = b * (1 + r) - p
    return out


def rnd(x):
    return int(x + F(1, 2)) if x >= 0 else -int(-x + F(1, 2))


def apr(m):
    return m * 12 * 100, ((1 + m) ** 12 - 1) * 100


print("\n=== WORKED EXAMPLES: exact maths vs app vs published ===")
print(f"{'case':38} {'exact pay':>14} {'app first':>11} {'app last':>11} {'publ':>11} | {'exact total':>14} {'app total':>12} {'publ tot':>11} | {'my APR':>8} {'app APR':>8} {'my eff':>8} {'app eff':>8}")
cases = json.load(open(os.path.join(root, "scripts", "check", "lender_update_cases.json"), encoding="utf-8"))
fails = []
for c in cases:
    fee = c.get("monthlyFee", 0)
    pays = [p + fee for p in exact_pays(c["P"], c["pct"], c["period"], c["basis"], c["n"], c.get("amort", "annuity"))]
    a = dump["direct"][c["id"]]
    m = irr(c["P"], pays)
    nom, eff = apr(m)
    tot = sum(pays)
    print(
        f"{c['id']:38} {float(pays[0]):>14,.2f} {a['first']:>11,} {a['last']:>11,} {c.get('pubMonthly', 0):>11,} | {float(tot):>14,.2f} {a['totalRepaid']:>12,} {c.get('pubTotal', 0):>11,} | {nom:8.3f} {a['nominal'] * 100:8.3f} {eff:8.3f} {a['effective'] * 100:8.3f}"
    )
    if abs(float(pays[0]) - a["first"]) > AMT_TOL or abs(nom - a["nominal"] * 100) > PP_TOL or abs(eff - a["effective"] * 100) > PP_TOL or abs(float(tot) - a["totalRepaid"]) > AMT_TOL:
        fails.append((c["id"], float(pays[0]), a["first"], float(tot), a["totalRepaid"]))
print("exact vs app outside +-1 VND or +-0.01pp:", fails or "none")

print("\n=== 1. Home Credit: rate implied by the published payment, and the flat labels ===")


def implied(P, n, pay, basis="reducing"):
    """Yearly reducing % whose exact annuity rounds to pay: the interval [lo, hi]."""
    target_lo, target_hi = pay - 0.5, pay + 0.5
    def solve(t):
        a, b = 0.0, 3.0
        for _ in range(200):
            m = (a + b) / 2
            r = m / 12
            if P * r / (1 - (1 + r) ** (-n)) < t:
                a = m
            else:
                b = m
        return a * 100
    return solve(target_lo), solve(target_hi)


for P, n, pay, label in [(40_000_000, 24, 2_350_077, "HC 40M/24"), (60_000_000, 12, 5_997_779, "HC 60M/12"), (5_000_000, 15, 441_880, "HC elec 5M/15"), (10_000_000, 15, 842_723, "HC moto 10M/15")]:
    lo, hi = implied(P, n, pay)
    print(f"{label}: payment {pay:,} implies {lo:.5f}% to {hi:.5f}%/yr reducing annuity")
print("HC 40M/24 flat 20.22%:", rnd(exact_pays(40_000_000, 20.22, "yearly", "flat", 24)[0]), " 60M/12 flat 20.22%:", rnd(exact_pays(60_000_000, 20.22, "yearly", "flat", 12)[0]), " total", rnd(exact_pays(60_000_000, 20.22, "yearly", "flat", 12)[0] * 12))
print("HC 40M/24 equal principal @35.44181 first/last:", [rnd(x) for x in (exact_pays(40_000_000, 35.44181, "yearly", "reducing", 24, "equal_principal")[0], exact_pays(40_000_000, 35.44181, "yearly", "reducing", 24, "equal_principal")[-1])])
print("HC 60M/12 equal principal @35 first/last:", [rnd(x) for x in (exact_pays(60_000_000, 35, "yearly", "reducing", 12, "equal_principal")[0], exact_pays(60_000_000, 35, "yearly", "reducing", 12, "equal_principal")[-1])])
print("HC flat equivalent of 5,997,779 over 12m: %.4f%%/yr" % ((5_997_779 - 5_000_000) * 12 / 60_000_000 * 100))
for n in (12, 24):
    print(f"HC 20.22%% flat over {n}m is a reducing rate of %.5f%%/yr" % apr(irr(60_000_000, exact_pays(60_000_000, 20.22, "yearly", "flat", n)))[0])
for pct, label in [(45, "new-customer low"), (55, "new-customer high")]:
    p = rnd(pmt(40_000_000, monthly_rate(pct, "yearly"), 24))
    print(f"HC 40M/24 at {pct}% ({label}): {p:,}, vs calculator 2,350,077: +{p - 2_350_077:,}/month; with 11k fee {p + 11_000:,}")
# Listing example: 40M, 12 months, 8.99% flat, 3,651,000 including the 11,000 fee
print("HC listing 40M/12 @8.99% flat: exact flat", rnd(exact_pays(40_000_000, 8.99, "yearly", "flat", 12)[0]), "+ 11k =", rnd(exact_pays(40_000_000, 8.99, "yearly", "flat", 12)[0]) + 11_000, "published 3,651,000; implied reducing excl. fee %.3f%%-%.3f%%" % implied(40_000_000, 12, 3_640_000))
print("HC listing 0.75%%/mo equal principal 20M/12: first %s last %s total %s (published 1,817,000 / 20,975,000)" % tuple(rnd(x) for x in (exact_pays(20_000_000, 0.75, "monthly", "reducing", 12, "equal_principal")[0], exact_pays(20_000_000, 0.75, "monthly", "reducing", 12, "equal_principal")[-1], sum(exact_pays(20_000_000, 0.75, "monthly", "reducing", 12, "equal_principal")))))
print("HC effect of 11k fee on APR: 40M/24 @35.44181: %.3f -> %.3f; 3M/3 @45: %.3f -> %.3f" % (
    apr(irr(40_000_000, exact_pays(40_000_000, 35.44181, "yearly", "reducing", 24)))[0],
    apr(irr(40_000_000, [p + 11_000 for p in exact_pays(40_000_000, 35.44181, "yearly", "reducing", 24)]))[0],
    apr(irr(3_000_000, exact_pays(3_000_000, 45, "yearly", "reducing", 3)))[0],
    apr(irr(3_000_000, [p + 11_000 for p in exact_pays(3_000_000, 45, "yearly", "reducing", 3)]))[0],
))

print("\n=== 2. Home Credit installments at 0% and 49.5% ===")
for key, P, n in [("electronics", 10_000_000, 12), ("electronics", 20_000_000, 12), ("electronics", 20_000_000, 24), ("motorbike", 40_000_000, 24), ("motorbike", 20_000_000, 36)]:
    k = "home-credit/installment-" + key
    a = next((g for g in dump["grid"] if g["key"] == k and g["amountVnd"] == P and g["termMonths"] == n), None)
    hi = exact_pays(P, 49.5, "yearly", "reducing", n)
    h = apr(irr(P, hi))
    fee_lo = apr(irr(P, [F(P, n) + 11_000] * n))
    fee_hi = apr(irr(P, [p + 11_000 for p in hi]))
    print(f"{k} {P:,}/{n}: mine low pay {float(F(P, n)):,.2f} cost 0 APR 0; mine high pay {float(hi[0]):,.2f} total {float(sum(hi)):,.2f} cost {float(sum(hi) - P):,.2f} APR {h[0]:.3f} eff {h[1]:.3f}")
    if a:
        print(f"   app low first {a['low']['first']:,} last {a['low']['last']:,} total {a['low']['totalRepaid']:,} cost {a['low']['totalCost']:,} APR {a['low']['nominal'] * 100!r} eff {a['low']['effective'] * 100!r} | high first {a['high']['first']:,} last {a['high']['last']:,} total {a['high']['totalRepaid']:,} cost {a['high']['totalCost']:,} APR {a['high']['nominal'] * 100:.3f} eff {a['high']['effective'] * 100:.3f} | shown {a['aprVi']} / {a['effVi']} / {a['totalVi']}")
    print(f"   if the 11k transfer fee applied per instalment (unconfirmed): low APR {fee_lo[0]:.3f}, cost {11_000 * n:,}; high APR {fee_hi[0]:.3f}")
z = dump["zero"]
neg = [x for x in z if x["nominal"] < 0 or x["effective"] < 0]
nonzero = [x for x in z if x["nominal"] != 0 or x["effective"] != 0]
bad_text = [x for x in z if x["nominalVi"] != "0%" or x["effectiveVi"] != "0%"]
print(f"zero sweep: {len(z)} loans; non-finite {sum(1 for x in z if x['nominal'] is None or x['effective'] is None)}; raw IRR not exactly 0: {len(nonzero)}; negative: {len(neg)}; text other than 0%: {len(bad_text)}; total cost not 0: {sum(1 for x in z if x['totalCost'] != 0)}; max |APR|: {max(abs(x['nominal']) for x in z):.3e}; largest first-last gap: {max(abs(x['first'] - x['last']) for x in z)}")
for x in bad_text[:12]:
    print("   ", {k: x[k] for k in ("key", "amountVnd", "termMonths", "nominal", "effective", "nominalVi", "effectiveVi")})
print("verdicts changed by the 0% offers (income, term, amount, purpose: with -> without):")
for v in dump["verdicts"]:
    if v["verdict"] != v["verdictWithoutZeroOffers"]:
        top = [(k.split("/")[1], fit, lo, hi) for k, fit, lo, hi in v["ranked"] if "home-credit/installment" in k]
        print(f"   {v['purpose']:10} {v['amountVnd']:>11,}/{v['termMonths']} income {v['monthlyIncomeVnd']:>10,} headroom {v['headroom']:>9,}: {v['verdict']} -> {v['verdictWithoutZeroOffers']}  {top}")

print("\n=== 3. FE Credit cash loan: flat 1.67 to 3.86%/month with the 12,000 fee ===")
print(f"{'P':>12} {'n':>3} {'%/mo':>5} | {'pay ex fee':>12} {'with fee':>12} {'total':>13} {'cost':>12} | {'IRR%/mo':>8} {'APR nom':>8} {'eff':>8} | {'no-fee APR':>10} {'no-fee eff':>10}")
for P in (10_000_000, 20_000_000):
    for n in (12, 24):
        for pct in (1.67, 3.86):
            ex = exact_pays(P, pct, "monthly", "flat", n)
            w = [p + 12_000 for p in ex]
            m = irr(P, w)
            nom, eff = apr(m)
            m0 = irr(P, ex)
            nom0, eff0 = apr(m0)
            print(f"{P:>12,} {n:>3} {pct:>5} | {float(ex[0]):>12,.2f} {float(w[0]):>12,.2f} {float(sum(w)):>13,.2f} {float(sum(w) - P):>12,.2f} | {m * 100:8.4f} {nom:8.3f} {eff:8.3f} | {nom0:10.3f} {eff0:10.3f}")
            a = next((g for g in dump["grid"] if g["key"] == "fe-credit/tien-mat-linh-hoat" and g["amountVnd"] == P and g["termMonths"] == n), None)
            if a:
                s = a["low" if pct == 1.67 else "high"]
                print(f"{'':>24} app: first {s['first']:,} last {s['last']:,} total {s['totalRepaid']:,} cost {s['totalCost']:,} APR {s['nominal'] * 100:.3f} eff {s['effective'] * 100:.3f}")
for label, P, n, pays in [
    ("FE app listing 10M/12 published 1,066,667", 10_000_000, 12, [1_066_667] * 12),
    ("FE web 10M/12 published 974,000 (12 equal)", 10_000_000, 12, [974_000] * 12),
    ("FE web 10M/12 published total 11,692,000", 10_000_000, 12, [F(11_692_000, 12)] * 12),
    ("FE web 10M/12 + 12k", 10_000_000, 12, [F(11_692_000, 12) + 12_000] * 12),
    ("FE listing 10M/12 + 12k", 10_000_000, 12, [F(12_800_000, 12) + 12_000] * 12),
]:
    m = irr(P, pays)
    print(f"{label}: IRR {m * 100:.4f}%/mo, APR {apr(m)[0]:.3f}, eff {apr(m)[1]:.3f}")
for n in (12, 24):
    for pct in (1.67, 3.86):
        w = [p + 12_000 for p in exact_pays(20_000_000, pct, "monthly", "reducing", n)]
        print(f"If FE's {pct}%/mo were reducing, not flat (20M/{n} with fee): pay {float(w[0]):,.0f}, total {float(sum(w)):,.0f}, APR {apr(irr(20_000_000, w))[0]:.2f}")
print("Annuity reading for contrast: 10M/12 @28%%/yr %s; @1.41%%/mo %s" % (rnd(pmt(10_000_000, monthly_rate(28, "yearly"), 12)), rnd(pmt(10_000_000, monthly_rate(1.41, "monthly"), 12))))

print("\n=== 4. Shinhan at both ends ===")
for P, n in [(10_000_000, 12), (20_000_000, 24), (100_000_000, 48), (500_000_000, 60)]:
    for pct in (18, 49):
        ex = exact_pays(P, pct, "yearly", "reducing", n)
        a = next((g for g in dump["grid"] if g["key"] == "shinhan-finance/personal-unsecured-loan" and g["amountVnd"] == P and g["termMonths"] == n), None)
        s = a["low" if pct == 18 else "high"] if a else None
        print(f"{P:>12,}/{n} @{pct}: exact {float(ex[0]):,.3f} total {float(sum(ex)):,.2f} APR {apr(irr(P, ex))[0]:.3f} eff {apr(irr(P, ex))[1]:.3f} | app " + (f"first {s['first']:,} last {s['last']:,} total {s['totalRepaid']:,} APR {s['nominal'] * 100:.3f}" if s else "not eligible (over 100M cap for a finance company)"))

print("\n=== 5. VPBank: insurance on the declining balance ===")
VP = "vpbank/vpbank-vay-tin-chap-online"
print("Sum of opening balances x rate/12. 'App' figures come from recommend(); headline excludes insurance because mandatory is null.")
for P, n in [(20_000_000, 12), (20_000_000, 24), (20_000_000, 36), (100_000_000, 12), (100_000_000, 36), (200_000_000, 60)]:
    a = next(g for g in dump["grid"] if g["key"] == VP and g["amountVnd"] == P and g["termMonths"] == n)
    i = a["ins"][0]
    lo = sum(opening_balances(P, 18, "yearly", n)) * F("1.3") / 100 / 12
    hi = sum(opening_balances(P, 59, "yearly", n)) * F("1.8") / 100 / 12
    hi_at_low_rate = sum(opening_balances(P, 18, "yearly", n)) * F("1.8") / 100 / 12
    ex = exact_pays(P, 59, "yearly", "reducing", n)
    base_cost = sum(ex) - P
    m_ded = irr(P - hi, ex)
    # Financed alternative: the premium is added to the loan
    ex_fin = exact_pays(rnd(P + hi), 59, "yearly", "reducing", n)
    m_fin = irr(P, ex_fin)
    ex_lo = exact_pays(P, 18, "yearly", "reducing", n)
    m_lo_ded = irr(P - lo, ex_lo)
    ex_lo_fin = exact_pays(rnd(P + lo), 18, "yearly", "reducing", n)
    m_lo_fin = irr(P, ex_lo_fin)
    print(f"{P:>12,}/{n}: premium mine {float(lo):,.1f} to {float(hi):,.1f} ({float(hi / P * 100):.2f}% of loan); app {i['min']:,} to {i['max']:,}; 1.8% on 18% balances would be {float(hi_at_low_rate):,.1f}; mandatory={i['mandatory']} collectionKnown={i['collectionKnown']}")
    print(f"     headline high: mine cost {float(base_cost):,.1f} APR {apr(irr(P, ex))[0]:.3f}; app cost {a['high']['totalCost']:,} APR {a['high']['nominal'] * 100:.3f} (no insurance in it)")
    print(f"     high + premium deducted: mine cost {float(base_cost + hi):,.1f} APR {apr(m_ded)[0]:.3f} received {float(P - hi):,.1f}; app costHigh cost {i['costHigh']['totalCost']:,} APR {i['costHigh']['nominal'] * 100:.3f} received {i['costHigh']['received']:,} first {i['costHigh']['first']:,}")
    print(f"     high + premium financed: pay {float(ex_fin[0]):,.1f} vs {float(ex[0]):,.1f}; cost {float(sum(ex_fin) - P):,.1f} APR {apr(m_fin)[0]:.3f}")
    print(f"     low: no insurance APR {apr(irr(P, ex_lo))[0]:.3f} cost {float(sum(ex_lo) - P):,.1f}; deducted APR {apr(m_lo_ded)[0]:.3f} cost {float(sum(ex_lo) - P + lo):,.1f}; financed APR {apr(m_lo_fin)[0]:.3f} cost {float(sum(ex_lo_fin) - P):,.1f}")
# VPBank's published example: 100M, 12 months, 20%, 9,359,500, 1.6% insurance
plain = pmt(100_000_000, monthly_rate(20, "yearly"), 12)
prem_open = sum(opening_balances(100_000_000, 20, "yearly", 12)) * F("1.6") / 100 / 12
closing = sum(opening_balances(100_000_000, 20, "yearly", 12)[1:]) * F("1.6") / 100 / 12
fin_pay = pmt(rnd(100_000_000 + prem_open), monthly_rate(20, "yearly"), 12)
implied_premium = (F(9_359_500) - plain) / (plain / 100_000_000)
print(f"VP example 100M/12 @20: plain annuity {float(plain):,.1f}, published 9,359,500, gap {9_359_500 - float(plain):,.1f}; premium@1.6% opening balances {float(prem_open):,.1f}, closing balances {float(closing):,.1f}; pay if financed {float(fin_pay):,.1f}; premium implied by payment {float(implied_premium):,.1f} = {float(implied_premium / (sum(opening_balances(100_000_000, 20, 'yearly', 12)) / 100 / 12)):.3f}%/yr on opening balances")

print("\n=== 7. Lotte: can daily actual/365 give 11,339,957? ===")
P, target = 10_000_000, 11_339_957


def add_months(d, k):
    y = d.year + (d.month - 1 + k) // 12
    m = (d.month - 1 + k) % 12 + 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue


best = None
hits = []
d0 = date(2024, 1, 1)
for s in range(365 * 3):
    start = d0 + timedelta(days=s)
    bal, total, prev = F(P), F(0), start
    for k in range(1, 13):
        due = add_months(start, k)
        i = bal * F(24, 100) * (due - prev).days / 365
        pay = 946_000 if k < 12 else bal + i
        total += pay
        bal = bal + i - pay
        prev = due
    t = rnd(total)
    if best is None or abs(t - target) < abs(best[0] - target):
        best = (t, start)
    if t == target:
        hits.append(start)
totals = []
for s in range(365 * 3):
    start = d0 + timedelta(days=s)
    bal, total, prev = F(P), F(0), start
    for k in range(1, 13):
        due = add_months(start, k)
        i = bal * F(24, 100) * (due - prev).days / 365
        pay = 946_000 if k < 12 else bal + i
        total += pay
        bal = bal + i - pay
        prev = due
    totals.append(rnd(total))
print(f"monthly model with instalment 946,000: ", end="")
bal, total = F(P), F(0)
for k in range(1, 13):
    i = bal * F(2, 100)
    pay = 946_000 if k < 12 else bal + i
    total += pay
    bal = bal + i - pay
print(f"total {rnd(total):,}, last {rnd(pay):,}")
print(f"daily actual/365 across every start date 2024-2026: totals {min(totals):,} to {max(totals):,}; closest {best[0]:,} on {best[1]}; exact hits {len(hits)} {hits[:5]}")
last = target - 946_000 * 11
for label, pays in [("published (946,000 x11, last %s)" % f"{last:,}", [946_000] * 11 + [last]), ("plain 945,596 x12", [pmt(P, F(2, 100), 12)] * 12)]:
    m = irr(P, pays)
    print(f"Lotte IRR, {label}: {m * 100:.4f}%/mo, APR {apr(m)[0]:.3f}, eff {apr(m)[1]:.3f}, total {float(sum(pays)):,.2f}")

print("\n=== 8. Mcredit ===")
m = irr(5_000_000, [978_000] * 6)
print(f"published 978,000 x 6: total {978_000 * 6:,}; IRR {m * 100:.4f}%/mo, APR {apr(m)[0]:.3f}, eff {apr(m)[1]:.3f}")
ex = exact_pays(5_000_000, 2.9, "monthly", "flat", 6)
m = irr(5_000_000, ex)
print(f"exact flat: {float(ex[0]):,.2f} total {float(sum(ex)):,.2f}; IRR {m * 100:.4f}%/mo APR {apr(m)[0]:.3f} eff {apr(m)[1]:.3f}")
ex = exact_pays(5_000_000, 2.9, "monthly", "reducing", 6)
print(f"annuity at 2.9%%/mo for contrast: {float(ex[0]):,.2f} total {float(sum(ex)):,.2f}")
print("Implied reducing rate for 978,000: %.3f%%-%.3f%%/yr nominal" % implied(5_000_000, 6, 978_000))
print("Flat 14.05%/yr vs 25% reducing:")
for n in (6, 12, 18, 24, 36, 48, 60):
    ex = exact_pays(20_000_000, 14.05, "yearly", "flat", n)
    a25 = pmt(20_000_000, monthly_rate(25, "yearly"), n)
    m = irr(20_000_000, ex)
    print(f"   {n:>2}m: APR {apr(m)[0]:.3f}, eff {apr(m)[1]:.3f}; flat pay {float(ex[0]):,.1f} vs 25% annuity {float(a25):,.1f}; flat rate equal to 25% reducing here: {float((a25 - F(20_000_000, n)) * 12 / 20_000_000 * 100):.3f}%")

print("\n=== 9. Techcombank 380 VND per million per day ===")
for dpm in (380, 408):
    d = dpm / 1_000_000
    print(f"{dpm}: {d * 100:.4f}%/day; x365 {d * 365 * 100:.4f}%; x360 {d * 360 * 100:.4f}%; x366 {d * 366 * 100:.4f}%; /month (x365/12) {d * 365 / 12 * 100:.4f}%; effective with monthly compounding {((1 + d * 365 / 12) ** 12 - 1) * 100:.4f}%; effective with daily compounding {((1 + d) ** 365 - 1) * 100:.4f}%")
print("On 20M for 30 days at 380:", 380 * 20 * 30, "VND")

print("\n=== 10. Every ranked product through recommend(), independently derived from the JSON ===")
products = {}
for fn in sorted(os.listdir(os.path.join(root, "data", "lenders"))):
    if fn.endswith(".json"):
        l = json.load(open(os.path.join(root, "data", "lenders", fn), encoding="utf-8"))
        for p in l["products"]:
            products[l["slug"] + "/" + p["id"]] = p


def chosen_rate(p):
    off = [r for r in p["rates"] if r["kind"] == "offered_range" and r["minPercent"]["value"] is not None and r["maxPercent"]["value"] is not None and r["basis"]["value"] != "unknown" and r["period"]["value"] in ("monthly", "yearly")]
    return next((r for r in off if r["segment"] and "mới" in r["segment"].lower()), None) or next((r for r in off if r["segment"] is None), None) or (off[0] if off else None)


def fee_of(p):
    return sum(f["fixedVnd"]["value"] for f in p["fees"] if f["fixedVnd"]["value"] and f["timing"]["value"] == "monthly" and f["mandatory"]["value"] is True)


print("ranked keys:", dump["rankable"])
worst = dict(pay=0.0, total=0.0, apr=0.0, eff=0.0, cost=0.0)
failures, n_checked, not_int = [], 0, []
worst_row = {}
for g in dump["grid"]:
    p = products[g["key"]]
    r = chosen_rate(p)
    fee = fee_of(p)
    amort = p["amortization"]["value"]
    for end, key in (("low", "minPercent"), ("high", "maxPercent")):
        s = g[end]
        n_checked += 1
        ex = exact_pays(g["amountVnd"], r[key]["value"], r["period"]["value"], r["basis"]["value"], g["termMonths"], amort)
        w = [e + fee for e in ex]
        m = irr(g["amountVnd"], w)
        nom, eff = apr(m)
        d = dict(
            pay=abs(float(w[0]) - s["first"]),
            total=abs(float(sum(w)) - s["totalRepaid"]),
            apr=abs(nom - s["nominal"] * 100),
            eff=abs(eff - s["effective"] * 100),
            cost=abs(float(sum(w) - g["amountVnd"]) - s["totalCost"]),
        )
        for k, v in d.items():
            if v > worst[k]:
                worst[k] = v
                worst_row[k] = (g["key"], g["amountVnd"], g["termMonths"], end)
        if d["pay"] > AMT_TOL or d["apr"] > PP_TOL or d["eff"] > PP_TOL:
            failures.append((g["key"], g["amountVnd"], g["termMonths"], end, d))
        if not s["allIntegers"] or s["lastBalance"] != 0:
            not_int.append((g["key"], g["amountVnd"], g["termMonths"], end))
        if s["totalRepaid"] != s["totalPaid"] or s["totalCost"] != s["totalPaid"] - s["received"]:
            failures.append((g["key"], g["amountVnd"], g["termMonths"], end, "identity"))
    if not (g["low"]["nominal"] <= g["high"]["nominal"] and g["low"]["totalCost"] <= g["high"]["totalCost"] and g["low"]["max"] <= g["high"]["max"]):
        failures.append((g["key"], g["amountVnd"], g["termMonths"], "order"))
print(f"grid: {n_checked} low/high results checked; failures outside tolerance: {len(failures)}; non-integer or non-zero final balance: {len(not_int)}")
print("largest differences from exact maths (VND, pp):", {k: round(v, 4) for k, v in worst.items()}, worst_row)
twenty = [g for g in dump["grid"] if g["amountVnd"] == 20_000_000 and g["termMonths"] in (12, 24, 36)]
gaps = []
for g in twenty:
    p = products[g["key"]]
    r = chosen_rate(p)
    for end, key in (("low", "minPercent"), ("high", "maxPercent")):
        w = [e + fee_of(p) for e in exact_pays(20_000_000, r[key]["value"], r["period"]["value"], r["basis"]["value"], g["termMonths"], p["amortization"]["value"])]
        gaps.append((round(abs(float(sum(w)) - g[end]["totalRepaid"]), 2), g["key"], g["termMonths"], end))
print("largest total difference from exact maths at 20M, 12/24/36 months:", max(gaps))
for f in failures[:20]:
    print("   FAIL", f)

print("\n20M table, in the order the app ranks them (fee in monthly payment):")
print(f"{'purpose/term':16} {'product':46} {'rate':>12} {'pay low':>10} {'pay high':>10} {'total low':>11} {'total high':>11} {'cost low':>10} {'cost high':>10} {'APR low':>8} {'APR high':>8} {'eff low':>8} {'eff high':>8} {'mine APR l/h':>15}")
for k, v in dump["twentyM"].items():
    for g in v["ranked"]:
        p = products[g["key"]]
        r = chosen_rate(p)
        fee = fee_of(p)
        n = int(k.split("/")[1])
        am = p["amortization"]["value"]
        nl = apr(irr(20_000_000, [e + fee for e in exact_pays(20_000_000, r["minPercent"]["value"], r["period"]["value"], r["basis"]["value"], n, am)]))[0]
        nh = apr(irr(20_000_000, [e + fee for e in exact_pays(20_000_000, r["maxPercent"]["value"], r["period"]["value"], r["basis"]["value"], n, am)]))[0]
        print(f"{k:16} {g['key']:46} {str(r['minPercent']['value']) + '-' + str(r['maxPercent']['value']) + ('m' if r['period']['value'] == 'monthly' else 'y'):>12} {g['low']['first']:>10,} {g['high']['first']:>10,} {g['low']['totalRepaid']:>11,} {g['high']['totalRepaid']:>11,} {g['low']['totalCost']:>10,} {g['high']['totalCost']:>10,} {g['low']['nominal'] * 100:8.2f} {g['high']['nominal'] * 100:8.2f} {g['low']['effective'] * 100:8.2f} {g['high']['effective'] * 100:8.2f} {nl:7.2f}/{nh:7.2f}")
    print(f"   verdict {v['verdict']}; ineligible: {[(a.split('/')[1], b) for a, b in v['ineligible']]}")
