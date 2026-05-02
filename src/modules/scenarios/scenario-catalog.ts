/**
 * scenario-catalog.ts
 *   - C-D26-2 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-2 (B-62/F-62/D-62).
 *
 * Why: Robusta 컨셉 (Do §1.1) 의 첫 인상 — 시나리오 3종 사전 정의.
 *   사용자가 카드 클릭 → 시나리오에 맞는 페르소나 3종 자동 사전 등록 + 시드 placeholder.
 *
 * 시나리오 3종 (Do §1.1 표 그대로):
 *   1. 의사결정 검토 (decision-review) — Critical / Optimistic / Data
 *   2. 아이디어 발전 (idea-forge) — Designer / Critical / UserAdvocate
 *   3. 사각지대 발견 (blind-spot) — Critical / Data / UserAdvocate
 *
 * colorHue 는 5베이스 [20,50,150,200,280] 중 1.
 */

export type ScenarioId = "decision-review" | "idea-forge" | "blind-spot";

export interface ScenarioPreset {
  id: ScenarioId;
  /** i18n key namespace — '{key}.title' / '{key}.desc' / '{key}.seed' */
  i18nKey: "scenario.decisionReview" | "scenario.ideaForge" | "scenario.blindSpot";
  /** 사전 등록할 페르소나 catalog id 3종. */
  personaPresets: readonly [string, string, string];
  /** 카드 색상 hue — 5베이스 시드 중 1. */
  colorHue: 20 | 50 | 150 | 200 | 280;
  /** 글리프 (이모지 1자). */
  glyph: "⚖️" | "✨" | "🔍";
}

export const SCENARIO_CATALOG_V1: readonly ScenarioPreset[] = [
  {
    id: "decision-review",
    i18nKey: "scenario.decisionReview",
    personaPresets: [
      "catalog:critical-mate",
      "catalog:optimistic-mate",
      "catalog:data-mate",
    ],
    colorHue: 200,
    glyph: "⚖️",
  },
  {
    id: "idea-forge",
    i18nKey: "scenario.ideaForge",
    personaPresets: [
      "catalog:designer",
      "catalog:critical-mate",
      "catalog:user-advocate",
    ],
    colorHue: 50,
    glyph: "✨",
  },
  {
    id: "blind-spot",
    i18nKey: "scenario.blindSpot",
    personaPresets: [
      "catalog:critical-mate",
      "catalog:data-mate",
      "catalog:user-advocate",
    ],
    colorHue: 280,
    glyph: "🔍",
  },
] as const;
