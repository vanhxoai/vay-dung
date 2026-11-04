/**
 * All lender data, parsed with the Zod schema. Used on the server only: pages pass
 * slim `Offer` objects to the browser (see src/lib/recommend/offers.ts), so research
 * notes never reach the client bundle.
 *
 * Add new lenders here too; src/lib/data/lenders.test.ts fails if a file is missing.
 */
import acb from "../../../data/lenders/acb.json";
import aeonFinance from "../../../data/lenders/aeon-finance.json";
import feCredit from "../../../data/lenders/fe-credit.json";
import hdbank from "../../../data/lenders/hdbank.json";
import hdSaison from "../../../data/lenders/hd-saison.json";
import homeCredit from "../../../data/lenders/home-credit.json";
import jaccs from "../../../data/lenders/jaccs.json";
import lotteFinance from "../../../data/lenders/lotte-finance.json";
import mbBank from "../../../data/lenders/mb-bank.json";
import mcredit from "../../../data/lenders/mcredit.json";
import miraeAsset from "../../../data/lenders/mirae-asset.json";
import sacombank from "../../../data/lenders/sacombank.json";
import sfinance from "../../../data/lenders/sfinance.json";
import shinhanFinance from "../../../data/lenders/shinhan-finance.json";
import techcombank from "../../../data/lenders/techcombank.json";
import tnexFinance from "../../../data/lenders/tnex-finance.json";
import tpbank from "../../../data/lenders/tpbank.json";
import vib from "../../../data/lenders/vib.json";
import vietcredit from "../../../data/lenders/vietcredit.json";
import vpbank from "../../../data/lenders/vpbank.json";
import { LenderFile, type LenderFile as LenderFileT } from "./schema";

const RAW: unknown[] = [acb, aeonFinance, feCredit, hdbank, hdSaison, homeCredit, jaccs, lotteFinance, mbBank, mcredit, miraeAsset, sacombank, sfinance, shinhanFinance, techcombank, tnexFinance, tpbank, vib, vietcredit, vpbank];

/** The oldest date across all lists: the claim "as of" must hold for every one of them. */
export function oldestListDate(sources: readonly { asOf?: string | null; retrievedAt: string }[]): string {
  return sources.map((s) => s.asOf ?? s.retrievedAt).sort()[0];
}

export function loadLenders(): LenderFileT[] {
  return RAW.map((raw) => LenderFile.parse(raw));
}
