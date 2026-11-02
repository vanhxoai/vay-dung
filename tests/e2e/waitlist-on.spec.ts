import { expect, test } from "@playwright/test";

/**
 * Checks the waitlist form works for when it's switched on. Run with:
 *   npm run test:e2e:waitlist
 * No real provider is involved: the signup request is intercepted in the browser.
 */
test.skip(process.env.WAITLIST_ENABLED !== "true", "the waitlist is off by default");

test("the consent box starts unticked, and both fields are required", async ({ page }) => {
  await page.goto("/");
  const form = page.getByTestId("waitlist-form");
  await expect(form.getByRole("checkbox", { checked: false }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await form.getByRole("button", { name: "Đăng ký nhận tin" }).click();
  await expect(form.getByText("Hãy nhập một địa chỉ email hợp lệ.")).toBeVisible();
  await expect(form.getByText("Bạn cần đánh dấu ô đồng ý")).toBeVisible();
});

test("the consent text says who, why, where, how long, and how to withdraw", async ({ page }) => {
  await page.goto("/");
  const form = page.getByTestId("waitlist-form");
  for (const text of ["chjopchjop1210@gmail.com", "chỉ cho mục đích đó", "ngoài Việt Nam", "12 tháng", "rút lại đồng ý"]) {
    await expect(form).toContainText(text);
  }
  await expect(form.getByRole("link", { name: "Xem chính sách quyền riêng tư" })).toHaveAttribute("href", "/rieng-tu");
});

test("a signup sends only the email and consent record", async ({ page }) => {
  let sent: unknown = null;
  await page.route("**/api/waitlist", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByLabel("Email của bạn").fill("a@example.com");
  await page.getByTestId("waitlist-form").getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Đăng ký nhận tin" }).click();
  await expect(page.getByTestId("waitlist-done")).toBeVisible();
  expect(sent).toEqual({ email: "a@example.com", consent: true, consentVersion: "2026-11-02", locale: "vi" });
});

test("a failed signup says so, and the server reports no store configured as unavailable", async ({ page, request }) => {
  const res = await request.post("/api/waitlist", {
    data: { email: "a@example.com", consent: true, consentVersion: "2026-11-02", locale: "vi" },
  });
  expect(res.status()).toBe(503);
  expect((await request.post("/api/waitlist", { data: { email: "a@example.com", consent: false } })).status()).toBe(400);

  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByLabel("Email của bạn").fill("a@example.com");
  await page.getByTestId("waitlist-form").getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Đăng ký nhận tin" }).click();
  await expect(page.getByText("Chưa gửi được.")).toBeVisible();
});
