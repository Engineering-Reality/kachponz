import { test, expect } from "@playwright/test";

// Kriteria selesai Bagian 1 & E-Book Reader V2.
// Butuh EBOOK_TOKEN (order 'paid' my-mind-palace) + dev server dgn EBOOK_READER_V2=true.
const TOKEN = process.env.EBOOK_TOKEN || "";
const url = `/read/my-mind-palace?t=${TOKEN}`;

test.beforeEach(async ({ page }) => {
  test.skip(!TOKEN, "set EBOOK_TOKEN untuk menjalankan E2E");
  await page.goto(url);
  await page.waitForSelector(".page", { timeout: 15000 });
});

test("anti-overflow: elemen konten terakhir tidak melewati batas bawah halaman", async ({ page }) => {
  const badPages = await page.$$eval(".page", (pages) => {
    const overflows: number[] = [];
    pages.forEach((p, idx) => {
      const pageRect = p.getBoundingClientRect();
      const content = p.querySelector(".page-content") || p;
      const children = Array.from(content.children);
      if (children.length > 0) {
        const lastChild = children[children.length - 1];
        const lastRect = lastChild.getBoundingClientRect();
        // Cek apakah tepi bawah elemen konten melewati batas bawah container halaman (+ 1px toleransi subpixel)
        if (lastRect.bottom > pageRect.bottom + 1.5) {
          overflows.push(idx);
        }
      }
    });
    return overflows;
  });

  expect(badPages, `Ditemukan overflow pada halaman indeks: ${badPages.join(", ")}`).toEqual([]);
});

test("tidak ada emoji mentah di UI maupun konten e-book", async ({ page }) => {
  const text = await page.locator(".ebook").innerText();
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u;
  expect(emoji.test(text)).toBeFalsy();
});

test("mengetik/klik kuis TIDAK memicu flip; state bertahan setelah reload", async ({ page }, testInfo) => {
  const marker = await page.locator(".pageno").first().innerText().catch(() => "1");
  const field = page.locator(".ebook textarea, .ebook input.field").first();
  if (await field.count()) {
    await field.scrollIntoViewIfNeeded();
    await field.fill("catatan uji e2e anti-overflow");
    expect(await page.locator(".pageno").first().innerText().catch(() => marker)).toBe(marker);
    await page.reload();
    await page.waitForSelector(".page");
    const again = page.locator(".ebook textarea, .ebook input.field").first();
    if (await again.count()) {
      expect(await again.inputValue()).toContain("catatan uji");
    }
  }
  await page.screenshot({ path: `artifacts/screens/${testInfo.project.name}.png`, fullPage: false });
});
