"use client";

/**
 * hero-title-slot.tsx
 *   - C-D42-1 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42-1 (B-D42-1 Hero 라운드테이블 포지셔닝).
 *
 * Why: "Blend는 1대1, Robusta는 다자(多者)" 차별 포지셔닝을 Hero 첫 줄에 명시.
 *   사용자 첫 5초 안에 컨셉 차별 인지 — Show HN 카피 v4 정합.
 *
 * 자율 정정 (D-42-자-1): 명세 src/modules/ui/hero-title-slot.tsx 신규 + welcome-view.tsx 마운트.
 *   기존 Hero 카피(welcome-view.tsx h2/p hero.sub)는 OCP 보존 — 새 v4 슬롯은 ShowHnCopyV3 아래
 *   별도 영역으로 마운트해 Robusta 라운드테이블 포지셔닝을 추가 노출 (v3 컨셉 무손상).
 *
 * 디자인 토큰:
 *   - h1: text-2xl font-bold text-robusta-ink mt-4 (Hero 1줄, 다크 자동 대응)
 *   - p:  text-sm text-robusta-inkDim mt-1
 *   - HeroLivePulse: h1 우측 inline-flex 마운트 (C-D42-4 자동 전환)
 *
 * 엣지:
 *   - locale 미지정 → ko fallback (t() 동일 정책).
 *   - liveMode=false → 보조 끝 "(D-3 출시 예정)" 후행 (en: " (Launching in D-3)").
 *   - SSR 안전: HeroLivePulse 자체가 use client + Date 순수 분기 (hydrated 0).
 *
 * 보존 13 영향: 0 (신규 모듈, welcome-view.tsx import 1줄 + 마운트 1줄만).
 */

import type { JSX } from "react";
import { t } from "@/modules/i18n/messages";
import type { Locale } from "@/modules/i18n/messages";
import { HeroLivePulse } from "@/modules/ui/hero-live-pulse";

export interface HeroTitleSlotProps {
  liveMode: boolean;
  locale?: Locale;
}

export default function HeroTitleSlot(props: HeroTitleSlotProps): JSX.Element {
  const locale: Locale = props.locale ?? "ko";
  const title = t("hero.title.v4", undefined, locale);
  const subBase = t("hero.sub.v4", undefined, locale);
  // liveMode=false 시 후행 문구 — D-Day 전 명시 (사용자 신뢰).
  const trailing =
    !props.liveMode && locale === "en" ? " (Launching in D-3)" : !props.liveMode ? " (D-3 출시 예정)" : "";
  const sub = `${subBase}${trailing}`;

  return (
    <div data-test="hero-title-slot" className="mt-4">
      <div className="inline-flex items-center gap-2">
        <h1
          data-test="hero-title-v4"
          data-version="v4"
          className="text-2xl font-bold text-robusta-ink"
        >
          {title}
        </h1>
        <HeroLivePulse />
      </div>
      <p data-test="hero-sub-v4" className="mt-1 text-sm text-robusta-inkDim">
        {sub}
      </p>
    </div>
  );
}
