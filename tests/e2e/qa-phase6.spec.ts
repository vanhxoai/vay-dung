import { expect, test, type Page } from "@playwright/test";

async function results(page: Page, amount: string, income: string, term: string, when = "Trong tháng này", age = "28") {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText("Việc khác", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill(amount);
  await page.getByText(`${term} tháng`, { exact: true }).click();
  await page.getByText(when, { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(income);
  await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill("0");
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill(age);
  await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
}

test.describe("phase 6 ship-check", () => {
  test("during the soft launch, search engines are asked not to list any page", async ({ page }) => {
    for (const path of ["/", "/en", "/vay", "/kiem-tra", "/rieng-tu"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  // Compliance: a bank-wide average, or half of an unverified rate pair, read as the product's own rate.
  test("products we can't compare show only what's true of them", async ({ page }) => {
    await results(page, "20000000", "15000000", "12");
    const section = page.locator("details").filter({ hasText: "0,06%/ngày" });
    await expect(section).toContainText("không có lịch trả cố định");
    await expect(section).not.toContainText("Lãi suất tham chiếu (không phải của sản phẩm)");
    await expect(section).not.toContainText("chưa rõ theo tháng hay theo năm: 0,06");
  });

  // Compliance: a reference rate or a promotional 0% must not read as the product's price.
  test("cards show no reference rates and never present 0% as the cost", async ({ page }) => {
    await results(page, "20000000", "15000000", "24");
    await page.locator('[data-summary="home-credit/cash-loan"] button').click();
    const card = page.locator('[data-offer="home-credit/cash-loan"]');
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("33,94");
    await expect(card).not.toContainText("tham chiếu");
    await expect(page.locator("main")).not.toContainText("-0%");
  });

  // Regression: Back on a phone left the questionnaire and looked like the answers were lost.
  test("the Back button moves between steps and keeps the answers", async ({ page }) => {
    await results(page, "20000000", "15000000", "24");
    await expect(page.getByTestId("verdict")).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Thu nhập mỗi tháng của bạn")).toHaveValue("15.000.000");
    await page.goBack();
    await expect(page.getByLabel("Bạn cần bao nhiêu tiền?")).toHaveValue("20.000.000");
    await page.goForward();
    await page.goForward();
    await expect(page.getByTestId("verdict")).toBeVisible();
  });

  // Regression: the focus move took the cursor out of a field already tapped, and typing was lost.
  test("a field tapped as step 2 appears keeps its focus", async ({ page }) => {
    await page.goto("/vay");
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    await page.getByText("Việc khác", { exact: true }).click();
    await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("20000000");
    await page.getByText("Trong tháng này", { exact: true }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const income = page.getByLabel("Thu nhập mỗi tháng của bạn");
    await income.focus();
    await page.waitForTimeout(200);
    await expect(income).toBeFocused();
  });

  test("an amount that isn't a round figure is shown in full, not rounded", async ({ page }) => {
    await results(page, "3050000", "15000000", "12");
    await expect(page.locator("main")).toContainText("Bạn cần 3.050.000");
  });

  // Regression: "see N options" sat above a "don't borrow" verdict.
  test("a don't-borrow verdict links to costs for reference, not to options", async ({ page }) => {
    await results(page, "50000000", "5000000", "24");
    await expect(page.getByTestId("verdict")).toHaveAttribute("data-verdict", "too_much");
    await expect(page.getByRole("link", { name: /lựa chọn bên dưới/ })).toHaveCount(0);
  });

  // Regression: this reassurance was removed from the safety check but survived here.
  test("the hurry warning doesn't vouch for contracts", async ({ page }) => {
    await results(page, "10000000", "20000000", "24", "Trong vài ngày tới");
    await expect(page.locator("main")).not.toContainText("phải được ghi rõ trong hợp đồng");
    await expect(page.locator("main")).toContainText("hợp đồng cũng có thể bị làm giả");
  });
});
