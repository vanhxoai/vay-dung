import { describe, expect, it, vi } from "vitest";
import { loadLenders } from "@/lib/data/lenders";
import { toOffers } from "@/lib/recommend/offers";
import { applyRateFeed, FEED_COLUMNS, parseCsv } from "./feed";
import { getLoanData, loadSnapshot } from "./index";

const offers = toOffers(loadLenders());
const unranked = offers.find((o) => o.rate === null && o.excludeCode === "no_rate" && o.productType === "cash_loan")!;
const line = (key: string, min = "1,5", max = "2") => `${key},"${min}","${max}",flat,monthly,aggregator,Trang A,https://example.com/a,2026-11-05,lender_general`;
const header = FEED_COLUMNS.join(",");

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, newlines and a byte-order mark", () => {
    expect(parseCsv('﻿a,b\r\n"x,1","y""z"\n"p\nq",r\n')).toEqual([["a", "b"], ["x,1", 'y"z'], ["p\nq", "r"]]);
  });
});

describe("applyRateFeed", () => {
  it("updates a rate, keeps its source, and lets the product be ranked", () => {
    const { offers: out, applied } = applyRateFeed(offers, `${header}\n${line(unranked.key)}\n`);
    const o = out.find((x) => x.key === unranked.key)!;
    expect(applied).toBe(1);
    expect(o.rate).toMatchObject({ minPercent: 1.5, maxPercent: 2, sourceType: "aggregator", sourceName: "Trang A", scope: "lender_general" });
    expect(o.excludeFromRanking).toBe(false);
    expect(o.excludeCode).toBeNull();
  });

  it("skips a row with no source and an unknown key, and still applies the rest", () => {
    const noSource = `${unranked.key},1,2,flat,monthly,aggregator,Trang A,,2026-11-05,product`;
    const { applied, skipped, offers: out } = applyRateFeed(offers, `${header}\n${noSource}\n${line("no/such")}\n`);
    expect(applied).toBe(0);
    expect(skipped).toHaveLength(2);
    expect(out).toEqual(offers);
  });

  it("refuses a minimum above the maximum", () => {
    expect(applyRateFeed(offers, `${header}\n${line(unranked.key, "9", "1")}\n`).applied).toBe(0);
  });

  it("never ranks a loan that would duplicate another or has no fixed schedule", () => {
    const dup = offers.find((o) => o.excludeCode === "same_loan_other_channel")!;
    const o = applyRateFeed(offers, `${header}\n${line(dup.key)}\n`).offers.find((x) => x.key === dup.key)!;
    expect(o.excludeFromRanking).toBe(true);
  });
});

describe("getLoanData", () => {
  it("uses the snapshot with no feed, and falls back to it if the feed is down", async () => {
    expect((await getLoanData("")).offers).toEqual(loadSnapshot().offers);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await getLoanData("https://example.com/feed.csv")).offers).toEqual(loadSnapshot().offers);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect((await getLoanData("https://example.com/feed.csv")).offers).toEqual(loadSnapshot().offers);
    vi.unstubAllGlobals();
    warn.mockRestore();
  });
});
