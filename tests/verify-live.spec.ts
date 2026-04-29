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

/**
 * D-D17-5 (Day 5 03시 슬롯, 2026-04-30) C-D17-5: 모바일 375x667 회귀 가드.
 *   똘이 v1 §6.4 채택 — 헤더 도구 4개(모드/턴/다크/Keys)가 모바일 좁을 때 줄바꿈 없음을 가드.
 *   추정 #90 측정 — 헤더 라벨 box.height ≤ 20px 이면 한 줄 nowrap.
 *   data-test="add-participant"는 participants-panel 좌측 패널 — 모바일에서도 36px 이하 가드.
 */
test.describe("verify-live (모바일 375x667 회귀 가드)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("D: 헤더 모드 라벨 nowrap (한 줄 유지)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const label = page.locator('[data-test="header-mode-label"]');
    await expect(label).toBeVisible();
    const box = await label.boundingBox();
    if (!box) throw new Error("header-mode-label not laid out");
    // 한 줄 nowrap 가드 — text-xs(12px) * line-height(1.5≈18px) ± 여유 4px = 22px 이내.
    expect(box.height, "label height ≤ 22px (single line)").toBeLessThanOrEqual(22);
  });

  test("E: 참여자 추가 버튼 nowrap (단일 줄, 36px 이내)", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const btn = page.locator('[data-test="add-participant"]');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    if (!box) throw new Error("add-participant not laid out");
    expect(box.height, "add-participant height ≤ 36px (single line)").toBeLessThanOrEqual(36);
  });
});
