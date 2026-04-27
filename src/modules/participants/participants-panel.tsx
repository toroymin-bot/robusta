/**
 * participants-panel.tsx
 *   - D2: 참여자 목록 + 추가/편집/삭제 (ParticipantForm 모달).
 *   - D4 (D-9.2, P0, 2026-04-29): 카드 우상단 [⚙] 인격 모달 트리거 추가.
 *     · ⚙ 클릭 → PersonaModal (name/role/systemPrompt/model 편집).
 *     · [⋯] 메뉴는 [삭제]만 남김 (편집 = ⚙로 일원화).
 *     · AI + systemPrompt 비어있지 않음 → 이름 옆 작은 점 시그널 (hue dim).
 *     · role 입력됨 → 이름 아래 1줄 표시 (12px inkDim, ellipsis).
 *   - 모바일 반응형 (Do 4/27 #9): 텍스트 오버플로우 방지 — truncate 유지.
 */

"use client";

import { useMemo, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { ParticipantForm } from "./participant-form";
import { PersonaModal } from "@/modules/conversation/persona-modal";
import { t } from "@/modules/i18n/messages";
import type { Participant } from "./participant-types";

function buildDisplayNames(participants: Participant[]): Map<string, string> {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const p of participants) {
    counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const p of participants) {
    if ((counts.get(p.name) ?? 0) > 1) {
      const next = (seen.get(p.name) ?? 0) + 1;
      seen.set(p.name, next);
      out.set(p.id, `${p.name} (${next})`);
    } else {
      out.set(p.id, p.name);
    }
  }
  return out;
}

export function ParticipantsPanel() {
  const participants = useParticipantStore((s) => s.participants);
  const remove = useParticipantStore((s) => s.remove);

  const [showForm, setShowForm] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // D-9.2: persona modal 대상 참여자 (null = 닫힘)
  const [personaTarget, setPersonaTarget] = useState<Participant | null>(null);

  const displayNames = useMemo(() => buildDisplayNames(participants), [participants]);

  async function handleRemove(id: string) {
    setError(null);
    try {
      await remove(id);
      setOpenMenuId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-robusta-divider bg-robusta-canvas">
      <header className="px-4 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-robusta-inkDim">
          참여자
        </h2>
      </header>

      <ul className="flex-1 overflow-y-auto px-2">
        {participants.map((p) => {
          // D-9.2: AI 참여자에 systemPrompt가 비어있지 않으면 시그널 점.
          const hasPersona =
            p.kind === "ai" && (p.systemPrompt?.trim().length ?? 0) > 0;
          return (
            <li
              key={p.id}
              className="
                group relative
                flex items-start gap-3
                rounded-md px-2 py-2
                text-sm text-robusta-ink
                hover:bg-robusta-accentSoft/40
              "
            >
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1">
                  <span className="truncate">{displayNames.get(p.id) ?? p.name}</span>
                  {hasPersona && (
                    <span
                      className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-robusta-inkDim/60"
                      aria-label="인격 설정됨"
                      title={t("card.persona")}
                    />
                  )}
                </div>
                {p.role && p.role.trim().length > 0 && (
                  <span className="truncate text-[12px] text-robusta-inkDim">
                    {p.role}
                  </span>
                )}
              </div>
              <span className="rounded border border-robusta-divider px-1.5 py-0.5 text-[10px] uppercase text-robusta-inkDim">
                {p.kind === "ai" ? "AI" : "Human"}
              </span>
              {/* D-9.2: ⚙ 인격 모달 트리거 — 카드 우상단 직행 */}
              <button
                type="button"
                aria-label={t("card.persona")}
                title={t("card.persona")}
                className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
                onClick={() => {
                  setOpenMenuId(null);
                  setPersonaTarget(p);
                }}
              >
                ⚙
              </button>
              <button
                type="button"
                aria-label="메뉴"
                className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
                onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
              >
                ⋯
              </button>
              {openMenuId === p.id && (
                <div className="absolute right-2 top-9 z-10 w-32 rounded border border-robusta-divider bg-robusta-canvas shadow-md">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => handleRemove(p.id)}
                  >
                    삭제
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="px-4 pb-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="border-t border-robusta-divider p-3">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="
            w-full rounded
            border border-dashed border-robusta-divider
            px-3 py-2 text-sm text-robusta-ink
            hover:border-robusta-accent hover:text-robusta-accent
            whitespace-nowrap
          "
        >
          + 참여자 추가
        </button>
      </div>

      {showForm && (
        <ParticipantForm onClose={() => setShowForm(false)} />
      )}

      {personaTarget && (
        <PersonaModal
          participant={personaTarget}
          onClose={() => setPersonaTarget(null)}
        />
      )}
    </aside>
  );
}
