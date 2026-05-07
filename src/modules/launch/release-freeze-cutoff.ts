/**
 * release-freeze-cutoff.ts
 *   - C-D56-3 (D-1 19시 슬롯, 2026-05-07) — Tori spec C-D56-3 (B-D52-1∼4 D-1 정책 락 4건 통합 흡수).
 *
 * Why: D-1 release freeze T-6h 시점 D-1/D-Day/D+1 시간 SoT 단일 진실.
 *   - B-D52-1 (pre-commit-freeze.sh hard cutoff 5/7 23:00 KST) — RELEASE_FREEZE_CUTOFF_KST.
 *   - B-D52-2 (5/8 00:00 활성 모니터 30분) — LIVE_MONITOR_START_KST + LIVE_MONITOR_DURATION_MIN.
 *   - B-D52-3 (5/7 20:00 KST Show HN T-2h dry-run sim) — sim:show-hn-submit 6 케이스 흡수.
 *   - B-D52-4 (5/7 22:00 KST Show HN submit 정각) — SUBMIT_DEADLINE_KST.
 *
 * 자율 정정 (D-56-자):
 *   - D-56-자-2: SUBMIT_DEADLINE_KST SoT 위치 — 명세 verify:d56 게이트 2 'show-hn-submit-config.ts
 *                SUBMIT_DEADLINE_KST' 추정 → 실 sim-show-hn-submit.mjs line 35 만 존재.
 *                SoT 통합 정합 — 본 모듈에 SUBMIT_DEADLINE_KST 신규 정의 (release-freeze + monitor +
 *                submit 3 시간 단일 SoT). show-hn-submit-config.ts 변경 0 (i18n MESSAGES 변동 0 락
 *                정합). sim-show-hn-submit.mjs 는 CLI .mjs ↔ .ts 산식 미러 SoT (D-53-자-1 락) —
 *                동일값 유지 (verify:d56 게이트 2가 양쪽 일관성 검증).
 *
 * CLI .mjs ↔ .ts 산식 미러 SoT 정합 (D-53-자-1 락):
 *   - scripts/sim-release-freeze.mjs — 본 모듈 산식 1:1 미러. 동기화 책임 본 모듈 변경자.
 *
 * 보존 13 영향: 0 (신규 모듈, launch/ 하위 — 보존 13 외부).
 */

export const RELEASE_FREEZE_CUTOFF_KST =
  "2026-05-07T23:00:00+09:00" as const;

export const LIVE_MONITOR_START_KST =
  "2026-05-08T00:00:00+09:00" as const;

export const LIVE_MONITOR_DURATION_MIN = 30 as const;

export const SUBMIT_DEADLINE_KST =
  "2026-05-07T22:00:00+09:00" as const;

export type ReleasePhase = "pre-freeze" | "freeze" | "monitor" | "live";

export interface ReleaseFreezeStatus {
  phase: ReleasePhase;
  minutesToNext: number;
}

const ONE_MINUTE_MS = 60_000;

/**
 * getReleaseFreezeStatus — D-1/D-Day/D+1 시간대 phase 산출.
 *   순수 함수 (외부 부수효과 0).
 *
 * 산식:
 *   - now < cutoff                       → 'pre-freeze', minutesToNext = (cutoff - now)/60s
 *   - cutoff <= now < monitorStart       → 'freeze',     minutesToNext = (monitorStart - now)/60s
 *   - monitorStart <= now < monitorEnd   → 'monitor',    minutesToNext = (monitorEnd - now)/60s
 *   - now >= monitorEnd                  → 'live',       minutesToNext = 0
 *
 * 입력 가드:
 *   - now Invalid Date → throw RangeError('invalid now').
 */
export function getReleaseFreezeStatus(now: Date): ReleaseFreezeStatus {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new RangeError("invalid now");
  }

  const nowMs = now.getTime();
  const cutoffMs = new Date(RELEASE_FREEZE_CUTOFF_KST).getTime();
  const monitorStartMs = new Date(LIVE_MONITOR_START_KST).getTime();
  const monitorEndMs =
    monitorStartMs + LIVE_MONITOR_DURATION_MIN * ONE_MINUTE_MS;

  if (nowMs < cutoffMs) {
    return {
      phase: "pre-freeze",
      minutesToNext: Math.floor((cutoffMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  if (nowMs < monitorStartMs) {
    return {
      phase: "freeze",
      minutesToNext: Math.floor((monitorStartMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  if (nowMs < monitorEndMs) {
    return {
      phase: "monitor",
      minutesToNext: Math.floor((monitorEndMs - nowMs) / ONE_MINUTE_MS),
    };
  }
  return { phase: "live", minutesToNext: 0 };
}
