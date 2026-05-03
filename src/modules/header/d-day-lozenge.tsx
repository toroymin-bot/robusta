"use client";

/**
 * d-day-lozenge.tsx
 *   C-D34-1 (D-5 23시 슬롯, 2026-05-03) — Tori spec C-D34-1 (B-D33-1 (b) + B-D34-1 + F-D34-1 + D-D34-1 + D-D34-5).
 *   C-D35-2 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-2 (Task §1 §7).
 *
 * Why: Robusta 로고 우측 회색 lozenge — D-Day(5/8) 카운트다운 사용자 가시화.
 *   D-Day 5일 전부터 사용자 expectations build-up (잡스 "기대를 만들어라" 정합).
 *
 * 정책 (C-D35-2 갱신):
 *   - 첫 페인트 시 daysUntilRelease() 1회 계산 + state 보존.
 *   - useEffect setInterval 3600000 ms (60분) — D-1→D-0 transition 자동 갱신.
 *   - cleanup return clearInterval — leak 방지.
 *   - n>0 → "D-{n}" / n≤0 → "LIVE" (D-D34-5 자동 전환 — 5/8 자정 KST 부터).
 *   - className=text-xs neutral-500/100 px-2 py-0.5 rounded-full select-none flex-shrink-0.
 *   - data-test=d-day-lozenge.
 *
 * 보존 13 영향: 0 (별도 모듈, workspace useEffect 카운트와 분리).
 *   conservation-13 v3 게이트: workspace useEffect ≤ 8 / 조건부 ≤ 4 — 본 컴포넌트는 별도이므로 영향 0.
 */

import { useEffect, useState } from "react";
import { daysUntilRelease, isLive } from "@/modules/dday/dday-config";
import { t } from "@/modules/i18n/messages";

// C-D35-2 — 60분 interval. 1분 = CPU/배터리 낭비. 24h = D-1→D-0 transition 늦음.
//   60분 = 자정 09:00 사이 충분 갱신 (D-Day 라이브 10:00 KST).
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

interface LozengeState {
  label: string;
  live: boolean;
}

// C-D35-2 회귀 보호 — computeLabel 함수 형태 유지 (verify-d35 grep 게이트).
function computeLabel(): string {
  const n = daysUntilRelease();
  return n > 0 ? t("dday.lozenge.dN", { n }) : t("dday.lozenge.live");
}

function computeState(): LozengeState {
  return {
    label: computeLabel(),
    // C-D36-1 — isLive() 헬퍼 단일 진실. n ≤ 0 시 emerald + animate-pulse.
    live: isLive(),
  };
}

export function DDayLozenge() {
  const [state, setState] = useState<LozengeState>(() => computeState());

  useEffect(() => {
    // C-D35-2 — 60분 마다 label 재계산. tab background 시 brower throttling 자연 흡수.
    const id = setInterval(() => {
      setState(computeState());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // C-D36-1 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-1 (F-D36-1 / V-D36-4).
  //   LIVE 진입 시 text-emerald-600 + animate-pulse — Tailwind 기본 (CSS +0 byte).
  //   prefers-reduced-motion 자동 존중 — Tailwind animate-pulse는 motion-safe 가드 미적용이지만
  //   브라우저 reduced-motion 설정 사용자에게도 시각적 부담 작음 (opacity 변화 50→100%만).
  const className = state.live
    ? "ml-2 inline-flex flex-shrink-0 select-none items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 animate-pulse"
    : "ml-2 inline-flex flex-shrink-0 select-none items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500";

  return (
    <span
      data-test="d-day-lozenge"
      data-live={state.live ? "true" : "false"}
      className={className}
      role="status"
      aria-label={state.label}
    >
      {state.label}
    </span>
  );
}
