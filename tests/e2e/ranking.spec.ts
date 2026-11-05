import { expect, test, type Page } from "@playwright/test";

async function results(page: Page, income = "15000000", proof = "Lương trả qua ngân hàng") {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  await page.getByText("Việc khác", { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill("20000000");
  await page.getByText("24 tháng", { exact: true }).click();
  await page.getByText("Trong tháng này", { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(income);
  await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill("0");
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill("28");
  await page.getByText(proof, { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.getByTestId("verdict")).toBeVisible();
}

const rows = (page: Page) =>
  page.getByTestId("summary-table").locator("[data-summary]").evaluateAll((els) => els.map((e) => e.getAttribute("data-summary") ?? ""));

test.describe("the results table", () => {
  test("lists every ranked loan, with a card for only the first few until asked", async ({ page }) => {
    await results(page);
    const keys = await rows(page);
    expect(keys.length).toBeGreaterThan(20);
    await expect(page.getByTestId("offer")).toHaveCount(5);
    await page.getByRole("button", { name: /Xem chi tiết cả/ }).click();
    await expect(page.getByTestId("offer")).toHaveCount(keys.length);
  });

  test("tapping a row opens that loan's card", async ({ page }) => {
    await results(page);
    const key = (await rows(page)).at(-1) as string;
    await page.locator(`[data-summary="${key}"] button`).click();
    await expect(page.locator(`[data-offer="${key}"]`)).toBeInViewport();
  });

  test("the borrower can sort by monthly payment", async ({ page }) => {
    await results(page);
    const before = await rows(page);
    await page.getByTestId("sort").selectOption("monthly");
    const after = await rows(page);
    expect(after).not.toEqual(before);
    expect([...after].sort()).toEqual([...before].sort());
  });

  test("hiding other sources leaves only the lender's own figures", async ({ page }) => {
    await results(page);
    const before = await rows(page);
    await page.getByTestId("official-only").check();
    const after = await rows(page);
    expect(after.length).toBeLessThan(before.length);
    await expect(page.getByTestId("summary-table")).not.toContainText("Nguồn: trang so sánh");
    await expect(page.getByTestId("summary-table")).not.toContainText("Nguồn: báo chí");
  });

  test("a figure from a comparison site says so on its card", async ({ page }) => {
    await results(page);
    await page.locator('[data-summary="techcombank/vay-tieu-dung-tin-chap-tra-gop"] button').click();
    const card = page.locator('[data-offer="techcombank/vay-tieu-dung-tin-chap-tra-gop"]');
    await expect(card.getByTestId("rate-source")).toContainText("trang so sánh");
    await expect(card.getByTestId("rate-source")).toContainText("Có thể cũ hoặc sai");
  });

  test("'from X%' loans sit under their own heading and read as a minimum", async ({ page }) => {
    await results(page);
    await expect(page.getByTestId("summary-table")).toContainText("Chỉ biết mức thấp nhất");
    await page.locator('[data-summary="vpbank/vpbank-vay-tin-chap-khach-hang-hien-huu"] button').click();
    const card = page.locator('[data-offer="vpbank/vpbank-vay-tin-chap-khach-hang-hien-huu"]');
    await expect(card).toContainText("trả ít nhất khoảng");
    await expect(card).toContainText("từ 16%/năm");
  });

  test("each card explains its position from the borrower's answers, and shows a schedule", async ({ page }) => {
    await results(page);
    const card = page.getByTestId("offer").first();
    await card.getByText("Vì sao có khoản này, ở vị trí này?").click();
    await expect(card.getByTestId("why-rank")).toContainText("thu nhập của bạn");
    await card.getByText("Xem lịch trả từng tháng").click();
    await expect(card.getByTestId("schedule").locator("tbody tr")).toHaveCount(24);
  });

  test("saying income papers are hard moves loans that ask for them down", async ({ page }) => {
    await results(page);
    const withPapers = await rows(page);
    await results(page, "15000000", "Hiện chưa có giấy tờ chứng minh");
    const without = await rows(page);
    expect(without).not.toEqual(withPapers);
  });
});

test.describe("the public explanation", () => {
  test("says how ranking works and what each answer does", async ({ page }) => {
    await page.goto("/cach-xep-hang");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("xếp hạng");
    const table = page.getByTestId("inputs-table");
    await expect(table.locator("tbody tr")).toHaveCount(8);
    await expect(table.getByRole("row", { name: /Khi nào cần tiền/ })).toContainText("Không");
    await expect(page.locator("main")).toContainText("Không bên nào trả tiền để được xếp trên");
  });

  test("is reachable from the results, the home page and the footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main").getByRole("link", { name: /xếp hạng khoản vay/ })).toHaveAttribute("href", "/cach-xep-hang");
    await expect(page.locator("footer").getByRole("link", { name: "Cách xếp hạng" })).toBeVisible();
    await results(page);
    await expect(page.locator("#offers").getByRole("link", { name: "Xem đầy đủ cách xếp hạng" })).toBeVisible();
  });

  test("the data page shows sources and offers the download", async ({ page }) => {
    await page.goto("/du-lieu");
    await expect(page.locator('[data-data-row="techcombank/vay-tieu-dung-tin-chap-tra-gop"]')).toContainText("Nguồn: trang so sánh");
    const csv = await page.request.get("/data/loan-rates.csv");
    expect(csv.ok()).toBe(true);
    expect(await csv.text()).toContain("techcombank/vay-tieu-dung-tin-chap-tra-gop");
  });

  test("every page says this is a student project", async ({ page }) => {
    for (const path of ["/", "/vay", "/kiem-tra", "/rieng-tu", "/cach-xep-hang", "/du-lieu", "/en"]) {
      await page.goto(path);
      await expect(page.getByTestId("project-banner")).toBeVisible();
    }
  });
});
