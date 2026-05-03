/**
 * domain/domain-fallback-config.ts
 *   C-D35-4 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-4 (D-35-자-4 / KQ_23 echo).
 *
 * Why: KQ_23 D-Day 도메인 운영 액션 — 5/5 18:00 KST 정각 자동 fallback banner 활성화.
 *   Roy 가 robusta.ai4min.com 연결 안 하면 preview URL(*.vercel.app) 에 임시 안내 노출.
 *   도메인 정상 연결 후엔 banner 자체 미렌더 (호스트네임 비교).
 *
 * 정책:
 *   - FALLBACK_ENABLE_ISO = '2026-05-05T09:00:00Z' = 5/5 18:00 KST.
 *   - isFallbackActive(now): now >= FALLBACK_ENABLE_ISO ?
 *   - SSR 안전 — Date 만 사용, window 미참조.
 */

export const FALLBACK_ENABLE_ISO = "2026-05-05T09:00:00Z" as const;

export function isFallbackActive(now: number = Date.now()): boolean {
  return now >= new Date(FALLBACK_ENABLE_ISO).getTime();
}

/** 정상 도메인 호스트네임 — banner 자동 무력화 비교 대상. */
export const PRIMARY_DOMAIN = "robusta.ai4min.com" as const;
