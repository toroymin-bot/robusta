/**
 * playwright.config.ts (root)
 *   - C-D26-5 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-5.
 *
 * Mock LLM e2e 전용 — verify-mock-llm.spec.ts 1 케이스.
 *   tests/playwright.config.ts (verify-live BASE_URL=Vercel) 와 분리.
 *   본 config 는 webServer 가 next dev 를 띄우고 ROBUSTA_TEST_MODE=true 주입 → mock LLM 분기 활성.
 *
 * 실행: pnpm e2e:mock (또는 npx playwright test).
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/mock",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "pnpm next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ROBUSTA_TEST_MODE: "true",
      NODE_ENV: "development",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium-mock",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
