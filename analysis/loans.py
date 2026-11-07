"""Helpers for the analysis notebook: load the app's data and cost each loan.

The arithmetic comes from scripts/check/finance_check.py, the independent Python
re-derivation that matched the app's TypeScript engine to the dong on 1,628 cases.
"""
from __future__ import annotations

import json
import sys
from decimal import Decimal as D
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "check"))
from finance_check import loan  # noqa: E402

LENDER_TYPE = {"bank": "Bank", "finance_company": "Finance company"}


def load_offers() -> tuple[list[dict], str]:
    snap = json.loads((ROOT / "data" / "store" / "snapshot.json").read_text(encoding="utf-8"))
    return snap["offers"], snap["dataAsOf"]


def monthly_rate(percent: float, period: str) -> D:
    """Quoted percent -> monthly decimal rate, the same way the app reads quotes."""
    p = D(str(percent)) / 100
    return p if period == "monthly" else p / 12


def headline_yearly(percent: float, period: str) -> float:
    """What the advert seems to say per year: monthly x 12, or the yearly figure as quoted."""
    return percent * 12 if period == "monthly" else percent


def low_percent_at(rate: dict, term: int) -> float:
    for m in rate.get("minByTerm") or []:
        if term >= m["termMonthsMin"]:
            return m["percent"]
    return rate["minPercent"]


def clamp(x: int, lo: int | None, hi: int | None) -> int:
    if lo is not None:
        x = max(x, lo)
    if hi is not None:
        x = min(x, hi)
    return x


def cost(offer: dict, percent: float, amount: int, term: int) -> dict:
    """Cost one loan with its rate and fixed monthly fees. One-off fees and insurance are left out."""
    r = offer["rate"]
    method = "flat" if r["basis"] == "flat" else (offer["amortization"] or "annuity")
    monthly_fee = sum(f["amountVnd"] for f in offer["monthlyFees"])
    return loan(amount, term, monthly_rate(percent, r["period"]), method, {"monthly": monthly_fee})


def ranked_table(amount: int = 20_000_000, term: int = 24) -> pd.DataFrame:
    """One row per product the app ranks, costed at the chosen amount and term (clamped to what it allows)."""
    offers, _ = load_offers()
    rows = []
    for o in offers:
        r = o["rate"]
        if r is None or o["excludeFromRanking"]:
            continue
        a = clamp(amount, o["amountMinVnd"], o["amountMaxVnd"])
        n = clamp(term, o["termMinMonths"], o["termMaxMonths"])
        lo_pct = low_percent_at(r, n)
        lo, hi = cost(o, lo_pct, a, n), cost(o, r["maxPercent"], a, n)
        rows.append({
            "key": o["key"],
            "lender": o["lenderName"],
            "product": o["nameEn"],
            "lender_type": LENDER_TYPE[o["category"]],
            "product_type": o["productType"],
            "basis": r["basis"],
            "period": r["period"],
            "source_type": r["sourceType"],
            "confidence": o["confidence"],
            "quoted_min": lo_pct,
            "quoted_max": r["maxPercent"],
            "headline_min_yearly": headline_yearly(lo_pct, r["period"]),
            "headline_max_yearly": headline_yearly(r["maxPercent"], r["period"]),
            "amount": a,
            "term": n,
            "monthly_fee": sum(f["amountVnd"] for f in o["monthlyFees"]),
            "apr_min": lo["aprNominal"] * 100,
            "apr_max": hi["aprNominal"] * 100,
            "payment_max": max(hi["instalments"]),
            "total_cost_min": lo["totalCost"],
            "total_cost_max": hi["totalCost"],
            "floor_only": bool(r.get("floorOnly")),
            "max_is_reference": bool(r.get("maxIsReference")),
        })
    return pd.DataFrame(rows)
