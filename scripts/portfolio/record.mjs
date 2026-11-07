import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("@playwright/test");
const [lang, dir] = process.argv.slice(2);
const dur = Object.fromEntries(readFileSync(`${dir}/durations.txt`, "utf8").trim().split("\n").map((l) => l.trim().split(" ")).filter(([f]) => f.startsWith(lang)).map(([f, d]) => [f.slice(3, 6), Number(d)]));
const L = lang === "vi"
  ? { pre: "", other: "Việc khác", amount: "Bạn cần bao nhiêu tiền?", term: "24 tháng", when: "Trong tháng này", next: "Tiếp tục", income: "Thu nhập mỗi tháng của bạn", debt: "Mỗi tháng bạn đang trả nợ bao nhiêu?", age: "Bạn bao nhiêu tuổi?", proof: "Lương trả qua ngân hàng", see: "Xem kết quả", why: "Vì sao có khoản này, ở vị trí này?", sched: "Xem lịch trả từng tháng", phone: "Mua điện thoại, máy tính, đồ điện tử", lender: "Tên bên cho vay, ứng dụng hoặc trang web", check: "Kiểm tra" }
  : { pre: "/en", other: "Something else", amount: "How much do you need?", term: "24 months", when: "This month", next: "Continue", income: "Your monthly income", debt: "How much do you pay towards debts each month?", age: "How old are you?", proof: "Salary paid into a bank account", see: "See results", why: "Why is this here, in this position?", sched: "See the month-by-month schedule", phone: "Phone, computer, electronics", lender: "Lender, app or website name", check: "Check" };
const BASE = "https://vay-dung.vercel.app";
const size = { width: 412, height: 860 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "vi" ? "vi-VN" : "en-US", recordVideo: { dir: `${dir}/video-${lang}`, size } });
const page = await ctx.newPage();
const start = Date.now();
const wait = (ms) => page.waitForTimeout(ms);
const scroll = async (px, steps = 14) => { for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy(0, d), px / steps); await wait(70); } };
const type = async (label, text) => { const f = page.getByLabel(label); await f.click(); await f.pressSequentially(text, { delay: 60 }); };
const timings = [];
async function scene(id, act, fill) {
  const t0 = Date.now();
  timings.push({ id, at: (t0 - start) / 1000 });
  await act();
  const left = t0 + dur[id] * 1000 + 700 - Date.now();
  if (fill && left > 1500) await fill(left - 300);
  const rest = t0 + dur[id] * 1000 + 700 - Date.now();
  if (rest > 0) await wait(rest);
}
async function form(purpose, amount, income, debt, age) {
  await page.getByText(purpose, { exact: true }).click(); await wait(300);
  await type(L.amount, amount);
  await page.getByText(L.term, { exact: true }).click(); await wait(200);
  await page.getByText(L.when, { exact: true }).click(); await wait(300);
  await page.getByRole("button", { name: L.next }).click(); await wait(500);
  await type(L.income, income); await type(L.debt, debt); await type(L.age, age);
  await page.getByText(L.proof, { exact: true }).click(); await wait(300);
  await page.getByRole("button", { name: L.see }).click();
  await page.getByTestId("verdict").waitFor();
}

await page.goto(BASE + (L.pre || "/")); await wait(800);
await scene("s01", async () => {}, async (ms) => { await wait(ms / 2); await scroll(400); });
await page.goto(BASE + L.pre + "/vay"); await wait(600);
await scene("s02", async () => {
  await page.getByText(L.other, { exact: true }).click(); await wait(300);
  await type(L.amount, "20000000");
  await page.getByText(L.term, { exact: true }).click(); await wait(200);
  await page.getByText(L.when, { exact: true }).click();
});
await scene("s03", async () => {
  await page.getByRole("button", { name: L.next }).click(); await wait(500);
  await type(L.income, "15000000"); await type(L.debt, "0"); await type(L.age, "28");
  await page.getByText(L.proof, { exact: true }).click();
});
await scene("s04", async () => { await page.getByRole("button", { name: L.see }).click(); await page.getByTestId("verdict").waitFor(); await page.getByTestId("verdict").scrollIntoViewIfNeeded(); });
await scene("s05", async () => { await page.getByTestId("summary-table").scrollIntoViewIfNeeded(); await wait(400); }, async (ms) => { await wait(ms * 0.4); await scroll(500); });
const card = page.getByTestId("offer").first();
await scene("s06", async () => {
  await card.scrollIntoViewIfNeeded(); await wait(1500);
  await card.getByText(L.why).click(); await wait(400);
  await card.getByTestId("why-rank").scrollIntoViewIfNeeded();
});
await scene("s07", async () => { await card.getByText(L.sched).click(); await wait(300); await card.getByTestId("schedule").scrollIntoViewIfNeeded(); });
await page.goto(BASE + L.pre + "/vay"); await wait(500);
await form(L.phone, "20000000", "10000000", "3100000", "29");
await scene("s08", async () => { await page.getByTestId("verdict").scrollIntoViewIfNeeded(); }, async (ms) => { await wait(ms * 0.55); await scroll(350); });
await scene("s09", async () => { await page.goto(BASE + L.pre + "/cach-xep-hang"); await wait(500); }, async (ms) => { await wait(ms * 0.3); await scroll(1200, 30); });
await scene("s10", async () => { await page.goto(BASE + L.pre + "/du-lieu"); await wait(500); }, async (ms) => { await wait(ms * 0.35); await scroll(800, 24); });
await scene("s11", async () => {
  await page.goto(BASE + L.pre + "/kiem-tra"); await wait(500);
  await type(L.lender, "Vay Nhanh 24h");
  await page.getByRole("button", { name: L.check, exact: true }).click();
  await page.getByTestId("safety-result").scrollIntoViewIfNeeded();
});
await scene("s12", async () => { await page.goto(BASE + (L.pre || "/")); });
await wait(800);
const v = page.video(); await ctx.close(); await b.close();
writeFileSync(`${dir}/timings-${lang}.json`, JSON.stringify({ video: await v.path(), timings }, null, 1));
console.log(lang, "done", timings.at(-1).at.toFixed(1), "s");
