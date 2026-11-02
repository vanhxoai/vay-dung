import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("leads to the questionnaire and the lender check", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("hãy biết bạn thật sự phải trả bao nhiêu");
    await expect(page.getByRole("link", { name: /Bắt đầu/ })).toHaveAttribute("href", "/vay");
    await expect(page.getByRole("link", { name: "Kiểm tra một bên cho vay hoặc ứng dụng" })).toHaveAttribute("href", "/kiem-tra");
  });

  test("the example comes from the cost engine: 1.5%/month flat over 24 months", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("main").textContent();
    expect(text).toContain("vay 24 triệu trong 24 tháng");
    expect(text).toContain("trả tổng cộng 32,6 triệu");
    expect(text).toContain("khoảng 31,5%/năm");
  });

  test("every page shows the not-advice line and a privacy link", async ({ page }) => {
    for (const path of ["/", "/vay", "/kiem-tra", "/rieng-tu"]) {
      await page.goto(path);
      await expect(page.locator("footer")).toContainText("không phải lời khuyên tài chính");
      await expect(page.locator("footer").getByRole("link", { name: "Quyền riêng tư" })).toHaveAttribute("href", "/rieng-tu");
    }
  });

  test("works in English, with no sideways overflow on a phone", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("know what you'll really have to pay");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("waitlist is off until a lawyer has answered", () => {
  test.skip(process.env.WAITLIST_ENABLED === "true", "covered by waitlist-on.spec.ts");

  test("the page has no email field and says so", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("waitlist")).toContainText("Hiện chúng tôi không thu thập email");
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test("the server refuses signups, even a valid one", async ({ request }) => {
    const res = await request.post("/api/waitlist", {
      data: { email: "a@example.com", consent: true, consentVersion: "2026-11-02", locale: "vi" },
    });
    expect(res.status()).toBe(503);
  });

  test("the privacy notice says no emails are collected", async ({ page }) => {
    await page.goto("/rieng-tu");
    await expect(page.locator("main")).toContainText("hiện chúng tôi không thu thập email");
  });
});

test.describe("privacy notice", () => {
  test("names who runs the site, what stays on the device, analytics and rights", async ({ page }) => {
    await page.goto("/rieng-tu");
    const main = page.locator("main");
    await expect(main).toContainText("chjopchjop1210@gmail.com");
    await expect(main).toContainText("chỉ được xử lý ngay trên máy của bạn");
    await expect(main).toContainText("Vercel Web Analytics");
    await expect(main).toContainText("không dùng cookie");
    await expect(main).toContainText("rút lại đồng ý");
  });
});

test.describe("analytics", () => {
  test("only fixed step names are sent: nothing typed, and no verdict", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { va: (...a: unknown[]) => void; __calls: unknown[][] };
      w.__calls = [];
      w.va = (...a) => w.__calls.push(a);
    });
    await page.goto("/vay");
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    await page.getByText("Việc khác", { exact: true }).click();
    await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("23456700");
    await page.getByText("Trong tháng này", { exact: true }).click();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.getByLabel("Thu nhập mỗi tháng của bạn").fill("17654300");
    await page.getByLabel("Bạn bao nhiêu tuổi?").fill("31");
    await page.getByText("Lương trả qua ngân hàng", { exact: true }).click();
    await page.getByRole("button", { name: "Xem kết quả" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả của bạn" })).toBeVisible();

    const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
    expect(calls).toEqual([
      ["pageview", { path: "/vay/buoc-2" }],
      ["pageview", { path: "/vay/ket-qua" }],
    ]);
    expect(new URL(page.url()).pathname).toBe("/vay");
  });
});
