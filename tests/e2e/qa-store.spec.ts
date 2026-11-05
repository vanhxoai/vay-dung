import { expect, test, type Page } from "@playwright/test";

// Regressions found by the QA pass on the data-store release (docs/qa/screenshots/store-*.png).
// These describe the CORRECT behaviour, so each fails until its bug is fixed.

async function results(page: Page, o: { amount: string; income: string; debt?: string; term?: string; purpose?: string }) {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText(o.purpose ?? "Mua điện thoại, máy tính, đồ điện tử", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill(o.amount);
  await page.getByText(`${o.term ?? "24"} tháng`, { exact: true }).click();
  await page.getByText("Trong tháng này", { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(o.income);
  await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill(o.debt ?? "0");
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill("26");
  await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByTestId("verdict")).toBeVisible();
}

const vnd = (s: string) => Number(s.replace(/\./g, ""));

test.describe("store release QA", () => {
  // Bug: "Vì sao có khoản này" showed the raw key Offer.why.noLimit for products with an open-ended limit.
  test("no card shows a raw translation key", async ({ page }) => {
    await results(page, { amount: "20000000", income: "15000000" });
    await page.getByRole("button", { name: /Xem chi tiết cả/ }).click();
    await page.evaluate(() => document.querySelectorAll("article details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
    await expect(page.locator("main")).not.toContainText(/\bOffer\.[A-Za-z_.]+/);
  });

  test("no raw translation key in English either", async ({ page }) => {
    await page.goto("/en/vay");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByText("Phone, computer, electronics", { exact: true }).click();
    await page.getByLabel("How much do you need?").fill("20000000");
    await page.getByText("This month", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your monthly income").fill("15000000");
    await page.getByLabel("How old are you?").fill("26");
    await page.getByText("Salary paid into a bank account", { exact: true }).click();
    await page.getByRole("button", { name: "See results" }).click();
    await page.getByRole("button", { name: /See details of all/ }).click();
    await page.evaluate(() => document.querySelectorAll("article details").forEach((d) => ((d as HTMLDetailsElement).open = true)));
    await expect(page.locator("main")).not.toContainText(/\bOffer\.[A-Za-z_.]+/);
  });

  // Bug: the "don't borrow" text said "even at the lowest rate you still need 897.266" when only 900.000 was left,
  // so the number it quoted was under the limit it said was exceeded.
  test("the don't-borrow message never quotes a payment that fits in the room left", async ({ page }) => {
    await results(page, { amount: "20000000", income: "10000000", debt: "3100000" });
    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveAttribute("data-verdict", "too_much");
    const text = await verdict.innerText();
    const room = text.match(/chỉ còn ([0-9.]+)/);
    const need = text.match(/vẫn cần khoảng ([0-9.]+)/);
    expect(room, text).not.toBeNull();
    // The "even at the lowest rate" sentence is only true if that payment is above the room left.
    if (need) expect(vnd(need[1])).toBeGreaterThan(vnd((room as RegExpMatchArray)[1]));
  });

  // Bug: sorted by monthly payment, "from X%" products (lowest rate only) lead the table with no heading,
  // so a rate floor from a comparison site reads as the cheapest real loan.
  test("sorting by monthly payment still marks products where only the lowest rate is known", async ({ page }) => {
    await results(page, { amount: "20000000", income: "15000000" });
    await page.getByTestId("sort").selectOption("monthly");
    const table = page.getByTestId("summary-table");
    // A minimum can't lead the list by being only a minimum: it comes last, and says so.
    await expect(table.locator("tbody tr").first()).not.toContainText("Chỉ biết mức thấp nhất");
    await expect(table.locator("tbody tr").last()).toContainText("Chỉ biết mức thấp nhất");
  });

  // Bug: the card said 979.262 per month, its own "why" line and the table said 979.268.
  test("the table and the card give the same monthly payment", async ({ page }) => {
    await results(page, { amount: "20000000", income: "15000000" });
    const key = "techcombank/vay-tieu-dung-tin-chap-tra-gop";
    const tableCell = (await page.locator(`[data-summary="${key}"] td`).nth(2).innerText()).trim();
    const card = page.locator(`[data-offer="${key}"]`);
    const monthly = await card.locator("dt", { hasText: "Trả mỗi tháng" }).locator("xpath=following-sibling::dd").innerText();
    expect(monthly).toContain(tableCell);
  });

  // Bug: a source whose name is a page title read "Rate from VIB Super Cash: biểu phí, điều kiện's own documents."
  test("the rate-source line is a clean sentence", async ({ page }) => {
    await page.goto("/en/vay");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByText("Phone, computer, electronics", { exact: true }).click();
    await page.getByLabel("How much do you need?").fill("20000000");
    await page.getByText("This month", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your monthly income").fill("15000000");
    await page.getByLabel("How old are you?").fill("26");
    await page.getByText("Salary paid into a bank account", { exact: true }).click();
    await page.getByRole("button", { name: "See results" }).click();
    await page.getByRole("button", { name: /See details of all/ }).click();
    const sources = await page.getByTestId("rate-source").allInnerTexts();
    expect(sources.filter((s) => /: .*'s own documents/.test(s))).toEqual([]);
  });
});
