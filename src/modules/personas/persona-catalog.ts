/**
 * persona-catalog.ts
 *   - C-D25-3 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-3, B-58 페르소나 카탈로그 v1.
 *
 * Spec 004 (5/3 D-5) "스케줄 + 페르소나 보강" 선행 사전 등록.
 *   본 슬롯에서는 _메타데이터만_ 정의 — 기존 preset-catalog.ts (D-13.1 6종) 비파괴.
 *   Spec 004 진입 시 picker-modal 또는 페르소나 선택 흐름에서 default catalog 로 활용 가능.
 *
 * 5종 (잡스 단순 — 인지 한계 친화):
 *   1. Critical Mate — 비판적 동료 (반대 근거)
 *   2. Optimistic Mate — 낙관적 동료 (가능성·기회)
 *   3. Data Mate — 데이터 동료 (사실·근거)
 *   4. Designer — 디자이너 (사용자 경험 시각)
 *   5. User Advocate — 사용자 대변자 (실 사용자 시각)
 *
 * colorToken 매핑은 5베이스 hue 시드(orange/yellow/mint/teal/lilac) 와 1:1.
 * seedHint 는 i18n 키 stub — 본 슬롯은 등록만, 본문 카피는 D-D26 분리 (Tori §9 결정).
 */

import type {
  PersonaColorToken,
  PersonaProvider,
} from "./persona-types";

export interface PersonaCatalogEntry {
  /** 카탈로그 식별자. preset-catalog.ts 와 충돌 금지 — 'catalog:' prefix. */
  id: string;
  /** i18n 키 (이름) — ko/en 양면 등록. */
  i18nKey: `persona.catalog.${string}.name`;
  /** 1줄 설명 i18n 키. */
  descriptionKey: `persona.catalog.${string}.desc`;
  /** 시드 메시지 hint i18n 키 — 본문 stub (D-D26 보강). */
  seedHintKey: `persona.catalog.${string}.seedHint`;
  /** 5베이스 hue 1:1 매핑 (PersonaColorToken). */
  colorToken: PersonaColorToken;
  /** AI 기본 프로바이더 — 사용자가 변경 가능. */
  defaultProvider: PersonaProvider;
}

export const PERSONA_CATALOG_V1: readonly PersonaCatalogEntry[] = [
  {
    id: "catalog:critical-mate",
    i18nKey: "persona.catalog.criticalMate.name",
    descriptionKey: "persona.catalog.criticalMate.desc",
    seedHintKey: "persona.catalog.criticalMate.seedHint",
    colorToken: "robusta-color-participant-1", // → hue 20 (주황)
    defaultProvider: "anthropic",
  },
  {
    id: "catalog:optimistic-mate",
    i18nKey: "persona.catalog.optimisticMate.name",
    descriptionKey: "persona.catalog.optimisticMate.desc",
    seedHintKey: "persona.catalog.optimisticMate.seedHint",
    colorToken: "robusta-color-participant-2", // → hue 50 (노랑)
    defaultProvider: "anthropic",
  },
  {
    id: "catalog:data-mate",
    i18nKey: "persona.catalog.dataMate.name",
    descriptionKey: "persona.catalog.dataMate.desc",
    seedHintKey: "persona.catalog.dataMate.seedHint",
    colorToken: "robusta-color-participant-3", // → hue 150 (민트)
    defaultProvider: "anthropic",
  },
  {
    id: "catalog:designer",
    i18nKey: "persona.catalog.designer.name",
    descriptionKey: "persona.catalog.designer.desc",
    seedHintKey: "persona.catalog.designer.seedHint",
    colorToken: "robusta-color-participant-4", // → hue 200 (청록)
    defaultProvider: "anthropic",
  },
  {
    id: "catalog:user-advocate",
    i18nKey: "persona.catalog.userAdvocate.name",
    descriptionKey: "persona.catalog.userAdvocate.desc",
    seedHintKey: "persona.catalog.userAdvocate.seedHint",
    colorToken: "robusta-color-participant-5", // → hue 280 (라일락)
    defaultProvider: "anthropic",
  },
] as const;
