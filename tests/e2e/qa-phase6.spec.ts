import { expect, test, type Page } from "@playwright/test";

async function results(page: Page, amount: string, income: string, term: string, when = "Trong tháng này") {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText("Việc khác", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill(amount);
  await page.getByText(`${term} tháng`, { exact: true }).click();
  await page.getByText(when, { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(income);
  await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill("0");
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill("28");
  await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
}

test.describe("phase 6 ship-check", () => {
  // Regression: with no product to rank, the page gave no warning and no alternatives.
  test("no ranked product still warns and shows alternatives", async ({ page }) => {
    await results(page, "250000000", "20000000", "36");
    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveAttribute("data-verdict", "no_data");
    await expect(verdict).toContainText("chúng tôi không khuyên bạn vay số tiền này");
    await expect(page.getByRole("heading", { name: "Bạn có thể làm gì thay vào đó" })).toBeVisible();
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
