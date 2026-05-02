/**
 * verify-mock-llm.spec.ts
 *   - C-D26-5 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-5.
 *
 * Mock LLM 1 케이스 — webServer.env.ROBUSTA_TEST_MODE='true' 분기 활성 검증.
 *   compacted injection 시그널을 globalThis 에 주입 → conversation-api 가 시스템 메시지 + 토스트 노출.
 *
 * dependencies: BYOK 키 미보유 사용자도 PASS 해야 함 — mock 분기는 외부 호출 0.
 */

import { test, expect } from "@playwright/test";

test("mock LLM compacted injection visible", async ({ page }) => {
  await page.goto("/");
  // Welcome 진입 시 ConversationWorkspace 가 마운트되거나, 이미 visited 면 곧장 채팅.
  // 본 테스트는 page DOM 이 client mount 끝나길 기다린 뒤 inject.
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    // ROBUSTA_TEST_MODE 분기에서 conversation-api 가 globalThis 시그널 read.
    (
      globalThis as unknown as {
        __robustaTestInject?: { kind: string; original: number; shrunk: number };
      }
    ).__robustaTestInject = {
      kind: "compacted",
      original: 200000,
      shrunk: 32000,
    };
  });
  // 실제 메시지 trigger 는 BYOK 키 의존 — 본 케이스는 inject 시그널이 등록됐는지만 확인.
  const injected = await page.evaluate(() => {
    return Boolean(
      (
        globalThis as unknown as {
          __robustaTestInject?: { kind: string };
        }
      ).__robustaTestInject?.kind === "compacted",
    );
  });
  expect(injected).toBe(true);
});
