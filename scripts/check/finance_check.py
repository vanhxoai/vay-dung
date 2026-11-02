"""
Independent re-derivation of the Vay Dung cost engine results.

Plain Python, exact decimal arithmetic (no floats for money), no app code.
Run:   python -I scripts/check/finance_check.py [app.json]
If app.json (output of `npx tsx scripts/check/engine_dump.ts`) is given, prints a
comparison table. Tolerances: +-1 VND for amounts, +-0.01 percentage points for rates.

Conventions checked (as documented in src/lib/finance/rates.ts, schedule.ts, cost.ts):
- monthly periods; yearly reducing rate / 12; flat = interest on ORIGINAL amount monthly
- each month's interest rounded to the dong (half away from zero); the level annuity
  instalment is rounded to the dong; the last instalment absorbs the remainder
- equal-principal / flat principal part = floor(P / n), last month takes the rest
- t=0 cash flow = principal - deducted - paid_upfront (amountReceived = principal - deducted); financed charges raise the
  schedule principal; monthly charges are added to every instalment
- nominal APR = monthly IRR x 12 (app headline "real APR"); effective = (1+r)^12 - 1
- totalCost = totalRepaid - amountReceived
"""
from __future__ import annotations

import json
import sys
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal as D, getcontext

getcontext().prec = 60


def rnd(x: D) -> int:
    """Nearest dong, half away from zero."""
    q = abs(x).quantize(D(1), rounding=ROUND_HALF_UP)
    return int(-q if x < 0 else q)


def floor_div(p: int, n: int) -> int:
    return int((D(p) / D(n)).to_integral_value(rounding=ROUND_FLOOR))


def annuity_level(p: int, r: D, n: int) -> int:
    if r == 0:
        return rnd(D(p) / n)
    return rnd(D(p) * r / (1 - (1 + r) ** (-n)))


def schedule(p: int, r: D, n: int, method: str) -> list[dict]:
    rows, bal = [], p
    level = annuity_level(p, r, n) if method == "annuity" else None
    even = floor_div(p, n)
    flat_int = rnd(D(p) * r)
    for m in range(1, n + 1):
        interest = flat_int if method == "flat" else rnd(D(bal) * r)
        if m == n:
            prin = bal
        elif method == "annuity":
            prin = min(bal, level - interest)
        else:
            prin = even
        bal -= prin
        rows.append({"payment": prin + interest, "interest": interest, "principal": prin, "balance": bal})
    return rows


def npv(flows: list[int], r: D) -> D:
    s, disc, one_r = D(0), D(1), 1 + r
    for f in flows:
        s += D(f) / disc
        disc *= one_r
    return s


