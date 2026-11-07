import { expect, test, type Page } from "@playwright/test";

async function results(page: Page) {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText("Việc khác", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("20000000");
  await page.getByText("24 tháng", { exact: true }).click();
  await page.getByText("Trong tháng này", { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill("15000000");
  await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill("0");
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill("28");
  await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByTestId("verdict")).toBeVisible();
}

test.describe("archive mode", () => {
  test("fresh data shows no archive notice", async ({ page }) => {
    await results(page);
    await expect(page.getByTestId("archive-notice")).toHaveCount(0);
  });

  test("a year later, loans are still ranked under a dated notice", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2027-11-01T09:00:00+07:00"));
    await results(page);
    await expect(page.getByTestId("archive-notice")).toContainText("Số liệu cũ");
    await expect(page.getByTestId("archive-notice")).toContainText("/2026");
    expect(await page.getByTestId("summary-table").locator("[data-summary]").count()).toBeGreaterThan(20);
    await expect(page.getByTestId("verdict")).not.toHaveAttribute("data-verdict", "ok");
    await expect(page.getByTestId("stale-flag").first()).toBeVisible();
  });
});
