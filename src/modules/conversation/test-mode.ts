/**
 * test-mode.ts
 *   - C-D25-4 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-4, KQ_19 답변 / F-58.
 *
 * F-22 mock LLM 정식 격리 — Playwright 등 자동 테스트 환경에서만 활성.
 *   가드: process.env.ROBUSTA_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production'
 *   production 빌드에서 isTestMode === false 강제 → tree-shaker 가 mock 분기를 dead code 로 제거.
 *
 *   클라이언트 번들 노출:
 *     - ROBUSTA_TEST_MODE 는 NEXT_PUBLIC_ 접두 미사용 → Next 가 클라이언트 번들에 자동 inline 안 함.
 *     - NODE_ENV 만 inline 됨 — 'production' 빌드에서 isTestMode 의 단락 평가가 false 로 고정.
 *
 *   사용 흐름:
 *     1) 자동 테스트가 페이지 진입 직후 globalThis.__robustaTestInject 정의.
 *     2) streamMessage 가 getTestInjection() 호출 → null 또는 TestInjection 반환.
 *     3) 호출자가 inject chunk 를 yield 한 후 clearTestInjection() 으로 1회성 정리.
 *
 * OCP:
 *   - 신규 모듈, 외부 의존 0.
 *   - production 에서 함수 본문이 단락 평가로 모두 null 반환 — 호출처는 가드 추가만으로 비파괴.
 */

const isTestMode: boolean =
  typeof process !== "undefined" &&
  process.env?.ROBUSTA_TEST_MODE === "true" &&
  process.env?.NODE_ENV !== "production";

export interface TestInjection {
  /**
   * 'compacted' — streamMessage 진입 직후 yield {kind:'compacted'} 강제.
   * 'error'     — yield {kind:'error', status, reason} 강제.
   * 'slow'      — delayMs 동안 await 후 진행.
   */
  kind: "compacted" | "error" | "slow";
  original?: number;
  shrunk?: number;
  status?: number;
  reason?: string;
  delayMs?: number;
}

interface RobustaTestGlobal {
  __robustaTestInject?: TestInjection;
}

/**
 * 자동 테스트가 등록한 1회성 injection 을 반환.
 *   - production NODE_ENV → 항상 null.
 *   - test mode 미활성 → 항상 null.
 *   - 활성 + globalThis.__robustaTestInject 미정의 → null.
 */
export function getTestInjection(): TestInjection | null {
  if (!isTestMode) return null;
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as RobustaTestGlobal;
  return g.__robustaTestInject ?? null;
}

/**
 * 1회성 injection 정리 — 호출자가 yield 직후 호출.
 *   - production / 미활성 → no-op.
 */
export function clearTestInjection(): void {
  if (!isTestMode) return;
  if (typeof globalThis === "undefined") return;
  const g = globalThis as RobustaTestGlobal;
  delete g.__robustaTestInject;
}

/** 단위 테스트 / verify-d25.mjs 용 — isTestMode 상수 노출. */
export const __test_mode_internal = {
  isTestMode,
};
