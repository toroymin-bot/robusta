/**
 * persona-catalog-card.tsx
 *   - C-D26-4 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-4 (B-64/F-64/D-64).
 *
 * picker-modal 'catalog' 탭 카드 — 5종 catalog 페르소나의 desc + seedHint preview.
 *   클릭 시 onSelect(preset) — 부모가 사전 등록 + 시드 placeholder.
 *
 * OCP:
 *   - PersonaCardColorDot 재사용 (C-D24-1).
 *   - i18n key는 catalog 의 i18nKey/descriptionKey/seedHintKey 그대로 활용.
 */

"use client";

import { PersonaCardColorDot } from "./persona-card-color-dot";
import { personaColorTokenToHue } from "@/modules/ui/theme-hue";
import { t, type MessageKey } from "@/modules/i18n/messages";
import type { PersonaCatalogEntry } from "./persona-catalog";
import type { PersonaColorToken } from "./persona-types";

export interface PersonaCatalogCardProps {
  preset: PersonaCatalogEntry;
  onSelect: (preset: PersonaCatalogEntry) => void;
}

export function PersonaCatalogCard({
  preset,
  onSelect,
}: PersonaCatalogCardProps) {
  const hue = personaColorTokenToHue(preset.colorToken as PersonaColorToken);
  return (
    <button
      type="button"
      data-test={`catalog-card-${preset.id}`}
      onClick={() => onSelect(preset)}
      className="
        relative flex flex-col gap-1
        rounded-md border border-robusta-divider
        bg-robusta-canvas p-3 text-left
        hover:border-robusta-accent focus:border-robusta-accent focus:outline-none
      "
    >
      <span
        aria-hidden={false}
        className="pointer-events-none absolute right-2 top-2"
      >
        <PersonaCardColorDot hue={hue} locale="ko" size={12} />
      </span>
      <h4 className="pr-6 text-sm font-semibold text-robusta-ink">
        {t(preset.i18nKey as MessageKey)}
      </h4>
      <p className="text-xs text-robusta-inkDim line-clamp-2">
        {t(preset.descriptionKey as MessageKey)}
      </p>
      <span className="mt-1 block text-xs italic text-robusta-inkDim line-clamp-2">
        &quot;{t(preset.seedHintKey as MessageKey)}&quot;
      </span>
    </button>
  );
}
