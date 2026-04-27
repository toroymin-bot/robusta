/**
 * persona-picker-modal.tsx — D-13.3 (Day 7, 2026-04-29) 페르소나 추가 모달.
 *
 * 진입점: 워크스페이스 [+참여자 추가] 버튼.
 * 구성:
 *   - AI/인간 토글 (default AI)
 *   - 프리셋 카드 (kind=ai → 5개 / kind=human → 1개), 1열(<768px) / 3열(≥768px)
 *   - "직접 만들기" — onCreateCustom 콜백 (부모가 PersonaEditModal 열어줌)
 *
 * 모바일 가드 (Roy `Do` 메모 #9):
 *   - 모달 max-width 640px / max-height 90vh / overflow-y auto
 *   - 카드 내부 텍스트는 truncate + 모노그램 32×32 white-space:nowrap
 *
 * a11y:
 *   - role=dialog + aria-modal=true + 첫 카드 focus
 *   - ESC 닫힘 / 카드 role=button / Enter·Space 처리
 *
 * onPick(presetId) — 카드 클릭 즉시 호출 (확인 모달 X — 잡스식 즉답).
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePersonaStore } from "./persona-store";
import {
  colorTokenToCssVar,
  type Persona,
  type PersonaKind,
} from "./persona-types";
import { t } from "@/modules/i18n/messages";

interface PersonaPickerModalProps {
  /** 카드 클릭 시 호출 — preset id 또는 사용자 커스텀 페르소나 id. */
  onPick: (personaId: string) => void;
  /** "직접 만들기" 클릭 시 호출 — 부모가 PersonaEditModal 열어줌. */
  onCreateCustom: (kind: PersonaKind) => void;
  onClose: () => void;
}

export function PersonaPickerModal({
  onPick,
  onCreateCustom,
  onClose,
}: PersonaPickerModalProps) {
  const personas = usePersonaStore((s) => s.personas);
  const hydrated = usePersonaStore((s) => s.hydrated);
  const hydrate = usePersonaStore((s) => s.hydrate);

  const [kind, setKind] = useState<PersonaKind>("ai");
  const firstCardRef = useRef<HTMLButtonElement | null>(null);

  // hydrate 보장 — 워크스페이스에서 이미 호출했어도 멱등.
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // ESC 닫기 + 첫 카드 focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // toggle 변경 시 첫 카드로 포커스 이동
    firstCardRef.current?.focus();
  }, [kind]);

  // 프리셋만 박음 (커스텀은 별도 흐름 — 명세 §4)
  const cards: Persona[] = useMemo(
    () => personas.filter((p) => p.isPreset && p.kind === kind),
    [personas, kind],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="
          flex max-h-[90vh] w-full max-w-[640px] flex-col
          overflow-y-auto rounded-lg
          border border-robusta-divider bg-robusta-canvas
          p-6 shadow-xl
        "
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="persona-picker-title"
            className="text-lg font-semibold text-robusta-ink"
          >
            {t("persona.picker.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.action.cancel")}
            className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
          >
            ×
          </button>
        </div>

        {/* AI/인간 토글 */}
        <div
          className="mb-4 flex gap-1 rounded border border-robusta-divider p-1"
          role="tablist"
        >
          {(["ai", "human"] as const).map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setKind(k)}
                className={`
                  flex-1 rounded px-3 py-1.5 text-sm
                  ${
                    active
                      ? "bg-robusta-accent text-black"
                      : "text-robusta-ink hover:bg-robusta-accentSoft/40"
                  }
                `}
              >
                {k === "ai"
                  ? t("persona.picker.toggleAi")
                  : t("persona.picker.toggleHuman")}
              </button>
            );
          })}
        </div>

        {/* 프리셋 카드 grid: 모바일 1열, ≥768px 3열 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cards.map((p, idx) => (
            <button
              key={p.id}
              ref={idx === 0 ? firstCardRef : undefined}
              type="button"
              role="button"
              tabIndex={0}
              onClick={() => onPick(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(p.id);
                }
              }}
              className="
                flex items-center gap-3
                rounded-md border border-robusta-divider
                bg-robusta-canvas p-3 text-left
                hover:border-robusta-accent
                focus:border-robusta-accent focus:outline-none
              "
              style={{
                borderLeftColor: colorTokenToCssVar(p.colorToken),
                borderLeftWidth: 4,
              }}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: colorTokenToCssVar(p.colorToken),
                  whiteSpace: "nowrap",
                }}
              >
                {p.iconMonogram}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-robusta-ink">
                  {p.nameKo}
                </span>
                <span className="block truncate text-xs text-robusta-inkDim">
                  {p.nameEn}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div className="my-4 flex items-center gap-2 text-xs text-robusta-inkDim">
          <span className="flex-1 border-t border-robusta-divider" />
          <span>또는</span>
          <span className="flex-1 border-t border-robusta-divider" />
        </div>

        {/* 직접 만들기 */}
        <button
          type="button"
          onClick={() => onCreateCustom(kind)}
          className="
            w-full rounded
            border border-dashed border-robusta-divider
            px-3 py-2 text-sm text-robusta-ink
            hover:border-robusta-accent hover:text-robusta-accent
            whitespace-nowrap
          "
        >
          {t("persona.picker.customCta")}
        </button>
      </div>
    </div>
  );
}
