/**
 * The optional live rate feed: a CSV at LOAN_RATES_CSV_URL, for example a Google Sheet
 * published to the web, or any system that can output CSV. It changes rates only, so a
 * lender's rate can move without a redeploy. Bad rows are skipped; the rest still apply.
 */
import { z } from "zod";
import type { Offer } from "@/lib/recommend/offers";
import { RATE_SCOPES, SOURCE_TYPES } from "./schema";

export const FEED_COLUMNS = ["key", "rate_min", "rate_max", "rate_basis", "rate_period", "rate_source_type", "rate_source_name", "rate_source_url", "rate_retrieved_at", "rate_scope"] as const;

const percent = z.preprocess((v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v), z.number().nonnegative().max(1000));

const FeedRow = z
  .object({
    key: z.string().min(1),
    rate_min: percent,
    rate_max: percent,
    rate_basis: z.enum(["flat", "reducing"]),
    rate_period: z.enum(["monthly", "yearly"]),
    rate_source_type: z.enum(SOURCE_TYPES),
    rate_source_name: z.string().min(1),
    rate_source_url: z.url(),
    rate_retrieved_at: z.iso.date(),
    rate_scope: z.enum(RATE_SCOPES).default("product"),
  })
  .refine((r) => r.rate_min <= r.rate_max, { message: "rate_min is above rate_max", path: ["rate_min"] });

/** Enough CSV for one table: quotes, doubled quotes and newlines inside quotes. */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = csv.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export type FeedResult = { offers: Offer[]; applied: number; skipped: string[] };

/** These stay unranked whatever the rate: they would duplicate a loan or have no fixed schedule. */
const NEVER_RANKED: readonly Offer["excludeCode"][] = ["same_loan_other_channel", "revolving"];

export function applyRateFeed(offers: readonly Offer[], csv: string): FeedResult {
  const [header, ...rows] = parseCsv(csv);
  const skipped: string[] = [];
  const updates = new Map<string, z.infer<typeof FeedRow>>();
  if (!header) return { offers: [...offers], applied: 0, skipped: ["the feed is empty"] };
  rows.forEach((cells, i) => {
    const parsed = FeedRow.safeParse(Object.fromEntries(header.map((h, j) => [h.trim(), cells[j] === "" ? undefined : cells[j]])));
    if (parsed.success) updates.set(parsed.data.key, parsed.data);
    else skipped.push(`line ${i + 2}: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
  });
  let applied = 0;
  const out = offers.map((o): Offer => {
    const u = updates.get(o.key);
    if (!u) return o;
    updates.delete(o.key);
    applied++;
    const neverRanked = NEVER_RANKED.includes(o.excludeCode);
    return {
      ...o,
      rate: {
        minPercent: u.rate_min,
        maxPercent: u.rate_max,
        basis: u.rate_basis,
        period: u.rate_period,
        basisInferred: false,
        segment: o.rate?.segment ?? null,
        sourceType: u.rate_source_type,
        sourceName: u.rate_source_name,
        scope: u.rate_scope,
        quote: null,
        sourceUrl: u.rate_source_url,
        retrievedAt: u.rate_retrieved_at,
        oldDocumentDate: null,
      },
      excludeFromRanking: neverRanked ? o.excludeFromRanking : false,
      excludeCode: neverRanked ? o.excludeCode : null,
    };
  });
  for (const key of updates.keys()) skipped.push(`unknown key: ${key}`);
  return { offers: out, applied, skipped };
}
