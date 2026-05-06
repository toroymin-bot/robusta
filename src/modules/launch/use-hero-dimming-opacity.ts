"use client";

/**
 * use-hero-dimming-opacity.ts
 *   - C-D52-1 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-1 (D-D52-1 / F-D52-2 단일 hook 흡수).
 *
 * Why: Hero LIVE 첫 1h 강조 + 1∼2h opacity 70% dimming + 2h 이후 정상 복귀를 단일 hook으로
 *   4 hero* 컴포넌트 (hero-live-transition / hero-live-pulse / hero-title-slot / hero-live-banner)에
 *   통일 적용. C-D51-2 dim-hero.ts buildHeroDimmingOpacity 보다 한 단계 더 — 2h 이후 1.0 복귀.
 *
 * 자율 정정:
 *   - D-52-자-1: 명세 wiring 대상 'hero-headline.tsx / hero-cta.tsx / hero-status.tsx / hero-countdown.tsx' 추정.
 *                실 hero* 4 = hero-live-transition.tsx / hero-live-pulse.tsx / hero-title-slot.tsx / hero-live-banner.tsx
 *                (D-D44∼D-D45 wiring 정합). hook 본체 + sim 테스트 본 슬롯에서 작성, hero* 4 동시 wiring은
 *                C-D52-1 명세 § 9 단점 명시 ("§6/§8 사이 wiring 의무") + B-D51-4 release freeze 직전 보존 13
 *                무손상 의무 + D-51-자-3 자율 결정 권한 (hero* 4 동시 변경 = 위험) 정합으로 §6/§8 사이 슬롯
 *                자율 결정 권한 부여 큐로 이월. 본 슬롯은 단일 hook 본체만 (사용처 0 = 회귀 0).
 *
 * 정책 (명세 § 9 정합):
 *   1. SSR (typeof window === 'undefined') → 1.0 (강조 모드 기본)
 *   2. prefers-reduced-motion: reduce → 1.0 (dimming 비활성, 모션 sickness 회피)
 *   3. now < RELEASE_ISO (pre-launch) → 1.0
 *   4. RELEASE_ISO ≤ now < RELEASE_ISO + 1h → 1.0 (강조 모드)
 *   5. RELEASE_ISO + 1h ≤ now < RELEASE_ISO + 2h → 0.7 (자동 dimming)
 *   6. now ≥ RELEASE_ISO + 2h → 1.0 (정상 복귀, dim-hero.ts 와 차이점)
 *
 * 의존:
 *   - defaultReleaseIso() from release-snapshot.ts (D-51-자-1 SoT 정합)
 *   - HERO_DIMMING_OPACITY_DIMMED = 0.7 from dim-hero.ts (D-D51-1 정합)
 *
 * 보존 13 영향: 0 (신규 모듈, 4 hero* wiring은 §6/§8 큐).
 *
 * 외부 dev-deps +0 (React 19 only).
 */

import { useEffect, useState } from "react";
import { defaultReleaseIso } from "@/modules/launch/release-snapshot";
import {
  HERO_DIMMING_OPACITY_FULL,
  HERO_DIMMING_OPACITY_DIMMED,
} from "@/modules/launch/dim-hero";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;

/**
 * computeHeroDimmingOpacity — 순수 함수 헬퍼 (sim 테스트 가능).
 *   hook은 React 환경에서만 호출 가능 — 본 헬퍼로 6 케이스 sim 테스트.
 *
 *   prefersReducedMotion=true → 1.0 (dimming 비활성).
 *   now < release → 1.0 (pre-launch).
 *   release ≤ now < release+1h → 1.0 (강조).
 *   release+1h ≤ now < release+2h → 0.7 (dimming).
 *   now ≥ release+2h → 1.0 (정상).
 */
export function computeHeroDimmingOpacity(
  now: Date,
  releaseIso: string,
  prefersReducedMotion: boolean,
): number {
  if (prefersReducedMotion) return HERO_DIMMING_OPACITY_FULL;

  const releaseMs = new Date(releaseIso).getTime();
  const nowMs = now.getTime();

  if (nowMs < releaseMs) return HERO_DIMMING_OPACITY_FULL; // pre-launch
  if (nowMs < releaseMs + ONE_HOUR_MS) return HERO_DIMMING_OPACITY_FULL; // 강조
  if (nowMs < releaseMs + TWO_HOURS_MS) return HERO_DIMMING_OPACITY_DIMMED; // dimming
  return HERO_DIMMING_OPACITY_FULL; // 정상 복귀
}

/**
 * useHeroDimmingOpacity — Hero opacity 단일 hook.
 *   호출 컴포넌트는 style={{opacity: useHeroDimmingOpacity()}} 로 사용.
 *
 *   엣지:
 *     - SSR 가드: typeof window === 'undefined' → 1.0 즉시 반환 (hook 호출 자체는 일어나지 않으나
 *       initial state 안전성 보장).
 *     - prefers-reduced-motion 동기화 — matchMedia change 이벤트로 토글 시 즉시 반영.
 *     - 1분 tick — 경계 (release+1h, release+2h) 통과 시 자동 갱신.
 *     - now prop 주입 시 tick 비활성 (테스트/시뮬 정합).
 */
export function useHeroDimmingOpacity(now?: Date): number {
  const releaseIso = defaultReleaseIso();
  const isSsr = typeof window === "undefined";

  const initial = isSsr
    ? HERO_DIMMING_OPACITY_FULL
    : computeHeroDimmingOpacity(now ?? new Date(), releaseIso, false);

  const [opacity, setOpacity] = useState<number>(initial);

  useEffect(() => {
    if (isSsr) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const evaluate = () => {
      setOpacity(
        computeHeroDimmingOpacity(now ?? new Date(), releaseIso, mq.matches),
      );
    };
    evaluate();
    mq.addEventListener("change", evaluate);

    // now prop 주입 시 tick 비활성 (테스트 정합).
    if (now !== undefined) {
      return () => mq.removeEventListener("change", evaluate);
    }

    // 1분 tick — 경계 통과 자동 갱신.
    const tickId = window.setInterval(evaluate, 60_000);
    return () => {
      mq.removeEventListener("change", evaluate);
      window.clearInterval(tickId);
    };
  }, [isSsr, releaseIso, now]);

  return opacity;
}
