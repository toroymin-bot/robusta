/**
 * D-D15-2 / C-D16-4 (Day 4 23시 슬롯, 2026-04-29) — Playwright config.
 *   tests/ 디렉토리에 박힘 — main tsconfig는 tests/ 전체 exclude로 typecheck 격리.
 *   testDir = "." (이 파일 기준 = tests/).
 *   본 슬롯에서는 devDep만 박음 — npm install 시점에 활성화.
 *
 * 실행:
 *   npm i -D @playwright/test@^1.48.0
 *   npx playwright install chromium
 *   BASE_URL=https://robusta-tau.vercel.app npx playwright test --config=tests/playwright.config.ts
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [["list"]],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
