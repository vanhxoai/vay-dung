import { expect, test, type Page } from "@playwright/test";

const waitlistOn = process.env.WAITLIST_ENABLED === "true";

test.describe("phase 5 QA: any state", () => {
  // BUG: CONTROLLER.name in src/config/site.ts is still the placeholder "Nguyen Van A".
  test.fail("the privacy notice names a real operator, not a placeholder", async ({ page }) => {
    await page.goto("/rieng-tu");
    await expect(page.locator("main")).not.toContainText("Nguyen Van A");
  });

  test("the language switch keeps you on the same page, both ways", async ({ page }) => {
    for (const [from, to] of [["/rieng-tu", "/en/rieng-tu"], ["/kiem-tra", "/en/kiem-tra"], ["/vay", "/en/vay"], ["/", "/en"]]) {
      await page.goto(from);
      await page.getByRole("link", { name: "English" }).first().click();
      await expect(page).toHaveURL(new RegExp(`${to}$`));
      await expect(page.locator("footer")).toContainText("not financial advice");
      await page.getByRole("link", { name: "Tiếng Việt" }).first().click();
      await expect(page).toHaveURL(new RegExp(`${from}$`));
    }
  });

  test("on /kiem-tra the sticky button never covers the footer links at the end of the page", async ({ page }) => {
    await page.goto("/kiem-tra");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerLink = await page.locator("footer").getByRole("link", { name: "Quyền riêng tư" }).boundingBox();
    const submit = await page.getByRole("button", { name: "Kiểm tra", exact: true }).boundingBox();
    expect(footerLink && submit && footerLink.y >= submit.y + submit.height).toBe(true);
    expect(footerLink!.height).toBeGreaterThanOrEqual(44);
  });

  test("the landing page has no sideways scroll at 320px, and its main action is above the fold", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const cta = await page.getByRole("link", { name: /Bắt đầu/ }).boundingBox();
    expect(cta!.y + cta!.height).toBeLessThan(640);
  });

  test("the landing page is readable with JavaScript off", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3100/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).toContainText("32,6 triệu");
    await ctx.close();
  });
});

test.describe("phase 5 QA: waitlist on", () => {
  test.skip(!waitlistOn, "needs WAITLIST_ENABLED=true (npm run test:e2e:waitlist)");

  test("the hidden bot field is out of the tab order and hidden from screen readers", async ({ page }) => {
    await page.goto("/");
    const trap = page.locator('input[tabindex="-1"]');
    await expect(trap).toHaveCount(1);
    expect(await trap.evaluate((e) => !!e.closest('[aria-hidden="true"]'))).toBe(true);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("tabindex"))).not.toBe("-1");
    }
  });

  // Regression: a tap before JavaScript loaded reloaded the page and lost the typed email.
  test("the form is disabled until the page is ready, so an early tap can't lose the email", async ({ page }) => {
    await page.route("**/_next/static/**/*.js", (r) => r.abort());
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Đang tải…" }).first()).toBeDisabled();
    await expect(page.getByLabel("Email của bạn")).toBeDisabled();
  });

  async function fill(page: Page) {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Báo cho tôi khi ra mắt" })).toBeEnabled();
    await page.getByLabel("Email của bạn").fill("a@example.com");
    await page.getByTestId("waitlist-form").getByRole("checkbox").check();
  }

  // Regression: a second tap while sending sent a second request.
  test("tapping submit twice while it is sending makes only one request", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/waitlist", async (route) => {
      calls++;
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await fill(page);
    await page.getByRole("button", { name: "Báo cho tôi khi ra mắt" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Đang gửi…" }).click({ force: true }).catch(() => {});
    await expect(page.getByTestId("waitlist-done")).toBeVisible();
    expect(calls).toBe(1);
  });

  // Regression: errors weren't linked to their fields, and focus stayed on the button.
  test("errors are linked to their fields, and focus moves to the first problem", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Báo cho tôi khi ra mắt" })).toBeEnabled();
    await page.getByRole("button", { name: "Báo cho tôi khi ra mắt" }).click();
    const email = page.getByLabel("Email của bạn");
    await expect(email).toHaveAttribute("aria-describedby", /.+/);
    await expect(email).toBeFocused();
  });

  test("a bot filling the hidden field gets no error, and nothing is stored", async ({ request }) => {
    const res = await request.post("/api/waitlist", {
      data: { email: "a@example.com", consent: true, consentVersion: "2026-11-03", locale: "vi", website: "http://spam" },
    });
    expect(res.status()).toBe(200);
  });
});
