/**
 * persona-from-preset.ts
 *   - C-D27-4 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-4 (B-69/F-69/D-69).
 *
 * Why: PERSONA_CATALOG_V1 (메타) → Persona (UI/store 1단위) 변환 순수 함수.
 *   호출자: participants-panel.handlePickPreset 의 'catalog:' prefix 분기.
 *
 * 매핑:
 *   - id: 신규 ULID (preset id 자체는 isPreset=false 인 사용자 인스턴스에 1:N)
 *   - kind: 'ai' (catalog v1 5종 모두 AI)
 *   - nameKo: tc(entry.i18nKey) — 본 함수도 lazy chunk 의존 → catalog-i18n 정적 import OK
 *   - nameEn: tc(entry.i18nKey, undefined, 'en')
 *   - colorToken / defaultProvider: entry 그대로
 *   - systemPromptKo/En: ''  — D-D28 후보 (catalog 별 default systemPrompt 보강)
 *   - isPreset: false — 사용자 인스턴스 (편집 가능)
 *
 * OCP: 외부 의존 — catalog-i18n + persona-types. zustand 0 (순수 함수).
 */

"use client";

import { tc, type CatalogKey } from "@/modules/i18n/catalog-i18n";
import type { PersonaCatalogEntry } from "./persona-catalog";
import type { Persona } from "./persona-types";

export function personaFromPreset(entry: PersonaCatalogEntry): Persona {
  const now = Date.now();
  const nameKo = tc(entry.i18nKey as CatalogKey, undefined, "ko");
  const nameEn = tc(entry.i18nKey as CatalogKey, undefined, "en");
  // monogram = ko 첫 글자 (한 글자 이상이면 첫 글자, 빈 문자열이면 'P')
  const iconMonogram = nameKo.slice(0, 1) || "P";
  return {
    id: `persona-${entry.id.replace(/[^a-zA-Z0-9-]/g, "_")}-${now}`,
    kind: "ai",
    isPreset: false,
    nameKo,
    nameEn,
    colorToken: entry.colorToken,
    iconMonogram,
    systemPromptKo: "",
    systemPromptEn: "",
    defaultProvider: entry.defaultProvider,
    createdAt: now,
    updatedAt: now,
  };
}
