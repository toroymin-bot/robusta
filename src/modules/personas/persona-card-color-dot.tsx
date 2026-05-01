/**
 * persona-card-color-dot.tsx
 *   - C-D24-1 (D6 03시 슬롯, 2026-05-02) — KQ_17 (a) 답변 구현.
 *
 * 카드 우상단 12×12 색 dot + 호버 툴팁 색명 + sr-only 색명 (a11y 양면).
 *   - 시각: hsl(hue, 65%, 55%) 단일 톤 (C-D23-3 measure-contrast 5/5 PASS 모드).
 *   - 호버: title 속성으로 네이티브 툴팁 (모바일 long-press 480ms 자동 fallback).
 *   - SR: <span class="sr-only"> 에 색명 텍스트.
 *   - aria: role="img" + aria-label = 색명 (예: "주황", "lilac").
 *
 * 재사용:
 *   - 1차 호출처 (C-D24-1·2 흡수): participants-panel li 우상단.
 *   - 향후: 별도 PersonaCard 컴포넌트(추정)에도 동일 슬롯 마운트.
 *
 * OCP:
 *   - 신규 파일. 기존 카드 마크업 비파괴 — 호출자가 absolute 슬롯에 마운트.
 *   - hue 가 PARTICIPANT_HUE_SEEDS 외 값이어도 hueToBaseName 의 wrap-around 거리로 가장 가까운 시드 이름 결정.
 */

"use client";

import { hueToBaseName } from "@/modules/ui/theme";

export interface PersonaCardColorDotProps {
  /** 0~360 정수. PARTICIPANT_HUE_SEEDS 중 하나가 권장이지만 임의값도 안전. */
  hue: number;
  /** 색명 locale — 'ko' (주황·노랑·민트·청록·라일락) | 'en' (orange·yellow·mint·teal·lilac). */
  locale: "ko" | "en";
  /** dot 크기 (px). 기본 12. */
  size?: number;
}

/**
 * KQ_17 (a) 답변 — 카드 우상단 색 dot + 툴팁 + sr-only.
 */
export function PersonaCardColorDot({
  hue,
  locale,
  size = 12,
}: PersonaCardColorDotProps) {
  const baseName = hueToBaseName(hue, locale);
  // C-D23-3 measure-contrast 5 hue × hsl(_, 65%, 55%) → AA Large 4.36~11.33:1 PASS.
  const bg = `hsl(${hue}, 65%, 55%)`;
  return (
    <span
      role="img"
      aria-label={baseName}
      title={baseName}
      data-test="persona-card-color-dot"
      style={{
        display: "inline-block",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        backgroundColor: bg,
        // 1px 흰 외곽선 — 어두운 카드 배경 위에서도 dot 윤곽 유지 (라이트/다크 양면).
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.6)",
        verticalAlign: "middle",
      }}
    >
      <span className="sr-only">{baseName}</span>
    </span>
  );
}
