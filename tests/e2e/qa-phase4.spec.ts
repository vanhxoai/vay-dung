import { expect, test, type Page } from "@playwright/test";

const NAME = "Tên bên cho vay, ứng dụng hoặc trang web";

async function open(page: Page, path = "/kiem-tra") {
  await page.goto(path);
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
}
async function check(page: Page, name: string) {
  await open(page);
  await page.getByLabel(NAME).fill(name);
  await page.locator("form button[type=submit]").click();
  return page.getByTestId("safety-result");
}

test.describe("real names people type", () => {
  const licensed: [string, string][] = [
    ["fe credit", "FE Credit"], ["FECREDIT", "FE Credit"], ["vp bank", "VPBank"], ["VPBANK", "VPBank"],
    ["Techcombank", "Techcombank"], ["MSB", "Hàng Hải"], ["mb", "MB"], ["MB Bank", "MB"], ["TP Bank", "TPBank"],
    ["tpb.vn", "TPBank"], ["https://www.fecredit.com.vn/vay", "FE Credit"], ["Ngân hàng Quân đội", "Quân đội"],
    ["ngan hang quan doi", "Quân đội"], ["Vietcombank", "Ngoại thương"], ["VCB", "Ngoại thương"], ["Sacombank", "Sài Gòn Thương Tín"],
    ["Agribank", "Nông nghiệp"], ["Home Credit Việt Nam", "Home Credit"], ["công ty tài chính home credit", "Home Credit"],
  ];
  for (const [typed] of licensed) {
    test(`"${typed}" is found`, async ({ page }) => {
      const r = await check(page, typed);
      await expect(r).toHaveAttribute("data-name-kind", "licensed");
    });
  }

  // Regression: the real name plus "VN" or "ngân hàng" used to come back as "similar".
  for (const typed of ["home credit vn", "ngân hàng mb"]) {
    test(`"${typed}" should be found, not "similar"`, async ({ page }) => {
      const r = await check(page, typed);
      await expect(r).toHaveAttribute("data-name-kind", "licensed");
    });
  }

  // Regression: a generic word was called "similar" to a real lender (Credit ~ MCredit, Finance ~ SFinance).
  for (const typed of ["Credit", "Finance"]) {
    test(`"${typed}" alone must not point at one specific lender`, async ({ page }) => {
      const r = await check(page, typed);
      await expect(r).toHaveAttribute("data-name-kind", "not_found");
    });
  }

  // Regression: "Shinhan" is a bank AND a finance company; we used to show only the bank.
  test("ambiguous brand 'Shinhan' should not be a single confident match", async ({ page }) => {
    const r = await check(page, "Shinhan");
    await expect(r).not.toHaveAttribute("data-name-kind", "licensed");
  });
});

test.describe("stale result", () => {
  // Regression: editing the name used to leave a "licensed" result beside a different name.
  test("result clears or is marked out of date once the name is edited", async ({ page }) => {
    const r = await check(page, "Home Credit");
    await expect(r).toHaveAttribute("data-name-kind", "licensed");
    await page.getByLabel(NAME).fill("Tiền Ơi");
    await expect(page.getByTestId("safety-result")).toHaveCount(0);
  });

  test("re-checking after a change updates the result", async ({ page }) => {
    const r = await check(page, "Home Credit");
    await expect(r).toHaveAttribute("data-name-kind", "licensed");
    await page.getByLabel(NAME).fill("Tiền Ơi");
    await page.getByText("Xin mã OTP", { exact: false }).first().click();
    await page.locator("form button[type=submit]").click();
    await expect(r).toHaveAttribute("data-name-kind", "not_found");
    await expect(r).toHaveAttribute("data-level", "stop");
    await page.locator("form").getByText("Xin mã OTP").click();
    await page.locator("form button[type=submit]").click();
    await expect(r).toHaveAttribute("data-level", "careful");
  });
});

test.describe("odd input", () => {
  for (const v of ["<b>x</b>", "😀😀", "123", "a"]) {
    test(`${JSON.stringify(v)} is shown as plain text and gives "not found"`, async ({ page }) => {
      const r = await check(page, v);
      await expect(r).toHaveAttribute("data-name-kind", "not_found");
      await expect(r.locator("b")).toHaveCount(0);
    });
  }

  test("120+ characters are capped at 120 without breaking the layout", async ({ page }) => {
    await open(page);
    await page.getByLabel(NAME).fill("x".repeat(300));
    expect(await page.getByLabel(NAME).inputValue()).toHaveLength(120);
    await page.locator("form button[type=submit]").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("phone usability", () => {
  test("after tapping Kiểm tra the result heading is focused and on screen", async ({ page }) => {
    const r = await check(page, "Home Credit");
    const h = r.getByRole("heading", { name: "Kết quả kiểm tra" });
    await expect(h).toBeFocused();
    await expect(h).toBeInViewport();
  });

  test("every checkbox row and link is at least 44px tall", async ({ page }) => {
    await open(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("form label:has(input[type=checkbox]), main a, form button")]
        .map((e) => Math.round(e.getBoundingClientRect().height))
        .filter((h) => h > 0 && h < 44),
    );
    expect(small).toEqual([]);
  });

  test("keyboard: Tab to a sign, Space ticks it, Enter in the name field submits", async ({ page }) => {
    await open(page);
    await page.getByLabel(NAME).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(page.locator("form input[type=checkbox]").first()).toBeChecked();
    await page.getByLabel(NAME).fill("vpbank");
    await page.getByLabel(NAME).press("Enter");
    await expect(page.getByTestId("safety-result")).toBeVisible();
  });

  test("no sideways scroll at 320px, with a long result", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await page.getByLabel(NAME).fill("https://www.fecredit.com.vn/vay/" + "a".repeat(80));
    await page.locator("form button[type=submit]").click();
    await expect(page.getByTestId("safety-result")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("links into the check", () => {
  test("home page links to /kiem-tra (vi and en)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Kiểm tra một bên cho vay hoặc ứng dụng" }).click();
    await expect(page).toHaveURL(/\/kiem-tra$/);
    await page.goto("/en");
    await page.getByRole("link", { name: "Check a lender or app" }).click();
    await expect(page).toHaveURL(/\/en\/kiem-tra$/);
  });

  test("language switch on the page keeps you on the check page", async ({ page }) => {
    await open(page, "/en/kiem-tra");
    await page.getByRole("link", { name: "Tiếng Việt" }).click();
    await expect(page).toHaveURL(/localhost:3100\/kiem-tra$/);
    await expect(page.getByRole("heading", { level: 1, name: "Kiểm tra bên cho vay" })).toBeVisible();
  });
});
