/**
 * All lender data, parsed with the Zod schema. Used on the server only: pages pass
 * slim `Offer` objects to the browser (see src/lib/recommend/offers.ts), so research
 * notes never reach the client bundle.
 *
 * Add new lenders here too; src/lib/data/lenders.test.ts fails if a file is missing.
 */
import feCredit from "../../../data/lenders/fe-credit.json";
import hdSaison from "../../../data/lenders/hd-saison.json";
import homeCredit from "../../../data/lenders/home-credit.json";
import lotteFinance from "../../../data/lenders/lotte-finance.json";
import mbBank from "../../../data/lenders/mb-bank.json";
import mcredit from "../../../data/lenders/mcredit.json";
import shinhanFinance from "../../../data/lenders/shinhan-finance.json";
import techcombank from "../../../data/lenders/techcombank.json";
import tpbank from "../../../data/lenders/tpbank.json";
import vpbank from "../../../data/lenders/vpbank.json";
import { LenderFile, type LenderFile as LenderFileT } from "./schema";

const RAW: unknown[] = [feCredit, hdSaison, homeCredit, lotteFinance, mbBank, mcredit, shinhanFinance, techcombank, tpbank, vpbank];

export function loadLenders(): LenderFileT[] {
  return RAW.map((raw) => LenderFile.parse(raw));
}
