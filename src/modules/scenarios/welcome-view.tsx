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
// C-D33-5 (D-5 19시 슬롯, 2026-05-03) — Hero sub-카피 (B-D33-4 / D-D33-5).
//   Robusta 컨셉 사수 — "통찰 = 출력" 한 줄 강화.
import { t } from "@/modules/i18n/messages";
// C-D38-1 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-1 (B-D38-1 (d) Show HN 카피 v3).
//   자율 정정 D-38-자-1: page.tsx 가 단순 라우터라 실제 Hero 자리인 welcome-view 헤더에 wiring.
import { ShowHnCopyV3 } from "@/modules/landing/show-hn-copy";
// C-D38-3 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-3 (V-D38-1 (b) 인라인 hero 3-step strip).
import { Intro3Step } from "@/modules/landing/intro-3-step";
// C-D42-1 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42-1 (B-D42-1 라운드테이블 포지셔닝).
//   자율 정정 D-42-자-1: 명세 hero-title-slot.tsx 마운트 위치 = welcome-view header (ShowHnCopyV3 아래).
import HeroTitleSlot from "@/modules/ui/hero-title-slot";
// C-D42-2 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42-2 (F-D42-5 빈 페이지 공포 해소 5칩).
import KeywordChips, { type ChipId } from "@/modules/ui/keyword-chips";
// C-D43-2 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-2 (F-D43-2 / B-D43-5 / V-D43-4).
//   Hero 보조 CTA — 회의록 .md 다운로드. 5턴 미만 시 disabled.
import MeetingRecordButton from "@/modules/ui/meeting-record-button";
// C-D42-1 / C-D42-4 — Hero v4 + LIVE 펄스 자동 전환 시점 결정 (RELEASE_ISO SoT).
import { isLive } from "@/modules/dday/dday-config";

export interface WelcomeViewProps {
  onPick: (preset: ScenarioPreset) => void;
}

// C-D42-2: chip 클릭 시 chat-input pre-fill 키 (workspace wiring D+1 후속 위임).
//   본 v0는 sessionStorage 저장만 — chat-input 미마운트 분기 (welcome → workspace 라우팅 직전).
const CHIP_PREFILL_KEY = "robusta:chip-prefill";

function handleChipSelect(chipId: ChipId): void {
  // SSR 가드 — 'use client' 자식 컴포넌트 onSelect 콜백이라 window 정의 보장이지만 안전.
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHIP_PREFILL_KEY, chipId);
  } catch {
    // private mode 등 차단 — silent.
  }
}

export function WelcomeView({ onPick }: WelcomeViewProps) {
  return (
    <section
      className="mx-auto max-w-3xl px-4 py-8"
      data-test="welcome-view"
      aria-label={tc("scenario.welcome.headline")}
    >
      <header className="mb-6 text-center">
        {/* C-D38-1 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-1 / B-D38-1 (d). Show HN 카피 v3 — 5/7 21:00 ET submit 정합. */}
        <ShowHnCopyV3 />
        {/* C-D42-1 (D-3 11시 슬롯, 2026-05-05) — Hero v4 라운드테이블 슬롯 + LIVE 펄스 자동 전환.
            기존 hero.sub (D-5) OCP 보존 — 신규 v4 슬롯은 추가 노출. */}
        <HeroTitleSlot liveMode={isLive()} />
        <h2 className="text-xl font-semibold text-robusta-ink mt-6">
          {tc("scenario.welcome.headline")}
        </h2>
        <p className="mt-2 text-sm text-robusta-inkDim">
          {tc("scenario.welcome.body")}
        </p>
        {/* C-D33-5 (D-5 19시 슬롯, 2026-05-03) — Hero sub. Robusta 컨셉 ("통찰 = 출력") 한 줄 강화. */}
        <p
          data-test="hero-sub"
          className="mt-2 text-base text-robusta-inkDim"
        >
          {t("hero.sub")}
        </p>
        {/* C-D38-3 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-3 / V-D38-1 (b). 인라인 hero strip 3 dots — 메시지 1+ 후 자동 unmount. */}
        <div className="mt-4 flex justify-center">
          <Intro3Step />
        </div>
        {/* C-D42-2 (D-3 11시 슬롯, 2026-05-05) — keyword chips 5종. 클릭 시 sessionStorage 사전 채움 (workspace D+1 wiring). */}
        <div className="mt-4 flex justify-center">
          <KeywordChips onSelect={handleChipSelect} />
        </div>
        {/* C-D43-2 (D-3 15시 슬롯, 2026-05-05) — Hero 보조 CTA: 회의록 .md 다운로드 (5턴 후 활성). */}
        <div className="mt-3 flex justify-center">
          <MeetingRecordButton />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SCENARIO_CATALOG_V1.map((preset) => (
          <ScenarioCard key={preset.id} preset={preset} onSelect={onPick} />
        ))}
      </div>
    </section>
  );
}
