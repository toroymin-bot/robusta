"use client";

/**
 * hero-aria-live-region.tsx
 *   - C-D53-2 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-2 (F-D53-1 / F-D52-2 본체).
 *
 * Why: Hero LIVE 첫 1h 동안 screen reader 사용자에게 라이브 전환을 1회만 알림.
 *   별도 컴포넌트 OCP append — hero* 4 (hero-live-transition / hero-live-pulse / hero-title-slot /
 *   hero-live-banner) 직접 변경 0. release freeze 5/7 23:00 KST 정합 + 보존 13 v3 무손상 의무.
 *
 * 정책 (명세 § 14 정합):
 *   - phase=pre-live → 빈 텍스트 (aria-live 무알림)
 *   - phase=live-1h → t('launch.shownh.aria.live.now') 출력 (1h 동안 1회 alert)
 *   - phase=dimmed → 빈 텍스트
 *   - phase=no-release-iso → 빈 텍스트
 *
 * 시각 hidden — sr-only Tailwind 클래스 또는 inline style (clip-path).
 *
 * 의존:
 *   - HeroDimmingPhase from dim-hero.ts (D-D51-1 정합).
 *   - useT from i18n hook (호출 컴포넌트가 useLocale 인지).
 *
 * SSR 안전 — window 의존 0 (phase는 props로만 받음).
 *
 * 보존 13 영향: 0 (신규 모듈).
 * 외부 dev-deps +0 (React 19 + 기존 i18n 모듈).
 *
 * 자율 정정:
 *   - D-53-자-2: 명세 "useT from i18n hook" 사용. 그러나 i18n 모듈 정확한 hook 시그니처 미확인 →
 *                messages.ts 직접 import 후 ko/en lookup. wiring 슬롯에서 useLocale + t 패턴 정합 검증 큐.
 */

import type { HeroDimmingPhase } from "@/modules/launch/dim-hero";
import { MESSAGES } from "@/modules/i18n/messages";

export interface HeroAriaLiveRegionProps {
  phase: HeroDimmingPhase;
  /** 'ko' | 'en' — 호출자가 useLocale 결과를 주입. */
  locale?: "ko" | "en";
}

/**
 * computeHeroAriaLiveText — 순수 함수 헬퍼 (sim 테스트 가능).
 *   phase + locale → screen reader 출력 문자열 도출.
 *   live-1h 만 비어있지 않은 텍스트 반환, 나머지 3 phase 는 빈 문자열.
 */
export function computeHeroAriaLiveText(
  phase: HeroDimmingPhase,
  locale: "ko" | "en" = "ko",
): string {
  if (phase !== "live-1h") return "";
  const block = MESSAGES[locale];
  return block["launch.shownh.aria.live.now"] ?? "";
}

/**
 * HeroAriaLiveRegion — Hero LIVE first hour 라이브 리전.
 *   role="status" + aria-live="polite" + aria-atomic="true" — SR 사용자가 1h 안에 1회만 듣는다.
 *   sr-only — 시각 hidden (Tailwind 또는 inline clip-path).
 *
 *   wiring 큐: hero* 4 wiring 본체 슬롯 (§6/§8 사이) 에서 본 컴포넌트도 동시 마운트.
 *   현재 슬롯 §4 는 컴포넌트 + i18n + sim 만, 사용처 0 = 회귀 0.
 */
export function HeroAriaLiveRegion({
  phase,
  locale = "ko",
}: HeroAriaLiveRegionProps): React.ReactElement {
  const text = computeHeroAriaLiveText(phase, locale);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-test="hero-aria-live-region"
      data-phase={phase}
    >
      {text}
    </div>
  );
}
