/**
 * scenario-pick.ts
 *   - C-D27-3 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-3 (B-68/F-68/D-68).
 *
 * Why: Welcome 카드 클릭 → 시나리오 사전 등록 흐름의 _순수 함수_ — deps 주입으로 테스트 가능.
 *   1. 시나리오 personaPresets 3종 → CATALOG lookup → registerPersona
 *   2. 시드 placeholder 설정 (호출자가 입력 바에 반영)
 *   3. visitedAt 기록
 *   4. workspace 전환
 *
 * 시드 카피: catalog-i18n.ts 의 tc() 로 lookup ('scenario.{key}.seed').
 *   본 파일은 lazy 모듈 — 호출처(welcome-view) 도 lazy import 됨.
 *
 * OCP: 외부 의존 — scenario-catalog (메타) + persona-catalog (preset id) + catalog-i18n (시드).
 *   deps 인터페이스로 store/router 분리 — store 스파게티 회피.
 */

"use client";

import type { ScenarioPreset } from "./scenario-catalog";
import { PERSONA_CATALOG_V1, type PersonaCatalogEntry } from "@/modules/personas/persona-catalog";
import { tc, type CatalogKey } from "@/modules/i18n/catalog-i18n";

export interface PickScenarioDeps {
  registerPersona: (entry: PersonaCatalogEntry) => void;
  setSeedPlaceholder: (text: string) => void;
  markVisited: () => void;
  switchToWorkspace: () => void;
}

export function pickScenario(
  scenario: ScenarioPreset,
  deps: PickScenarioDeps,
): void {
  // 1. 3 페르소나 사전 등록 (catalog lookup 실패 시 skip — 메타 무결성 가드)
  for (const presetId of scenario.personaPresets) {
    const entry = PERSONA_CATALOG_V1.find((p) => p.id === presetId);
    if (!entry) continue;
    deps.registerPersona(entry);
  }
  // 2. 시드 placeholder — `scenario.{key}.seed`
  const seedKey = `${scenario.i18nKey}.seed` as CatalogKey;
  const seed = tc(seedKey);
  deps.setSeedPlaceholder(seed);
  // 3. visitedAt 기록
  deps.markVisited();
  // 4. workspace 전환
  deps.switchToWorkspace();
}
