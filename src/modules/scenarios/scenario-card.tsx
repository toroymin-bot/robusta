/**
 * scenario-card.tsx
 *   - C-D26-2 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-2 (B-62/F-62/D-62).
 *
 * 카드: 글리프 + 시나리오 색 좌측 보더 + title + desc 1줄 + "시작" 버튼.
 *   클릭 시 onSelect(scenario) — 부모(Welcome)가 페르소나 사전 등록 + 시드 placeholder.
 *
 * 디자인 (D-62):
 *   - 12px padding (p-3) / 시나리오 색 좌측 4px border-l / 1줄 desc / 우하단 시작 버튼.
 *   - 모바일 grid-cols-1, 데스크탑 grid-cols-3.
 */

"use client";

import { t, type MessageKey } from "@/modules/i18n/messages";
import type { ScenarioPreset } from "./scenario-catalog";

export interface ScenarioCardProps {
  preset: ScenarioPreset;
  onSelect: (preset: ScenarioPreset) => void;
}

export function ScenarioCard({ preset, onSelect }: ScenarioCardProps) {
  const titleKey = `${preset.i18nKey}.title` as MessageKey;
  const descKey = `${preset.i18nKey}.desc` as MessageKey;
  const bg = `hsl(${preset.colorHue}, 65%, 55%)`;
  return (
    <button
      type="button"
      data-test={`scenario-card-${preset.id}`}
      onClick={() => onSelect(preset)}
      className="
        flex flex-col gap-2
        rounded-md border border-robusta-divider
        bg-robusta-canvas p-3 text-left
        hover:border-robusta-accent focus:border-robusta-accent focus:outline-none
      "
      style={{
        borderLeftColor: bg,
        borderLeftWidth: 4,
      }}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          {preset.glyph}
        </span>
        <span className="text-sm font-semibold text-robusta-ink">
          {t(titleKey)}
        </span>
      </span>
      <span className="block min-w-0 truncate text-xs text-robusta-inkDim">
        {t(descKey)}
      </span>
      <span className="mt-auto self-end rounded bg-robusta-accentSoft px-2 py-1 text-[11px] text-robusta-ink">
        {t("scenario.start.button")}
      </span>
    </button>
  );
}
