/**
 * dim-hero.ts
 *   - C-D51-2 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-2 (D-D51-1 wiring).
 *
 * Why: Hero LIVE 첫 1h 강조 후 1∼2h opacity 70% 자동 dimming (B-D49-4 회복).
 *   §11 D-D51-1 디자인 최종 선정. UX 노이즈 0 + 잡스 단순성.
 *
 * 자율 정정:
 *   - D-51-자-2: 명세 경로 'src/components/launch/dim-hero.ts' 추정 — 실 src/components/launch 부재.
 *                launch 모듈 단일 책임 정합으로 'src/modules/launch/dim-hero.ts' (release-snapshot.ts 동일).
 *   - D-51-자-3: 명세 hero.tsx wiring 추정 — 실 hero.tsx 부재 (hero-live-transition / hero-live-pulse /
 *                hero-title-slot / hero-live-banner 4 분리). wiring은 D+1 자율 슬롯 큐로 이월.
 *                본 슬롯은 buildHeroDimmingOpacity 헬퍼만 작성 — release freeze 직전 보존 13 v3 무손상 의무 정합.
 *                B-D51-4 release freeze 5/7 23시 진입 직전, hero* 4 컴포넌트 동시 변경 = 위험. 자율 결정 권한 발동.
 *
 * 정책:
 *   - 4 phase enum: 'pre-live'|'live-1h'|'dimmed'|'no-release-iso'.
 *   - opacity ∈ {1.0, 0.7}.
 *   - releaseIso = null → 1.0 / 'no-release-iso' (보존).
 *   - now < releaseIso → 1.0 / 'pre-live'.
 *   - releaseIso ≤ now < releaseIso+1h → 1.0 / 'live-1h' (강조 모드).
 *   - now ≥ releaseIso+1h → 0.7 / 'dimmed' (자동 dimming).
 *   - motion-reduce는 호출 컴포넌트 책임 (헬퍼는 1.0/0.7만 반환).
 *
 * 보존 13 영향: 0 (신규 모듈, 보존 13 미포함).
 */

export type HeroDimmingPhase = "pre-live" | "live-1h" | "dimmed" | "no-release-iso";

export interface HeroDimming {
  opacity: number;
  phase: HeroDimmingPhase;
}

export const HERO_DIMMING_OPACITY_FULL = 1.0 as const;
export const HERO_DIMMING_OPACITY_DIMMED = 0.7 as const;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * buildHeroDimmingOpacity — Hero opacity + phase 단일 함수.
 *   순수 함수 (외부 부수효과 0). 호출자가 1분 tick 책임.
 *
 *   호출 예 (D+1 자율 슬롯 wiring 큐):
 *     const { opacity, phase } = buildHeroDimmingOpacity(RELEASE_ISO, new Date());
 *     setOpacity(prefersReducedMotion ? 1.0 : opacity);
 */
export function buildHeroDimmingOpacity(
  releaseIso: string | null,
  now: Date,
): HeroDimming {
  if (releaseIso === null) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "no-release-iso" };
  }

  const release = new Date(releaseIso);
  const releaseMs = release.getTime();
  const nowMs = now.getTime();

  if (nowMs < releaseMs) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "pre-live" };
  }

  if (nowMs < releaseMs + ONE_HOUR_MS) {
    return { opacity: HERO_DIMMING_OPACITY_FULL, phase: "live-1h" };
  }

  return { opacity: HERO_DIMMING_OPACITY_DIMMED, phase: "dimmed" };
}
