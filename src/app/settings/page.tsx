"use client";

/**
 * settings/page.tsx
 *   - C-D46-1 + C-D46-4 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-1 / C-D46-4.
 *   - C-D47-2 + C-D47-3 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-2 / C-D47-3.
 *
 * Why: Roy BYOK 시연 진입점 (16:00 KST 시각 락, B-D46-1 + B-D47-1) + D+1 회고 다운로드 진입점.
 *   사이드바 Main 외부 부가 페이지 — Do v39 §3.6 사이드바 매핑 정합.
 *
 * C-D47-3 추가:
 *   - sticky 헤더 "Robusta · 설정" — top-0 z-30 + 1px border-b (D-D47-1).
 *   - LockedLozenge — 우측 하단 fixed "🔒 v3 LOCKED" pointer-events-none (D-D47-2).
 *   - ByokCountdownLozenge — T-5 ∼ T+30 BYOK 시연 카운트다운 (D-D47-3).
 *
 * C-D47-2 추가:
 *   - ShownhScoreInput — D+1 회고 섹션 내 점수 입력 필드 (B-D47-2).
 *
 * 자율 정정:
 *   - D-46-자-1: settings page 미존재 — 신규 생성 위치 = 'src/app/settings/page.tsx' (lang prefix 0).
 *   - D-46-자-4: DemoModeButton + D1ReportButton 분리 (settings 모듈 디렉터리 단일 책임).
 *
 * 정책:
 *   - 'use client' — DemoModeButton/D1ReportButton/ShownhScoreInput/lozenge 양쪽 zustand/state 의존.
 *   - 외부 dev-deps +0.
 */

import { DemoModeButton } from "@/modules/settings/demo-mode-button";
import { D1ReportButton } from "@/modules/settings/d1-report-button";
import { LockedLozenge } from "@/modules/settings/locked-lozenge";
import { ByokCountdownLozenge } from "@/modules/settings/byok-countdown-lozenge";
import { ByokDemoCard } from "@/modules/settings/byok-demo-card";
import { ShownhScoreInput } from "@/modules/launch/shownh-score-input";
import { t } from "@/modules/i18n/messages";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-robusta-canvas">
      {/* C-D47-3 (D-D47-1) — sticky 헤더. position: sticky + top-0 + z-30. */}
      <header
        className="
          sticky top-0 z-30
          border-b border-robusta-divider
          bg-robusta-canvas
          px-4 sm:px-6
          py-3.5
          flex items-center
        "
      >
        <h1 className="text-base sm:text-lg font-semibold text-robusta-ink">
          {t("settings.header.title")}
        </h1>
      </header>

      <DemoModeButton />
      <ByokCountdownLozenge />
      <ByokDemoCard />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
        <p className="text-sm text-robusta-inkDim">
          Robusta — D-2 release 5/8.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-robusta-ink">
            D+1 Retro
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            <ShownhScoreInput />
            <D1ReportButton />
          </div>
        </section>
      </div>

      <LockedLozenge />
    </main>
  );
}
