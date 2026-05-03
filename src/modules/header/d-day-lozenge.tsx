"use client";

/**
 * d-day-lozenge.tsx
 *   C-D34-1 (D-5 23시 슬롯, 2026-05-03) — Tori spec C-D34-1 (B-D33-1 (b) + B-D34-1 + F-D34-1 + D-D34-1 + D-D34-5).
 *
 * Why: Robusta 로고 우측 회색 lozenge — D-Day(5/8) 카운트다운 사용자 가시화.
 *   D-Day 5일 전부터 사용자 expectations build-up (잡스 "기대를 만들어라" 정합).
 *
 * 정책:
 *   - daysUntilRelease() 결과를 page reload 마다 1회 계산 (interval 미사용 — 단순함 우선).
 *   - n>0 → "D-{n}" / n≤0 → "LIVE" (D-D34-5 자동 전환 — 5/8 자정 KST 부터).
 *   - className=text-xs neutral-500/100 px-2 py-0.5 rounded-full select-none flex-shrink-0 (D-D34-1 시각).
 *   - data-test=d-day-lozenge.
 *
 * 보존 13 영향: 0 (신규 모듈). 호출자(conversation-workspace) 가 단일 import + 1줄 마운트.
 *   useEffect/조건부 렌더 0 — 호출자 useEffect ≤ 8 / 조건부 ≤ 4 한도 영향 없음.
 */

import { daysUntilRelease } from "@/modules/dday/dday-config";
import { t } from "@/modules/i18n/messages";

export function DDayLozenge() {
  const n = daysUntilRelease();
  const label = n > 0 ? t("dday.lozenge.dN", { n }) : t("dday.lozenge.live");
  return (
    <span
      data-test="d-day-lozenge"
      className="ml-2 inline-flex flex-shrink-0 select-none items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"
      role="status"
      aria-label={label}
    >
      {label}
    </span>
  );
}
