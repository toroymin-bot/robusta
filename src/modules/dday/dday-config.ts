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
