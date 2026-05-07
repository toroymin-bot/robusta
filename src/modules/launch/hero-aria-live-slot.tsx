"use client";

/**
 * hero-aria-live-slot.tsx
 *   - A-D54-자-1 (D-1 11시 슬롯, 2026-05-07) — Komi 자율 (§5 똘이 09시 슬롯 명세 미수신).
 *
 * Why: §6 정해진 산출물 = "hero* 4 wiring 본체 (C-D52-1 / C-D53-2 D+1 큐 회복)".
 *   C-D53-2 본체 HeroAriaLiveRegion 은 D-1 07시 슬롯에서 별도 컴포넌트로 작성됨 — phase props 만 받는
 *   순수 컴포넌트로 마운트만 남은 상태. 본 슬롯은 client-side phase 계산 + sr-only 마운트를 단일
 *   wrapper 컴포넌트로 흡수. layout.tsx 1줄 추가 (sibling, hero* 4 직접 변경 0).
 *
 * release freeze 정합 (B-D51-4 / 5/7 23:00 KST hard cutoff):
 *   - hero* 4 (hero-live-transition / hero-live-pulse / hero-title-slot / hero-live-banner) 직접 변경 0
 *     — 자율 결정 권한 (D-51-자-3 정합) 동일 발동 + 보존 13 v3 무손상 의무.
 *   - 신규 sibling 컴포넌트 마운트만 — 회귀 위험 최소.
 *   - SR(screen reader) 사용자에게 LIVE 전환 1h 동안 1회 alert — 접근성 회복.
 *
 * 정책 (HeroAriaLiveRegion 명세 § 14 정합):
 *   - phase 산출 = buildHeroDimmingOpacity(releaseIso, now).phase (dim-hero.ts SoT 직접 재사용).
 *   - 1분 tick — 경계 (release, release+1h) 통과 시 자동 갱신.
 *   - SSR 가드: typeof window === 'undefined' → 'no-release-iso' phase 반환 (sr-only 빈 텍스트).
 *   - prefers-reduced-motion 무시 — sr-only 영역은 motion 영향 0 (screen reader 만 인지).
 *
 * 의존:
 *   - HeroAriaLiveRegion from hero-aria-live-region.tsx (C-D53-2 SoT).
 *   - buildHeroDimmingOpacity from dim-hero.ts (D-D51-1 SoT).
 *   - defaultReleaseIso from release-snapshot.ts (D-51-자-1 SoT).
 *
 * 보존 13 영향: 0 (신규 모듈, 보존 13 미포함).
 * 외부 dev-deps +0 (React 19 + 기존 launch 모듈).
 *
 * locale 정책:
 *   - 명세 prop 부재 — ko fallback (HeroAriaLiveRegion default 와 정합).
 *   - 추후 useLocale hook wiring 큐 — D+1 자율 슬롯 또는 §11 EOD 검토.
 */

import { useEffect, useState } from "react";
import {
  HeroAriaLiveRegion,
  type HeroAriaLiveRegionProps,
} from "@/modules/launch/hero-aria-live-region";
import {
  buildHeroDimmingOpacity,
  type HeroDimmingPhase,
} from "@/modules/launch/dim-hero";
import { defaultReleaseIso } from "@/modules/launch/release-snapshot";

const ONE_MINUTE_MS = 60 * 1000;

/**
 * computeHeroAriaLivePhase — 순수 함수 헬퍼 (sim 테스트 가능).
 *   buildHeroDimmingOpacity 산식 SoT 직접 재사용. phase 4 enum 1:1.
 *
 *   releaseIso null → 'no-release-iso'.
 *   now < releaseIso → 'pre-live'.
 *   releaseIso ≤ now < releaseIso+1h → 'live-1h'.
 *   now ≥ releaseIso+1h → 'dimmed'.
 */
export function computeHeroAriaLivePhase(
  releaseIso: string | null,
  now: Date,
): HeroDimmingPhase {
  return buildHeroDimmingOpacity(releaseIso, now).phase;
}

export interface HeroAriaLiveSlotProps {
  /** 호출자가 useLocale 결과를 주입. 미주입 시 ko fallback. */
  locale?: HeroAriaLiveRegionProps["locale"];
  /** 테스트/시뮬용 — now 주입 시 1분 tick 비활성. */
  now?: Date;
}

/**
 * HeroAriaLiveSlot — hero-aria-live-region 마운트 슬롯.
 *   layout.tsx body 안 sibling 으로 1줄 추가. SR 사용자가 LIVE 1h 안에 1회 듣는다.
 *
 *   엣지:
 *     - SSR 가드: typeof window === 'undefined' → 'no-release-iso' (sr-only 빈 텍스트, hydration mismatch 0).
 *     - 1분 tick — 경계 통과 자동 갱신. now prop 주입 시 tick 비활성.
 *     - 보존 13 미포함 — 신규 마운트.
 */
export function HeroAriaLiveSlot({
  locale,
  now,
}: HeroAriaLiveSlotProps = {}): React.ReactElement {
  const releaseIso = defaultReleaseIso();
  const isSsr = typeof window === "undefined";

  const initialPhase: HeroDimmingPhase = isSsr
    ? "no-release-iso"
    : computeHeroAriaLivePhase(releaseIso, now ?? new Date());

  const [phase, setPhase] = useState<HeroDimmingPhase>(initialPhase);

  useEffect(() => {
    if (isSsr) return;

    const evaluate = () => {
      setPhase(computeHeroAriaLivePhase(releaseIso, now ?? new Date()));
    };
    evaluate();

    if (now !== undefined) return; // tick 비활성 — 테스트 정합.

    const tickId = window.setInterval(evaluate, ONE_MINUTE_MS);
    return () => {
      window.clearInterval(tickId);
    };
  }, [isSsr, releaseIso, now]);

  return <HeroAriaLiveRegion phase={phase} locale={locale} />;
}

export default HeroAriaLiveSlot;
