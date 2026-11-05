import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Automated accessibility scan (WCAG 2 A and AA rules), light and dark. It can't catch everything. */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of ["/", "/en", "/rieng-tu", "/vay", "/kiem-tra", "/cach-xep-hang", "/du-lieu"]) {
      test(`${path} has no violations`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await scan(page);
      });
    }

    test("questionnaire step 2 and results, with sections opened, have no violations", async ({ page }) => {
      await page.goto("/vay");
      await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
      await page.getByText("Việc khác", { exact: true }).click();
      await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("50000000");
      await page.getByText("Trong tháng này", { exact: true }).click();
      await page.getByRole("button", { name: "Tiếp tục" }).click();
      await page.getByRole("button", { name: "Xem kết quả" }).click();
      await scan(page); // errors showing
      await page.getByLabel("Thu nhập mỗi tháng của bạn").fill("8000000");
      await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill("3000000");
      await page.getByLabel("Bạn bao nhiêu tuổi?").fill("25");
      await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
      await page.getByRole("button", { name: "Xem kết quả" }).click();
      await expect(page.getByTestId("verdict")).toHaveAttribute("data-verdict", "too_much");
      for (const d of await page.locator("details").all()) await d.evaluate((el) => el.setAttribute("open", ""));
      await scan(page);
    });

    test("safety check results have no violations", async ({ page }) => {
      await page.goto("/kiem-tra");
      await expect(page.locator("form button[type=submit]")).toBeEnabled();
      await page.getByLabel("Tên bên cho vay, ứng dụng hoặc trang web").fill("Home Credlt");
      await page.getByText("Xin mã OTP").click();
      await page.locator("form button[type=submit]").click();
      await expect(page.getByTestId("safety-stop")).toBeVisible();
      await scan(page);
    });
  });
}
