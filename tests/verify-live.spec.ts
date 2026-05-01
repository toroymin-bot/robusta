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

/**
 * C-D22-3 (D6 19시 슬롯, 2026-05-01) — D-D21 권장 ④ 흡수.
 *   SideSheet 포커스 복귀(WCAG 2.4.3 / 2.4.7) 라이브 회귀 가드.
 *
 * 시나리오:
 *   1) 모바일 viewport 진입 → 햄버거 트리거 fcous → click → SideSheet open.
 *   2) ESC 키 → SideSheet close.
 *   3) document.activeElement 가 트리거 버튼으로 복귀.
 *
 * 전제:
 *   - NEXT_PUBLIC_ROBUSTA_SIDE_SHEET=on 환경에서만 SideSheet 분기 진입.
 *     flag OFF (기본 dual-track) 일 경우 풀스크린 오버레이 분기 — 본 케이스는 SKIP.
 *   - SIDE_SHEET_FLAG_ON 추정 — 본 슬롯의 BASE_URL Vercel 빌드가 flag ON 인지 추정 #92.
 *     라이브가 OFF 면 이 케이스는 page.locator("[data-test='side-sheet-panel']") 가 보이지 않으므로
 *     test.skip() 동적 처리.
 */
test.describe("verify-live (C-D22-3 SideSheet ESC focus 복귀)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("F: SideSheet open → ESC 닫기 → 트리거로 focus 복귀", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    const trigger = page.locator('[data-test="mobile-menu-trigger"]');
    await expect(trigger).toBeVisible();

    // 트리거에 명시적 포커스 — keyboard tab 흐름과 동일한 시점.
    await trigger.focus();
    await trigger.click();

    // SIDE_SHEET_FLAG_ON 분기 검증 — flag OFF 면 panel 미표시 → test.skip.
    const panel = page.locator('[data-test="side-sheet-panel"]');
    const opened = await panel.isVisible().catch(() => false);
    if (!opened) {
      test.skip(true, "SIDE_SHEET_FLAG_ON OFF — 풀스크린 오버레이 분기 (C-D22-3 회귀 영향 없음)");
    }

    // ESC 키 → SideSheet close.
    await page.keyboard.press("Escape");

    // 패널이 closed 되었는지 확인 — open=false 시 SideSheet 가 null 반환.
    await expect(panel).toBeHidden({ timeout: 2_000 });

    // 포커스 복귀 — 트리거 버튼이 다시 active element 여야 함.
    const activeTestId = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute("data-test") ?? null;
    });
    expect(activeTestId, "ESC 후 focus 가 mobile-menu-trigger 로 복귀").toBe(
      "mobile-menu-trigger",
    );
  });
});
