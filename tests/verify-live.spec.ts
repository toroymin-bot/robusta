/**
 * D-D15-2 / C-D16-4 (Day 4 23시 슬롯, 2026-04-29) — Playwright verify-live.
 *
 * 시나리오 (똘이 v12 §24.8 C-D16-4):
 *   A: 첫 방문 → BYOK. /가 200 + /getting-started/byok 200 + BYOK heading 박힘.
 *   B: 헤더 모드 라벨. data-test=header-mode-label 본문 = /Day [1-5] · (Manual|Live)/.
 *   C: og 메타. <meta property="og:image"> = '.../og.png'.
 *
 * BASE_URL env (기본 https://robusta-tau.vercel.app), timeout 30s, retries 1.
 *
 * 실행 (CI):
 *   npm i -D @playwright/test@^1.48.0
 *   npx playwright install chromium
 *   BASE_URL=https://robusta-tau.vercel.app npx playwright test
 *
 * 본 슬롯에서는 npm install 미실행 — devDep 추가만. typecheck는 tsconfig exclude로 격리.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://robusta-tau.vercel.app";

test.describe("verify-live (Robusta D5 사전 검증)", () => {
  test("A: 홈 + BYOK 페이지 200 + heading", async ({ page }) => {
    const homeResp = await page.goto(`${BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    expect(homeResp?.status(), "home 200").toBe(200);

    const byokResp = await page.goto(`${BASE_URL}/getting-started/byok`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    expect(byokResp?.status(), "byok 200").toBe(200);

    const heading = page.locator("h1");
    await expect(heading).toContainText(/BYOK/);
  });

  test("B: 헤더 모드 라벨 = Day [1-5] · (Manual|Live)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const label = page.locator('[data-test="header-mode-label"]');
    await expect(label).toBeVisible();
    await expect(label).toHaveText(/Day [1-5] · (Manual|Live)/);
  });

  test("C: og:image meta 박힘", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImage).toBeTruthy();
    expect(ogImage!.endsWith("/og.png")).toBe(true);
  });
});
