/**
 * visited-store.ts
 *   - C-D27-3 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-3 (B-68/F-68/D-68).
 *
 * Why: 첫 진입 사용자에게 Welcome 노출 / 재진입 시 워크스페이스 직진.
 *   key: 'robusta.visitedAt' (ISO 8601 문자열).
 *
 * 가드:
 *   - SSR: typeof window === 'undefined' → hasVisited()=true (워크스페이스 진입, mismatch 회피).
 *   - localStorage 차단(Safari private 등): try/catch → hasVisited()=true 안전 fallback.
 *
 * 복원성: 사용자가 LS 클리어 시 다시 Welcome 진입 — 의도된 복원성.
 *
 * OCP: 외부 의존 0. zustand 비사용 (단발 query — store 오버헤드 불필요).
 */

const KEY = "robusta.visitedAt";

export function hasVisited(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return !!window.localStorage.getItem(KEY);
  } catch {
    return true;
  }
}

export function markVisited(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    /* noop — Safari private / quota / 차단 환경 */
  }
}
