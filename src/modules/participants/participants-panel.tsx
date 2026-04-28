/**
 * participants-panel.tsx
 *   - D2: 참여자 목록 + 추가/편집/삭제 (ParticipantForm 모달).
 *   - D4 (D-9.2, P0, 2026-04-29): 카드 우상단 [⚙] 인격 모달 트리거 추가.
 *     · ⚙ 클릭 → PersonaModal (name/role/systemPrompt/model 편집).
 *     · [⋯] 메뉴는 [삭제]만 남김 (편집 = ⚙로 일원화).
 *     · AI + systemPrompt 비어있지 않음 → 이름 옆 작은 점 시그널 (hue dim).
 *     · role 입력됨 → 이름 아래 1줄 표시 (12px inkDim, ellipsis).
 *   - 모바일 반응형 (Do 4/27 #9): 텍스트 오버플로우 방지 — truncate 유지.
 *   - D7 (D-13.5, P0, 2026-04-29): [+참여자 추가] → PersonaPickerModal 진입.
 *     · 프리셋 카드 1클릭 → 해당 페르소나로 Participant 즉시 생성.
 *     · "직접 만들기" → PersonaEditModal 빈 폼 → 저장 후 Participant 생성.
 *     · 참여자 제한 (Roy `Do` #10): 총 ≤4 / 인간 ≤2 / AI ≤3. 초과 시 picker 진입 차단 + 토스트.
 *   - D8 (D-14, P0, 2026-04-28):
 *     · D-14.1: PersonaEditModal을 next/dynamic 으로 lazy 로드 (1st Load JS 회복).
 *     · D-14.2: 제한 도달 시 picker 진입 유지(닫지 않음). 카드 disabled + 1회 토스트.
 *     · D-14.3: ⚙ 클릭 → PersonaEditModal mode='edit' 직접 호출 (PersonaModal shim 미사용).
 *     · D-14.4: data-test='add-participant' / 'settings-button' 박음 (모바일 320px 회귀 자동화).
 */

"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { usePersonaStore } from "@/modules/personas/persona-store";
import {
  colorTokenToCssVar,
  participantToPersonaInput,
  personaInputToParticipant,
  type Persona,
  type PersonaInput,
  type PersonaKind,
} from "@/modules/personas/persona-types";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
import type { Participant } from "./participant-types";

/**
 * D-14.1 (Day 8) PersonaEditModal/PersonaPickerModal 모두 lazy 로드.
 *   - 사용자가 [+참여자 추가] 클릭 시점에만 Picker 청크 로드.
 *   - "직접 만들기" 클릭 또는 ⚙ 클릭 시점에만 EditModal 청크 로드.
 *   - SSR=false: IndexedDB persona-store/participant-store 의존.
 *   - loading: null — 모달이 로드되기 전엔 렌더 안 함 (오프라인 시 silent fail).
 *   - 1st Load JS 게이트 ≤155KB 회복 (D7 157→155 이하).
 */
const PersonaEditModal = dynamic(
  () =>
    import("@/modules/personas/persona-edit-modal").then(
      (m) => m.PersonaEditModal,
    ),
  { ssr: false, loading: () => null },
);
const PersonaPickerModal = dynamic(
  () =>
    import("@/modules/personas/persona-picker-modal").then(
      (m) => m.PersonaPickerModal,
    ),
  { ssr: false, loading: () => null },
);

/** 참여자 제한 — Roy `Do` 메모 #10. */
const PARTICIPANT_LIMIT_TOTAL = 4;
const PARTICIPANT_LIMIT_HUMAN = 2;
const PARTICIPANT_LIMIT_AI = 3;

