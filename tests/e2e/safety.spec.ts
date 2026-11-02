import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/kiem-tra");
  await expect(page.getByRole("button", { name: "Kiểm tra", exact: true })).toBeEnabled();
}

async function check(page: Page, name: string, signs: string[] = []) {
  await open(page);
  await page.getByLabel("Tên bên cho vay, ứng dụng hoặc trang web").fill(name);
  for (const s of signs) await page.getByText(s).first().click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  return page.getByTestId("safety-result");
}

test.describe("Phase 4 checkpoint: 3 licensed lenders", () => {
  for (const [name, legal] of [
    ["Home Credit", "Công ty Tài chính TNHH MTV Home Credit Việt Nam"],
    ["vpbank", "Ngân hàng TMCP Việt Nam Thịnh Vượng"],
    ["FE Credit", "Công ty Tài chính TNHH Ngân hàng Việt Nam Thịnh Vượng SMBC"],
  ]) {
    test(`${name} is on the list, with its legal name, source and a caution`, async ({ page }) => {
      const r = await check(page, name);
      await expect(r).toHaveAttribute("data-name-kind", "licensed");
      await expect(r).toContainText("Tên này khớp với một bên có trong danh sách của Ngân hàng Nhà nước");
      await expect(r).toContainText(legal);
      await expect(r).toContainText("Kẻ lừa đảo có thể mạo danh");
      await expect(r.getByRole("link", { name: "Xem danh sách của Ngân hàng Nhà nước" })).toHaveAttribute("href", /sbv\.gov\.vn/);
      await expect(r).toContainText("không có nghĩa là khoản vay an toàn");
      await expect(r).not.toContainText(/uy tín|đáng tin/i);
    });
  }
});

test.describe("Phase 4 checkpoint: 3 made-up names", () => {
  for (const name of ["Rồng Vàng Credit", "Tiền Nhanh Plus", "Vay Siêu Tốc Xanh"]) {
    test(`${name} is "not found", never "unlicensed" or "scam"`, async ({ page }) => {
      const r = await check(page, name);
      await expect(r).toHaveAttribute("data-name-kind", "not_found");
      await expect(r).toContainText("Không tìm thấy tên này trong dữ liệu chúng tôi lấy từ Ngân hàng Nhà nước");
      await expect(r).toContainText("không có nghĩa là họ không có giấy phép hoặc là lừa đảo");
      await expect(r).toHaveAttribute("data-level", "careful");
    });
  }
});

test.describe("impersonation and warning signs", () => {
  test("a look-alike name points at the real lender", async ({ page }) => {
    const r = await check(page, "Home Credlt");
    await expect(r).toHaveAttribute("data-name-kind", "similar");
    await expect(r).toContainText("Home Credit");
  });

  test("a real lender's name plus a high sign says stop, with sources", async ({ page }) => {
    const r = await check(page, "Home Credit", ["Bắt tôi chuyển khoản trước"]);
    await expect(r).toHaveAttribute("data-level", "stop");
    await expect(page.getByTestId("safety-stop")).toContainText("Hãy dừng lại");
    await expect(r).toContainText("Chúng tôi không thể kết luận đây là lừa đảo");
    await expect(r.getByRole("link", { name: /Công an/ }).first()).toHaveAttribute("href", /^https:\/\//);
  });

  test("signs work with no name; nothing at all shows an error", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(page.getByText("Hãy nhập tên hoặc chọn ít nhất một dấu hiệu.")).toBeVisible();
    await page.getByText("Xin mã OTP").click();
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(page.getByTestId("safety-result")).toHaveAttribute("data-level", "stop");
  });

  test("what to do if you've already paid is always shown", async ({ page }) => {
    const r = await check(page, "Tiền Nhanh Plus");
    await expect(r).toContainText("Nếu bạn đã chuyển tiền");
    await expect(r).toContainText("cơ quan công an gần nhất");
  });
});

test("changing the name or a sign clears the old result, so it can't seem to apply to the new answer", async ({ page }) => {
  const r = await check(page, "Home Credit");
  await expect(r).toBeVisible();
  await page.getByLabel("Tên bên cho vay, ứng dụng hoặc trang web").fill("Tiền Ơi");
  await expect(page.getByTestId("safety-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.getByTestId("safety-result")).toHaveAttribute("data-name-kind", "not_found");
  await page.getByText("Xin mã OTP").click();
  await expect(page.getByTestId("safety-result")).toHaveCount(0);
});

test("someone who may be in a scam isn't sent on to the loan flow", async ({ page }) => {
  const r = await check(page, "Home Credit", ["Xin mã OTP"]);
  await expect(r).toBeVisible();
  await expect(r.getByRole("link", { name: "Xem chi phí thật của khoản vay" })).toHaveCount(0);
});

test("a phone number says it wasn't checked", async ({ page }) => {
  const r = await check(page, "0912 345 678");
  await expect(r).toHaveAttribute("data-name-kind", "phone");
  await expect(r).toContainText("không kiểm tra được số điện thoại");
});

test("nothing typed on this page goes over the network", async ({ page }) => {
  const seen: string[] = [];
  page.on("request", (r) => seen.push(`${r.url()} ${r.postData() ?? ""}`));
  await check(page, "ZzTenBiMat123");
  await page.waitForTimeout(300);
  expect(seen.join("\n")).not.toContain("ZzTenBiMat123");
});

test.describe("English", () => {
  test("works at /en/kiem-tra", async ({ page }) => {
    await page.goto("/en/kiem-tra");
    await expect(page.getByRole("button", { name: "Check", exact: true })).toBeEnabled();
    await page.getByLabel("Lender, app or website name").fill("Home Credit");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByTestId("safety-result")).toContainText("This name matches an institution on the State Bank of Vietnam's list");
  });
});

test("the home page links to the check; no sideways overflow on a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Kiểm tra một bên cho vay hoặc ứng dụng" }).click();
  await expect(page.getByRole("heading", { name: "Kiểm tra bên cho vay" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kiểm tra", exact: true })).toBeEnabled();
  await page.getByLabel("Tên bên cho vay, ứng dụng hoặc trang web").fill("Tiền Nhanh Plus");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
