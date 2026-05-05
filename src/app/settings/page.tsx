"use client";

/**
 * settings/page.tsx
 *   - C-D46-1 + C-D46-4 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-1 / C-D46-4.
 *
 * Why: Roy BYOK 시연 진입점 (16:00 KST 시각 락, B-D46-1) + D+1 회고 다운로드 진입점.
 *   사이드바 Main 외부 부가 페이지 — Do v39 §3.6 사이드바 매핑 정합.
 *
 * 자율 정정:
 *   - D-46-자-1: settings page 미존재 — 신규 생성 위치 = 'src/app/settings/page.tsx'
 *     (lang prefix 0, D-44-자-5 정합 — /launch/* 와 동일 lang prefix 미사용 기준).
 *
 * 정책:
 *   - 'use client' — DemoModeButton/D1ReportButton 양쪽 zustand 의존 (보존 13 toast / persona-store).
 *   - 외부 dev-deps +0.
 */

import { DemoModeButton } from "@/modules/settings/demo-mode-button";
import { D1ReportButton } from "@/modules/settings/d1-report-button";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-robusta-canvas px-4 py-10 sm:px-8">
      <DemoModeButton />
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-xl font-semibold text-robusta-ink sm:text-2xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-robusta-inkDim">
          Robusta — D-2 release 5/8.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-robusta-ink">
            D+1 Retro
          </h2>
          <div className="mt-3">
            <D1ReportButton />
          </div>
        </section>
      </div>
    </main>
  );
}
