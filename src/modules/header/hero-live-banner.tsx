"use client";

/**
 * hero-live-banner.tsx
 *   C-D36-1 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-1 (F-D36-1 / V-D36-4).
 *
 * Why: D-Day(5/8) 정각 자동 LIVE 전환 시 Hero 영역 "🟢 지금 라이브" 1줄 표기.
 *   사용자 첫 진입에서 LIVE 상태 즉시 인지 — 잡스 "기대를 만들어라" 정합.
 *
 * 정책 (자율 결정 D-36-자-1):
 *   - 명세는 src/app/page.tsx Hero 영역 1줄 추가였으나 page.tsx는 Welcome/Workspace 분기 라우팅
 *     컴포넌트 — Hero 카피는 두 분기에 분산되어 있어 단일 추가 위치 부재.
 *   - 자율 정정: layout.tsx body 안 client wrapper 로 마운트. LIVE 시만 fixed top 노출.
 *     모든 분기/라우트에서 자동 일관 노출 — Welcome 첫 진입자도, 재방문 사용자도 동일 경험.
 *   - LIVE 미진입 시 null 렌더 — DOM 영향 0.
 *
 * 보존 13: 신규 모듈, 외부 진입점만. workspace useEffect 카운트 영향 0.
 *   isLive() 단일 호출 — useEffect 0 / useState 0 (정적 분기).
 *
 * SSR 가드: 'use client' — typeof window 검사 불필요 (next 자동 처리).
 */

import { isLive } from "@/modules/dday/dday-config";
import { t } from "@/modules/i18n/messages";

export function HeroLiveBanner() {
  // 정적 분기 — RELEASE_ISO 도달 시점에서 isLive() = true.
  //   탭 background 시 lozenge 가 60분 마다 재계산 (D-D35), 본 banner 는 마운트 시점 1회 평가
  //   (Hero 영역 단순 indicator — 시간 변화에 따른 갱신 사용자 가치 미미).
  if (!isLive()) return null;

  return (
    <div
      data-test="hero-live-banner"
      role="status"
      aria-label={t("hero.live.indicator")}
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm"
    >
      <span aria-hidden>🟢</span>
      <span>{t("hero.live.indicator")}</span>
    </div>
  );
}

export default HeroLiveBanner;
