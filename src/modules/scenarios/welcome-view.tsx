/**
 * welcome-view.tsx
 *   - C-D26-2 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-2 (B-62/F-62/D-62).
 *
 * Welcome 진입점:
 *   - 첫 진입 (localStorage 'robusta.visitedAt' 0건) → 본 컴포넌트 마운트.
 *   - 시나리오 3 카드 가로 grid (모바일 stack).
 *   - 카드 클릭 → onPick(scenario) — 부모가 페르소나 사전 등록 + 라우팅.
 *
 * 라우팅 (꼬미 자율): 라이브 진입 시 ConversationWorkspace 가 isFirstVisit 가드로
 *   본 컴포넌트를 dynamic import. 시나리오 클릭 시 visitedAt 등록 후 워크스페이스 노출.
 *
 * OCP: 신규 모듈 / 외부 의존 0 (scenario-card + i18n only).
 */

"use client";

import { ScenarioCard } from "./scenario-card";
import { SCENARIO_CATALOG_V1, type ScenarioPreset } from "./scenario-catalog";
// C-D27-1 (D6 15시 슬롯, 2026-05-02) — catalog 키는 catalog-i18n.ts (lazy chunk).
import { tc } from "@/modules/i18n/catalog-i18n";

export interface WelcomeViewProps {
  onPick: (preset: ScenarioPreset) => void;
}

export function WelcomeView({ onPick }: WelcomeViewProps) {
  return (
    <section
      className="mx-auto max-w-3xl px-4 py-8"
      data-test="welcome-view"
      aria-label={tc("scenario.welcome.headline")}
    >
      <header className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-robusta-ink">
          {tc("scenario.welcome.headline")}
        </h2>
        <p className="mt-2 text-sm text-robusta-inkDim">
          {tc("scenario.welcome.body")}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SCENARIO_CATALOG_V1.map((preset) => (
          <ScenarioCard key={preset.id} preset={preset} onSelect={onPick} />
        ))}
      </div>
    </section>
  );
}
