/**
 * dday-config.ts
 *   C-D34-1 (D-5 23시 슬롯, 2026-05-03) — Tori spec C-D34-1 (B-D33-1 (b) + B-D34-1 + F-D34-1 + D-D34-1 + D-D34-5).
 *
 * Why: D-Day(5/8) 카운트다운 lozenge 의 단일 진실. KST 자정 기준 release 시각.
 *   D-N 계산 함수 분리 — 컴포넌트와 verify-d34 양쪽이 공유.
 *
 * 정책:
 *   - RELEASE_ISO 는 ISO 8601 형식 KST (+09:00) — 시점 명시.
 *   - daysUntilRelease(now): 양수 → "D-{n}" 표기, 0 이하 → "LIVE" 자동 전환 (D-D34-5).
 *   - Math.ceil 사용 — 자정 직전(예: 5/3 23:59 KST)은 5/8 까지 5일 남음 으로 보존.
 *
 * 보존 13 영향: 0 (신규 모듈, 외부 진입점만 export).
 */

export const RELEASE_ISO = "2026-05-08T00:00:00+09:00" as const;

/**
 * release 까지 남은 일수. now 미주입 시 Date.now() 기준.
 *   양수: D-N 표기. 0 이하: 라이브(LIVE) 표기.
 */
export function daysUntilRelease(now: Date = new Date()): number {
  const release = new Date(RELEASE_ISO);
  const diffMs = release.getTime() - now.getTime();
  return Math.ceil(diffMs / 86_400_000);
}

/**
 * isLive — RELEASE_ISO 도달/초과 시 true.
 *   C-D36-1 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-1 (F-D36-1 / V-D36-4).
 *   d-day-lozenge LIVE 분기 / Hero LIVE indicator / 향후 라이브 기간 분기 모두에서 단일 진실.
 *
 *   꼬미 자율 정정 (D-36-자-1): 명세는 RELEASE_ISO 변경 가능성 시사했으나
 *     기존 ISO `2026-05-08T00:00:00+09:00` 무수정 의무 — verify-d34 / d35 회귀 보호.
 *     5/8 자정 KST (00:00:00) 기준 LIVE 자동 전환 — D-D34-5 정합 유지.
 *
 *   daysUntilRelease() 결과 ≤ 0 시 LIVE — Math.ceil 정합. 단순 wrapper.
 */
export function isLive(now: Date = new Date()): boolean {
  return daysUntilRelease(now) <= 0;
}

/**
 * formatDDay — D-Day 카운트다운 라벨 단일 진실.
 *   C-D38-5 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-5 (V-D38-5 (c) + D-D38-2 (e)).
 *
 *   자율 정정 D-38-자-2: 명세 src/modules/landing/hero-day-counter.tsx 파일 미존재.
 *     실제 D-Day 계산 SoT = src/modules/dday/dday-config.ts. 본 함수를 SoT 그룹에 추가.
 *     scripts/sim-hero-live-transition.mjs 가 본 함수 시그니처 `(now: Date) => string` 정합 검증.
 *
 *   자율 정정 D-38-자-5: 시뮬 케이스를 RELEASE_ISO 정합 시점 (5/7 23:59:59 / 5/8 00:00:00 / 5/8 00:00:01).
 *     명세 의도(D-N → LIVE 자동 전환)는 RELEASE_ISO 시점 기준 동일 검증.
 *     RELEASE_ISO 무수정 의무(D-36-자-1) 정합.
 *
 *   엣지:
 *     (1) 양수 n → "D-{n}" 표기.
 *     (2) n ≤ 0 → "LIVE" (D-Day 이후 / 정각 동시).
 *     (3) timezone — Date 객체가 timezone 처리 책임 (ISO +09:00 입력 시 UTC 정합).
 */
export function formatDDay(now: Date = new Date()): string {
  const n = daysUntilRelease(now);
  return n > 0 ? `D-${n}` : "LIVE";
}
