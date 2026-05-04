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
// C-D27-1 (D6 15시 슬롯, 2026-05-02) — catalog 키는 catalog-i18n.ts (lazy chunk).
import { tc, type CatalogKey } from "@/modules/i18n/catalog-i18n";
// C-D37-4 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-4 (D-D37-1).
//   결정적 personaId → 10-hue palette token. 카드 좌측 4px stripe 시각 차별화.
import { personaHue } from "./persona-hue";
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
  // C-D37-4: 결정적 hue token (10-color palette). 카드 좌측 absolute stripe 만 적용 — 기존 외곽 border 무영향, dot 보존.
  const hueToken = personaHue(preset.id);
  return (
    <button
      type="button"
      data-test={`catalog-card-${preset.id}`}
      data-hue-bg={hueToken.bg}
      onClick={() => onSelect(preset)}
      className="
        relative flex flex-col gap-1
        rounded-md border border-robusta-divider
        bg-robusta-canvas p-3 pl-4 text-left
        hover:border-robusta-accent focus:border-robusta-accent focus:outline-none
        overflow-hidden
      "
    >
      {/* C-D37-4: 좌측 4px hue stripe — 기존 카드 외곽선 무영향. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 h-full w-1 ${hueToken.bg}`}
      />
      <span
        aria-hidden={false}
        className="pointer-events-none absolute right-2 top-2"
      >
        <PersonaCardColorDot hue={hue} locale="ko" size={12} />
      </span>
      <h4 className="pr-6 text-sm font-semibold text-robusta-ink">
        {tc(preset.i18nKey as CatalogKey)}
      </h4>
      <p className="text-xs text-robusta-inkDim line-clamp-2">
        {tc(preset.descriptionKey as CatalogKey)}
      </p>
      <span className="mt-1 block text-xs italic text-robusta-inkDim line-clamp-2">
        &quot;{tc(preset.seedHintKey as CatalogKey)}&quot;
      </span>
    </button>
  );
}
