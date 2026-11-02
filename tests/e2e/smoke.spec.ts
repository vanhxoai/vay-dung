import { expect, test } from "@playwright/test";

test.describe("with an English-language browser", () => {
  test.use({ locale: "en-US" });

  test("/ still shows Vietnamese (no auto-redirect)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });
});

test("home page is Vietnamese by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("hãy biết bạn thật sự phải trả bao nhiêu");
});

test("English lives under /en and the switcher goes back to Vietnamese", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Tiếng Việt" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});
