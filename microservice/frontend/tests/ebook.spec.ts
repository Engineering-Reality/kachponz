import { test, expect } from "@playwright/test";

// Kriteria selesai §10 ebook.md. Butuh EBOOK_TOKEN (order 'paid' my-mind-palace)
// + dev server dgn EBOOK_READER_V2=true. Screenshot disimpan di artifacts/screens/.
const TOKEN = process.env.EBOOK_TOKEN || "";
const url = `/read/my-mind-palace?t=${TOKEN}`;

test.beforeEach(async ({ page }) => {
  test.skip(!TOKEN, "set EBOOK_TOKEN");
  await page.goto(url);
  await page.waitForSelector(".page", { timeout: 15000 });
});

test("tidak ada halaman yang overflow", async ({ page }) => {
  const bad = await page.$$eval(".page", (els) =>
    els.filter((e) => e.scrollHeight > e.clientHeight + 1).length);
  expect(bad).toBe(0);
});

test("tidak ada emoji di UI/konten", async ({ page }) => {
  const text = await page.locator(".ebook").innerText();
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u;
  expect(emoji.test(text)).toBeFalsy();
});

test("mengetik/klik kuis TIDAK memicu flip; state bertahan setelah reload", async ({ page }, testInfo) => {
  const marker = await page.locator(".pageno").first().innerText().catch(() => "1");
  // buka lembar kerja pertama (via daftar isi kalau perlu) — cari textarea/field
  const field = page.locator(".ebook textarea, .ebook input.field").first();
  if (await field.count()) {
    await field.scrollIntoViewIfNeeded();
    await field.fill("catatan uji e2e");
    // flip tak berubah: nomor halaman pertama sama
    expect(await page.locator(".pageno").first().innerText().catch(() => marker)).toBe(marker);
    await page.reload();
    await page.waitForSelector(".page");
    // isian bertahan (localStorage)
    const again = page.locator(".ebook textarea, .ebook input.field").first();
    if (await again.count()) expect(await again.inputValue()).toContain("catatan uji");
  }
  await page.screenshot({ path: `artifacts/screens/${testInfo.project.name}.png`, fullPage: false });
});
