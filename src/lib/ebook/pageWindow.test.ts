// Test logika server tanpa framework: jalankan `node --test src/lib/ebook/*.test.ts`.
import test from "node:test";
import assert from "node:assert/strict";
import { pageWindow, needsFetch } from "./pageWindow.ts";

test("pageWindow: clamp ke [1, pageCount]", () => {
  assert.deepEqual(pageWindow(1, 50, 10), { from: 1, to: 11 });
  assert.deepEqual(pageWindow(50, 50, 10), { from: 40, to: 50 });
});
test("pageWindow: berpusat di halaman aktif", () => {
  assert.deepEqual(pageWindow(25, 50, 10), { from: 15, to: 35 });
});
test("pageWindow: aktif di luar batas ikut ter-clamp", () => {
  assert.deepEqual(pageWindow(999, 50, 10), { from: 40, to: 50 });
  assert.deepEqual(pageWindow(0, 50, 10), { from: 1, to: 11 });
});
test("needsFetch: true bila ada halaman jendela belum dimuat", () => {
  assert.equal(needsFetch(5, new Set([1, 2, 3]), 50, 5), true);
});
test("needsFetch: false bila seluruh jendela sudah dimuat", () => {
  const loaded = new Set<number>();
  for (let p = 1; p <= 11; p++) loaded.add(p);
  assert.equal(needsFetch(1, loaded, 50, 10), false);
});
