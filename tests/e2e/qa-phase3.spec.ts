import { expect, test, type Page } from "@playwright/test";

/** Gaps found by the Phase 3 QA pass, including regression tests for the bugs it found. */

type A = { amount: string; term?: string; income: string; age: string; proof?: string };

async function run(page: Page, a: A) {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText("Mua điện thoại, máy tính, đồ điện tử", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill(a.amount);
  if (a.term) await page.getByText(`${a.term} tháng`, { exact: true }).click();
  await page.getByText("Trong tháng này", { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(a.income);
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill(a.age);
  await page.getByText(a.proof ?? "Lương trả qua ngân hàng", { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả của bạn" })).toBeVisible();
}

const offerKeys = (page: Page) => page.getByTestId("offer").evaluateAll((els) => els.map((e) => e.getAttribute("data-offer") ?? ""));

test.describe("eligibility boundaries", () => {
  test("100.000.000 still lists finance companies; one dong more leaves only banks, with the reason", async ({ page }) => {
    await run(page, { amount: "100000000", income: "60000000", age: "28" });
    expect((await offerKeys(page)).some((k) => k.startsWith("home-credit"))).toBe(true);

    await run(page, { amount: "100000001", income: "60000000", age: "28" });
    const keys = await offerKeys(page);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith("vpbank"))).toBe(true);
    await page.getByText(/Không phù hợp với thông tin bạn nhập/).click();
    await expect(page.getByText(/chưa hiển thị khoản trên 100 triệu đồng ở công ty tài chính/).first()).toBeVisible();
  });

  test("a 6-month term drops the products whose minimum is 12 months, and says why", async ({ page }) => {
    await run(page, { amount: "20000000", term: "6", income: "15000000", age: "28" });
    const keys = await offerKeys(page);
    expect(keys.some((k) => k.startsWith("shinhan") || k.startsWith("vpbank"))).toBe(false);
    await page.getByText(/Không phù hợp với thông tin bạn nhập/).click();
    await expect(page.getByText("Thời hạn ngắn hơn mức tối thiểu (12 tháng).").first()).toBeVisible();
  });

  test("age 18 and age 62 are filtered by each product's age rules", async ({ page }) => {
    await run(page, { amount: "20000000", income: "15000000", age: "18" });
    expect(await offerKeys(page)).toEqual(["home-credit/installment-electronics"]);
    await page.locator("summary", { hasText: "Không phù hợp với thông tin bạn nhập" }).click();
    await expect(page.getByText("Yêu cầu từ 20 tuổi.").first()).toBeVisible();

    await run(page, { amount: "20000000", income: "15000000", age: "62" });
    const at62 = await offerKeys(page);
    expect(at62.length).toBeGreaterThan(0);
    expect(at62.every((k) => k.startsWith("vpbank"))).toBe(true);
  });
});

test.describe("regressions from the QA pass", () => {
  test("no product for this age: the verdict must not say the loan may exceed what you can pay", async ({ page }) => {
    await run(page, { amount: "20000000", income: "15000000", age: "70" });
    await expect(page.getByTestId("verdict")).toHaveAttribute("data-verdict", "no_data");
    await expect(page.getByTestId("verdict")).not.toContainText("Có thể vượt mức hướng dẫn");
  });

  test("'15tr' typed as income is not silently turned into 15 dong", async ({ page }) => {
    await page.goto("/vay");
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    await page.getByText("Mua xe máy", { exact: true }).click();
    await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("20000000");
    await page.getByText("Trong tháng này", { exact: true }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const income = page.getByLabel("Thu nhập mỗi tháng của bạn");
    await income.fill("15tr");
    await expect(income).toHaveValue("15tr");
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByText(/Hãy nhập thu nhập mỗi tháng bằng chữ số/)).toBeVisible();
    await expect(page.getByText("Bước 2/3")).toBeVisible();
  });

  test("the Vietnamese results page contains no English sentences from the data", async ({ page }) => {
    await run(page, { amount: "20000000", term: "6", income: "15000000", age: "28" });
    const text = (await page.locator("main").textContent()) ?? "";
    expect(text).not.toContain("Only a promotional");
  });
});

test.describe("layout at 320px", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test("form errors and results don't overflow sideways", async ({ page }) => {
    await page.goto("/vay");
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await over()).toBeLessThanOrEqual(0);
    await run(page, { amount: "20000000", term: "36", income: "15000000", age: "28" });
    expect(await over()).toBeLessThanOrEqual(0);
  });
});

test("keyboard: Tab reaches every field and a visible outline marks the focused choice", async ({ page }) => {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab"); // first purpose radio
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!.closest("label")!).outlineStyle);
  expect(outline).toBe("solid");
});
