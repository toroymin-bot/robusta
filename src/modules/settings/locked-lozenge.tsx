"use client";

/**
 * settings/locked-lozenge.tsx
 *   - C-D47-3 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-3 (D-D47-2).
 *
 * Why: Show HN 카피 v3 LOCKED 시각화 — settings 페이지 우측 하단 fixed lozenge.
 *   B-D47-5 잡스 잡음 0 의무 시각화 — 카피 변경 차단 의지 표시.
 *
 * 정책:
 *   - pointer-events-none — 시각만, 인터랙션 0 (D+1 회고 다운로드 버튼 클릭 차단 회피).
 *   - 모바일/데스크톱 동일 right-4 bottom-4 (잡스 일관성 — 위치 단순).
 *   - 외부 dev-deps +0.
 *   - 보존 13 i18n/messages.ts append-only (settings.copy.locked.label).
 *
 * D-46-자-4 분리 패턴 락 정합 — settings 모듈 디렉터리 단일 책임.
 */

import { t, type Locale } from "@/modules/i18n/messages";

interface LockedLozengeProps {
  locale?: Locale;
}

export function LockedLozenge({ locale = "ko" }: LockedLozengeProps) {
  return (
    <div
      data-test="settings-locked-lozenge"
      aria-label="Show HN copy v3 locked"
      className="
        fixed bottom-4 right-4 z-20
        select-none pointer-events-none
        rounded-full
        ring-1 ring-robusta-divider
        bg-robusta-canvas
        px-2.5 py-1.5
        text-[11px]
        text-robusta-inkDim
      "
    >
      {t("settings.copy.locked.label", undefined, locale)}
    </div>
  );
}

export default LockedLozenge;
