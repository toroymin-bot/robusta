"use client";

/**
 * shownh-card.tsx
 *   - C-D44-2 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-2 (B-D44-1 + D-D44-5).
 *
 * Why: Show HN 카피 v2 — 잡스 6단어 헤드라인 + 본문 3줄 + CTA 1.
 *   /launch 페이지 노출 + 5/8 D-Day 동시 Show HN submit 직접 동력.
 *
 * 정책 (D-D44-5):
 *   - 영문 헤드라인 6단어 (Brainstorm with multiple AIs at once.) 압축.
 *   - 본문 3줄 정확 — line1/2/3 i18n 키.
 *   - 한글 word-break: keep-all (브레인스토밍 등 긴 단어).
 *   - CTA 클릭 → funnelEvents `launch:show_hn_arrival` 1건 기록.
 *
 * 자율 정정:
 *   - D-44-자-3: launch 디렉터리에 신규 추가 (보존 13 무영향).
 *
 * 외부 dev-deps +0.
 */

import type { JSX } from "react";
import { useState } from "react";
import { t, type Locale } from "@/modules/i18n/messages";
import { logFunnelEvent } from "./funnel-events";

export interface ShowHNCardProps {
  lang: Locale;
  onCTAClick?: () => void;
}

export function ShowHNCard(props: ShowHNCardProps): JSX.Element {
  const lang = props.lang;
  const [clicked, setClicked] = useState(false);

  const handleCTA = () => {
    setClicked(true);
    void logFunnelEvent("show_hn_arrival", { source: "shownh-card", lang });
    props.onCTAClick?.();
  };

  return (
    <article
      data-test="shownh-card"
      data-lang={lang}
      className="rounded-lg border border-robusta-divider bg-white p-6 dark:bg-stone-900"
      style={{ wordBreak: "keep-all" }}
    >
      <h2
        data-test="shownh-headline-v2"
        data-version="v2"
        className="text-2xl font-bold text-robusta-ink md:text-3xl"
      >
        {t("launch.shownh.headline.v2", undefined, lang)}
      </h2>
      <div
        data-test="shownh-body-v2"
        className="mt-4 space-y-2 text-sm text-robusta-inkDim md:text-base"
      >
        <p data-test="shownh-body-line1">
          {t("launch.shownh.body.v2.line1", undefined, lang)}
        </p>
        <p data-test="shownh-body-line2">
          {t("launch.shownh.body.v2.line2", undefined, lang)}
        </p>
        <p data-test="shownh-body-line3">
          {t("launch.shownh.body.v2.line3", undefined, lang)}
        </p>
      </div>
      <button
        type="button"
        data-test="shownh-cta-v2"
        data-clicked={clicked ? "true" : "false"}
        onClick={handleCTA}
        className="mt-6 inline-flex items-center rounded bg-robusta-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {t("launch.shownh.cta.v2", undefined, lang)}
      </button>
      {/* C-D45-1 (D-3 23시 슬롯, 2026-05-05) — submit 시각 caption (D-D45-4 / B-D45-1).
          토큰: --text-muted (text-robusta-inkDim 정합), 12px (mobile 11px 분기 → md:text-xs 패턴 정합).
          OCP — 기존 props/구조 무수정, 카드 하단 영역만 추가. */}
      <p
        data-test="shownh-submitted-caption"
        className="mt-4 text-[11px] leading-tight text-robusta-inkDim md:text-xs"
      >
        {t("launch.shownh.submitted.caption", undefined, lang)}
      </p>
    </article>
  );
}

export default ShowHNCard;