def irr(flows: list[int]) -> D:
    """Borrower view (+received, -payments): NPV is INCREASING in r. Bisection."""
    lo, hi = D("-0.999999"), D(1)
    while npv(flows, hi) < 0:
        hi *= 2
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(flows, mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def loan(principal: int, n: int, monthly_rate: D, method: str, charges: dict | None = None) -> dict:
    ch = {"deducted": 0, "upfront": 0, "financed": 0, "monthly": 0, **(charges or {})}
    financed_p = principal + ch["financed"]
    # Money in hand (fees paid separately are NOT subtracted here; app semantics since 2026-11-02).
    received = principal - ch["deducted"]
    net_t0 = received - ch["upfront"]
    rows = schedule(financed_p, monthly_rate, n, method)
    inst = [r["payment"] + ch["monthly"] for r in rows]
    total = sum(inst)
    r = irr([net_t0] + [-x for x in inst])
    interest = sum(x["interest"] for x in rows)
    charges_total = ch["deducted"] + ch["upfront"] + ch["financed"] + ch["monthly"] * n
    res = {
        "amountReceived": received,
        "financedPrincipal": financed_p,
        "instalments": inst,
        "totalRepaid": total,
        "totalCost": total + ch["upfront"] - received,  # totalPaid - amountReceived
        "totalInterest": interest,
        "totalCharges": charges_total,
        "monthlyIrr": float(r),
        "aprNominal": float(r * 12),
        "aprEffective": float((1 + r) ** 12 - 1),
        "lastBalance": rows[-1]["balance"],
    }
    # Identity: cost = interest + all charges (holds for every timing)
    assert res["totalCost"] == interest + charges_total, "cost identity broken"
    return res


def pct(p: str) -> D:
    return D(p) / 100


def yearly(p: str) -> D:
    return D(p) / 100 / 12


# TPFico premium: 10M x 140% x 2.5%/yr x 24/12
TPFICO = rnd(D(10_000_000) * D("1.4") * D("0.025") * D(24) / 12)

CASES = {
    "1_flat_fe": loan(10_000_000, 12, pct("1.41"), "flat"),
    "2_reducing_nofee": loan(12_000_000, 12, yearly("12"), "annuity"),
    "3_fee_deducted": loan(20_000_000, 24, yearly("24"), "annuity", {"deducted": 600_000}),
    "4_insurance_financed": loan(10_000_000, 24, yearly("30"), "annuity", {"financed": TPFICO}),
    "5_short_3m": loan(5_000_000, 3, pct("2"), "annuity"),
    "6_long_60m_monthly_fee": loan(100_000_000, 60, yearly("20"), "annuity", {"monthly": 12_000}),
    "7_equal_principal_hc": loan(20_000_000, 12, pct("0.75"), "equal_principal"),
    "x1_zero_rate": loan(12_000_000, 12, D(0), "annuity"),
    "x2_zero_rate_fee": loan(12_000_000, 12, D(0), "annuity", {"deducted": 500_000}),
    "x3_very_high_flat": loan(3_000_000, 6, pct("5"), "flat", {"deducted": 1_500_000}),
    "x4_paid_upfront": loan(20_000_000, 24, yearly("24"), "annuity", {"upfront": 600_000}),
    "x5_120m_3pct": loan(10_000_000, 120, pct("3"), "annuity"),  # max term is 120 since 2026-11-02
    "x6_120m_zero": loan(600_000_000, 120, D(0), "annuity"),
    "x7_flat_yearly_quote": loan(10_000_000, 12, yearly("16.92"), "flat"),
}


def affordability() -> dict:
    income, existing, new = 8_000_000, 3_000_000, 2_500_000
    limit = floor_div(income * 4, 10)  # 40%
    total = existing + new
    # Largest multiple of 100,000 whose ROUNDED annuity payment fits 1,066,185 at 1%, 12m
    best = 0
    for k in range(1, 300):
        p = k * 100_000
        if annuity_level(p, D("0.01"), 12) <= 1_066_185:
            best = p
    raw = D(1_066_185) * (1 - D("1.01") ** -12) / D("0.01")
    return {
        "verdict": "too_much" if total > limit else "ok",
        "debtToIncome": float(D(total) / income),
        "maxTotalPaymentVnd": limit,
        "headroomVnd": max(0, limit - existing),
        "maxAffordablePrincipal_raw": float(raw),
        "maxAffordablePrincipal_floorRaw": floor_div(int(raw), 100_000) * 100_000,
        "maxAffordablePrincipal_trueMax": best,
    }


def flows_note(name: str, c: dict) -> str:
    inst = c["instalments"]
    distinct = sorted(set(inst[:-1]))
    head = f"{inst[0]:,}" if len(distinct) == 1 else f"{inst[0]:,} .. {inst[-2]:,} (falling)"
    return f"t0 +{c['amountReceived']:,}; t1..{len(inst)-1} -{head}; t{len(inst)} -{inst[-1]:,}"


AMOUNT_KEYS = ["amountReceived", "financedPrincipal", "totalRepaid", "totalCost", "totalInterest", "totalCharges", "lastBalance"]
RATE_KEYS = ["monthlyIrr", "aprNominal", "aprEffective"]


def main() -> None:
    print(f"TPFico premium (10M x 1.4 x 2.5% x 24/12) = {TPFICO:,}")
    for name, c in CASES.items():
        print(f"\n[{name}] {flows_note(name, c)}")
        print(f"  repaid {c['totalRepaid']:,}  cost {c['totalCost']:,}  interest {c['totalInterest']:,}  charges {c['totalCharges']:,}")
        print(f"  IRR/month {c['monthlyIrr']*100:.6f}%  nominal {c['aprNominal']*100:.4f}%  effective {c['aprEffective']*100:.4f}%")
    aff = affordability()
    print("\n[8_affordability]", aff)

    if len(sys.argv) < 2:
        return
    with open(sys.argv[1], encoding="utf-8") as fh:
        app = json.load(fh)
    fails = 0
    print("\n| case | field | check | app | diff | result |\n|---|---|---|---|---|---|")
    if app.get("tpficoPremium") != TPFICO:
        fails += 1
    print(f"| 4 | tpficoPremium | {TPFICO:,} | {app.get('tpficoPremium'):,} | {app.get('tpficoPremium') - TPFICO} | {'PASS' if app.get('tpficoPremium') == TPFICO else 'FAIL'} |")
    for name, c in CASES.items():
        a = app[name]
        if "error" in a:
            print(f"| {name} | - | - | {a['error']} | - | FAIL |")
            fails += 1
            continue
        inst_diff = max(abs(x - y) for x, y in zip(c["instalments"], a["instalments"])) if len(a["instalments"]) == len(c["instalments"]) else None
        ok = inst_diff is not None and inst_diff <= 1
        fails += not ok
        print(f"| {name} | instalments (max abs diff) | {c['instalments'][0]:,}/{c['instalments'][-1]:,} | {a['instalments'][0]:,}/{a['instalments'][-1]:,} | {inst_diff} | {'PASS' if ok else 'FAIL'} |")
        for k in AMOUNT_KEYS:
            d = a[k] - c[k]
            ok = abs(d) <= 1
            fails += not ok
            print(f"| {name} | {k} | {c[k]:,} | {a[k]:,} | {d} | {'PASS' if ok else 'FAIL'} |")
        for k in RATE_KEYS:
            d = (a[k] - c[k]) * 100
            ok = abs(d) <= 0.01
            fails += not ok
            print(f"| {name} | {k} | {c[k]*100:.6f}% | {a[k]*100:.6f}% | {d:+.2e} pp | {'PASS' if ok else 'FAIL'} |")
    aa = app["8_affordability"]
    for k in ["verdict", "maxTotalPaymentVnd", "headroomVnd"]:
        ok = aa[k] == aff[k]
        fails += not ok
        print(f"| 8 | {k} | {aff[k]} | {aa[k]} | - | {'PASS' if ok else 'FAIL'} |")
    ok = abs(aa["debtToIncome"] - aff["debtToIncome"]) * 100 <= 0.01
    fails += not ok
    print(f"| 8 | debtToIncome | {aff['debtToIncome']:.4%} | {aa['debtToIncome']:.4%} | - | {'PASS' if ok else 'FAIL'} |")
    m = aa["maxAffordablePrincipal"]
    print(f"| 8 | maxAffordablePrincipal (true max, rounded payment fits) | {aff['maxAffordablePrincipal_trueMax']:,} | {m:,} | {m - aff['maxAffordablePrincipal_trueMax']} | {'NOTE' if m != aff['maxAffordablePrincipal_trueMax'] else 'PASS'} |")
    probes = app.get("irr_probes", {})
    for k, f in {"p1_negative_root": [1000, -1], "p2_huge_rate": [1, -1_000_000], "p3_ordinary": [100, -110]}.items():
        ref = D(-f[1]) / D(f[0]) - 1
        got = probes.get(k)
        ok = isinstance(got, (int, float)) and abs(got - float(ref)) * 100 <= 0.01 * max(1, abs(float(ref)))
        fails += not ok
        print(f"| irr | {k} {f} | {float(ref):.6g} | {got} | - | {'PASS' if ok else 'FAIL'} |")
    print(f"\nFAILURES: {fails}")


if __name__ == "__main__":
    main()
