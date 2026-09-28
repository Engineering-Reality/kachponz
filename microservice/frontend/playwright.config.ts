import { defineConfig, devices } from "@playwright/test";

// Jalankan: EBOOK_TOKEN=<token> BASE_URL=http://localhost:3000 npx playwright test
// (perlu `npx playwright install chromium` + dev server hidup dengan EBOOK_READER_V2=true)
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || "http://localhost:3000" },
  projects: [
    { name: "desktop-light-1440", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "desktop-dark-1280", use: { viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
    { name: "mobile-light-390", use: { ...devices["iPhone 13"], colorScheme: "light" } },
    { name: "mobile-dark-360", use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, colorScheme: "dark" } },
  ],
});