/** 페르소나 → 참여자 추가 변환. colorToken은 CSS var로 박음. */
function personaToParticipantInput(p: Persona): {
  name: string;
  kind: Participant["kind"];
  color: string;
  role?: string;
  model?: string;
  systemPrompt?: string;
} {
  return {
    name: p.nameKo || p.nameEn,
    kind: p.kind,
    color: colorTokenToCssVar(p.colorToken),
    role: p.nameEn || undefined,
    model: p.kind === "ai" ? "claude-sonnet-4-6" : undefined,
    systemPrompt: p.kind === "ai" ? p.systemPromptKo || "" : undefined,
  };
}

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
  const add = useParticipantStore((s) => s.add);
  const remove = useParticipantStore((s) => s.remove);
  const update = useParticipantStore((s) => s.update);
  // D-13.5: 페르소나 카탈로그 hydrate + lookup.
  const personaHydrated = usePersonaStore((s) => s.hydrated);
  const hydratePersonas = usePersonaStore((s) => s.hydrate);
  const personasFromStore = usePersonaStore((s) => s.personas);
  const pushToast = useToastStore((s) => s.push);

  // ~~D-9.2 ParticipantForm 모달~~ → D7부터 PersonaPickerModal 진입.
  // D-14.1 (Day 8): ParticipantForm fallback 진입점 0건 — 본 컴포넌트에서 import 제거하여
  //   lazy 청크 분리와 함께 1st Load JS 게이트 회복. 본 코드는 ./participant-form.tsx에 잔존.
  // D-13.5: PersonaPickerModal 표시 여부.
  const [showPicker, setShowPicker] = useState(false);
  // D-13.5: PersonaEditModal "직접 만들기" 진입용 — null이면 닫힘, kind 박혀있으면 빈 폼 진입.
  const [editKind, setEditKind] = useState<PersonaKind | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // D-9.2 → D-14.3 (Day 8) ⚙ 모달 대상 참여자 (null = 닫힘). PersonaEditModal mode='edit' 직접 진입.
  const [personaTarget, setPersonaTarget] = useState<Participant | null>(null);

  const displayNames = useMemo(() => buildDisplayNames(participants), [participants]);

  // D-13.5: 페르소나 카탈로그 1회 hydrate.
  useEffect(() => {
    if (!personaHydrated) void hydratePersonas();
  }, [personaHydrated, hydratePersonas]);

  /**
   * D-13.5: 참여자 제한 검증. kind에 따라 허용/거부.
   * 거부 시 토스트 노출, 호출자는 false를 받아 picker 닫지 않음.
   */
  function canAddParticipant(kind: Participant["kind"]): boolean {
    if (participants.length >= PARTICIPANT_LIMIT_TOTAL) return false;
    if (kind === "human") {
      const humans = participants.filter((p) => p.kind === "human").length;
      if (humans >= PARTICIPANT_LIMIT_HUMAN) return false;
    } else {
      const ais = participants.filter((p) => p.kind === "ai").length;
      if (ais >= PARTICIPANT_LIMIT_AI) return false;
    }
    return true;
  }

  function showLimitToast() {
    pushToast({
      tone: "info",
      message: t("persona.error.participantLimit"),
    });
  }

  async function handlePickPreset(personaId: string) {
    const persona = personasFromStore.find((p) => p.id === personaId);
    if (!persona) return;
    if (!canAddParticipant(persona.kind)) {
      showLimitToast();
      return;
    }
    try {
      await add(personaToParticipantInput(persona));
      setShowPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가 실패");
    }
  }

  function handleCreateCustom(kind: PersonaKind) {
    if (!canAddParticipant(kind)) {
      showLimitToast();
      return;
    }
    setShowPicker(false);
    setEditKind(kind);
  }

  /** PersonaEditModal 저장 후 호출 — 새 커스텀 페르소나로 즉시 Participant 추가. */
  async function handleEditSaved(persona: Persona) {
    if (!canAddParticipant(persona.kind)) {
      showLimitToast();
      return;
    }
    try {
      await add(personaToParticipantInput(persona));
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가 실패");
    }
  }

  function handleAddClick() {
    // D-14.2: 제한 초과여도 picker 진입 유지(닫지 않음). picker 내부에서 카드 disabled + 토스트 1회.
    setShowPicker(true);
  }

  /**
   * D-14.3 ⚙ 클릭 → PersonaEditModal mode='edit' 직접 호출.
   *   PersonaInput을 받아 Participant로 역변환 후 store.update.
   */
  async function handleEditSubmit(input: PersonaInput): Promise<void> {
    if (!personaTarget) return;
    const next = personaInputToParticipant(personaTarget, input);
    await update(personaTarget.id, {
      name: next.name,
      color: next.color,
      systemPrompt: next.systemPrompt,
    });
  }

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
              {/* D-9.2 / D-14.3: ⚙ 인격 모달 트리거 — PersonaEditModal mode='edit' 직접 진입.
                  D-14.4: data-test='settings-button' 박음 (모바일 320px 회귀 자동화). */}
              <button
                type="button"
                aria-label={t("card.persona")}
                title={t("card.persona")}
                data-test="settings-button"
                className="rounded overflow-hidden p-1 text-robusta-inkDim hover:text-robusta-ink whitespace-nowrap"
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
        {/* D-14.4: data-test='add-participant' 박음 (모바일 320px 회귀 자동화 셀렉터). */}
        <button
          type="button"
          onClick={handleAddClick}
          data-test="add-participant"
          className="
            w-full overflow-hidden rounded
            border border-dashed border-robusta-divider
            px-3 py-2 text-sm text-robusta-ink
            hover:border-robusta-accent hover:text-robusta-accent
            truncate whitespace-nowrap
          "
        >
          + 참여자 추가
        </button>
      </div>

      {/* D-13.5: 신규 픽커 — 프리셋 6종 카드 + "직접 만들기" */}
      {showPicker && (
        <PersonaPickerModal
          onPick={(id) => void handlePickPreset(id)}
          onCreateCustom={handleCreateCustom}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* D-13.5: "직접 만들기" 진입 — 빈 폼 + 저장 후 Participant 자동 추가 */}
      {editKind && (
        <PersonaEditModal
          initialKind={editKind}
          onClose={() => setEditKind(null)}
          onSaved={(p) => void handleEditSaved(p)}
        />
      )}

      {/* D-14.1: ParticipantForm fallback 진입점 0건 — D7부터 비활성. import 제거(파일은 잔존). */}

      {/* D-14.3: ⚙ 클릭 시 PersonaEditModal mode='edit' 직접 진입.
          기존 PersonaModal shim은 외부 caller 호환만 위해 잔존(외부 import 없으면 D9에 삭제 예정). */}
      {personaTarget && (
        <PersonaEditModal
          mode="edit"
          participantId={personaTarget.id}
          initial={{
            id: `shim:${personaTarget.id}`,
            createdAt: 0,
            updatedAt: 0,
            ...participantToPersonaInput(personaTarget),
          }}
          onClose={() => setPersonaTarget(null)}
          onSubmit={handleEditSubmit}
        />
      )}
    </aside>
  );
}
