import { expect, test, type Page } from "@playwright/test";

type Answers = {
  purpose: string;
  amount: string;
  term?: string;
  urgency: string;
  income: string;
  debt?: string;
  age: string;
  proof: string;
};

const CAN_AFFORD: Answers = {
  purpose: "Mua điện thoại, máy tính, đồ điện tử",
  amount: "20000000",
  urgency: "Trong tháng này",
  income: "15000000",
  age: "28",
  proof: "Lương trả qua ngân hàng",
};

const OVER_BORROWING: Answers = {
  purpose: "Việc khác",
  amount: "50000000",
  term: "24 tháng",
  urgency: "Trong vài ngày tới",
  income: "8000000",
  debt: "3000000",
  age: "25",
  proof: "Lương trả qua ngân hàng",
};

/** The form is disabled until the page's JavaScript is ready. */
async function open(page: Page) {
  await page.goto("/vay");
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
}

async function fillStep1(page: Page, a: Answers) {
  await page.getByText(a.purpose, { exact: true }).click();
  await page.getByLabel("Bạn cần bao nhiêu tiền?").fill(a.amount);
  if (a.term) await page.getByText(a.term, { exact: true }).click();
  await page.getByText(a.urgency, { exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
}

async function fillStep2(page: Page, a: Answers) {
  await page.getByLabel("Thu nhập mỗi tháng của bạn").fill(a.income);
  if (a.debt) await page.getByLabel("Mỗi tháng bạn đang trả nợ bao nhiêu?").fill(a.debt);
  await page.getByLabel("Bạn bao nhiêu tuổi?").fill(a.age);
  await page.getByText(a.proof, { exact: true }).click();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
}

async function complete(page: Page, a: Answers) {
  await open(page);
  await fillStep1(page, a);
  await fillStep2(page, a);
  await expect(page.getByRole("heading", { name: "Kết quả của bạn" })).toBeVisible();
}

test.describe("verdicts", () => {
  test("can afford: 15M income, 20M for a laptop", async ({ page }) => {
    await complete(page, CAN_AFFORD);
    await expect(page.getByTestId("verdict")).toHaveAttribute("data-verdict", "ok");
    await expect(page.getByTestId("offer").first()).toBeVisible();
    // Numbers are in Vietnamese format, with rates carrying their basis.
    await expect(page.getByTestId("offer").first()).toContainText("₫");
    await expect(page.getByTestId("offer").first()).toContainText("/năm");
    await expect(page.getByText("không có nghĩa là bên cho vay chắc chắn duyệt")).toBeVisible();
    await expect(page.getByTestId("disclaimer-short")).toContainText("không bảo đảm bạn sẽ được duyệt");
  });

  test("over-borrowing: a clear 'don't borrow', before any offer, with alternatives", async ({ page }) => {
    await complete(page, OVER_BORROWING);
    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveAttribute("data-verdict", "too_much");
    await expect(verdict).toContainText("Chúng tôi không khuyên bạn vay số tiền này");
    await expect(page.getByRole("heading", { name: "Bạn có thể làm gì thay vào đó" })).toBeVisible();
    // The verdict sits above the first offer on the page.
    const verdictBox = await verdict.boundingBox();
    const offerBox = await page.getByTestId("offer").first().boundingBox();
    expect(verdictBox!.y).toBeLessThan(offerBox!.y);
    // Urgent users get the scam warning.
    await expect(page.getByText("Đang gấp: người đang cần tiền gấp dễ bị lừa")).toBeVisible();
  });

  test("zero income: no recommendation to borrow", async ({ page }) => {
    await complete(page, { ...CAN_AFFORD, income: "0" });
    await expect(page.getByTestId("verdict")).toHaveAttribute("data-verdict", "no_income");
  });
});

test.describe("results page", () => {
  test("always shows the disclaimer, the ranking explanation and sources with dates", async ({ page }) => {
    await complete(page, CAN_AFFORD);
    await expect(page.getByTestId("disclaimer")).toContainText("không phải lời khuyên tài chính");
    await page.getByText("Vì sao có thứ tự này?").click();
    await expect(page.getByText("Không bên nào trả tiền để được xếp trên")).toBeVisible();
    const first = page.getByTestId("offer").first();
    await expect(first.getByRole("link", { name: "Xem nguồn" })).toHaveAttribute("href", /^https:\/\//);
    await expect(first).toContainText("Số liệu cũ nhất được kiểm tra ngày");
  });

  test("changing the term updates the numbers without losing answers", async ({ page }) => {
    await complete(page, { ...CAN_AFFORD, purpose: "Việc khác" });
    const first = page.getByTestId("offer").first();
    const before = await first.textContent();
    await page.getByText("36 tháng", { exact: true }).click();
    await expect(page.getByText("trong 36 tháng.").first()).toBeVisible();
    expect(await page.getByTestId("offer").first().textContent()).not.toEqual(before);
  });

  test("lists products without enough data separately, not in the ranking", async ({ page }) => {
    await complete(page, CAN_AFFORD);
    await expect(page.getByText(/Chưa đủ dữ liệu để so sánh \(\d+\)/)).toBeVisible();
    await expect(page.locator('[data-summary="vietcredit/tin-vay-plus"]')).toHaveCount(0);
  });
});

test.describe("privacy", () => {
  test("nothing the user types is ever sent over the network", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => seen.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`));
    // Distinctive values, so a match can't be a coincidence.
    const a: Answers = { ...CAN_AFFORD, amount: "23456700", income: "17654300", debt: "1234500", age: "31" };
    await complete(page, a);
    await page.getByText("36 tháng", { exact: true }).click();
    await page.waitForTimeout(300);
    const all = seen.join("\n");
    for (const value of ["23456700", "23.456.700", "17654300", "17.654.300", "1234500", "1.234.500"]) {
      expect(all).not.toContain(value);
    }
    expect(seen.filter((s) => s.startsWith("POST"))).toEqual([]);
  });

  test("answers aren't kept in the URL or in storage", async ({ page }) => {
    await complete(page, CAN_AFFORD);
    expect(page.url()).not.toContain("15000000");
    expect(new URL(page.url()).search).toBe("");
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain("15000000");
  });
});

test.describe("input edge cases", () => {
  test("the form can't be used before it's ready, so a tap can't lose answers", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/vay");
    await expect(page.getByRole("button", { name: "Đang tải…" })).toBeDisabled();
    await context.close();
  });

  test("empty fields show errors and don't advance", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Hãy chọn mục đích vay.")).toBeVisible();
    await expect(page.getByText("Hãy nhập số tiền bằng chữ số, ít nhất 1.000.000 ₫.")).toBeVisible();
    await expect(page.getByText("Bước 1/3")).toBeVisible();
  });

  test("non-numeric and huge amounts are rejected; typed amounts are formatted", async ({ page }) => {
    await open(page);
    const amount = page.getByLabel("Bạn cần bao nhiêu tiền?");
    await amount.fill("abc");
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Hãy nhập số tiền bằng chữ số, ít nhất 1.000.000 ₫.")).toBeVisible();
    await amount.fill("99999999999");
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText(/quá lớn/)).toBeVisible();
    await amount.fill("20000000");
    await expect(amount).toHaveValue("20.000.000");
  });

  test("a too-small debt ('3tr' typed as 3) is questioned, not silently accepted", async ({ page }) => {
    await open(page);
    await fillStep1(page, CAN_AFFORD);
    await fillStep2(page, { ...CAN_AFFORD, debt: "3" });
    await expect(page.getByText("Hãy nhập đủ số tiền bằng chữ số").first()).toBeVisible();
    await expect(page.getByText("Bước 2/3")).toBeVisible();
  });

  test("a failed submit moves to the first problem", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Hãy chọn mục đích vay.")).toBeInViewport();
  });

  test("under 18 can't continue", async ({ page }) => {
    await open(page);
    await fillStep1(page, CAN_AFFORD);
    await fillStep2(page, { ...CAN_AFFORD, age: "16" });
    await expect(page.getByText("Bạn cần đủ 18 tuổi để vay tiền.")).toBeVisible();
    await expect(page.getByText("Bước 2/3")).toBeVisible();
  });

  test("the back button keeps answers", async ({ page }) => {
    await open(page);
    await fillStep1(page, CAN_AFFORD);
    await page.getByRole("button", { name: "Quay lại" }).click();
    await expect(page.getByLabel("Bạn cần bao nhiêu tiền?")).toHaveValue("20.000.000");
  });

  test("switching language mid-flow keeps answers and clears the temporary copy", async ({ page }) => {
    await open(page);
    await fillStep1(page, CAN_AFFORD);
    await page.getByLabel("Thu nhập mỗi tháng của bạn").fill("15000000");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/vay/);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByLabel("Your monthly income")).toHaveValue("15.000.000");
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });
});

test.describe("layout on a phone", () => {
  test("nothing overflows sideways", async ({ page }) => {
    await complete(page, CAN_AFFORD);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
