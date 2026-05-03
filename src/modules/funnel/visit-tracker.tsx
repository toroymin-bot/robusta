"use client";

/**
 * visit-tracker.tsx
 *   C-D36-3 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-3 (F-D36-3 / B-D35-5).
 *
 * Why: 4-funnel KPI 정합 — visit funnel 진입점 단일 위치 추적.
 *   sessionStorage 'robusta:visit_logged' 1회 가드 — 탭별 1건. 새 탭 새로 카운트.
 *
 * 동작 (자율 결정 D-36-자-3):
 *   - layout.tsx 안 마운트 → 모든 라우트 진입 시 1회 평가.
 *   - sessionStorage 가드 — 동일 탭 안 재로그 차단 (페이지 이동 / 새로고침 시 재로그 회피).
 *   - logFunnelEvent dynamic import — 메인 번들 +0 (BYOK 정합 외부 텔레메트리 0 유지).
 *
 * SSR 가드: 'use client' + useEffect — server 진입 0.
 *
 * 보존 13: 신규 모듈. workspace useEffect 카운트 영향 0.
 *   본 컴포넌트의 useEffect 1건은 layout 안 client wrapper — workspace grep 영향 0.
 */

import { useEffect } from "react";

const VISIT_KEY = "robusta:visit_logged";

export function VisitTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(VISIT_KEY) === "1") return;
      window.sessionStorage.setItem(VISIT_KEY, "1");
    } catch {
      // private mode 등 sessionStorage 차단 — silent fail (BYOK 외부 텔레메트리 0 의무)
      return;
    }
    void import("@/modules/funnel/funnel-events").then(({ logFunnelEvent }) => {
      logFunnelEvent({ type: "visit", timestamp: Date.now() });
    });
  }, []);

  return null;
}

export default VisitTracker;
