/**
 * persona-modal.tsx
 *   - D-9.2 (Day 4, 2026-04-29) ~~본격 인격/R&R 설정 모달 (name/role/systemPrompt/model 직접 정의)~~
 *   - D-14.3 (Day 8, 2026-04-28) **shim**으로 전환. 잡스식 모달 일원화 — Tori 4/28 #13.
 *     · 본 컴포넌트는 외부 caller(외부 import) 호환만 위해 잔존. 본문은 PersonaEditModal에 위임.
 *     · participants-panel은 D-14.3 이후 본 shim 미사용 (PersonaEditModal mode='edit' 직접 호출).
 *     · 외부 import 0건 grep 결과 D9에서 본 파일 자체 삭제 검토 (꼬미 자율 §9).
 *
 * 동작 (외부 caller가 박을 경우):
 *   1. participantToPersonaInput으로 가짜 Persona 생성 (편집 모드 표시용).
 *   2. PersonaEditModal mode='edit' + onSubmit 콜백 정의.
 *   3. onSubmit 안에서 personaInputToParticipant로 역변환 + useParticipantStore.update 호출.
 *   4. 토스트는 PersonaEditModal 내부에서 처리.
 */

"use client";

import { PersonaEditModal } from "@/modules/personas/persona-edit-modal";
import {
  participantToPersonaInput,
  personaInputToParticipant,
  type PersonaInput,
} from "@/modules/personas/persona-types";
import type { Participant } from "@/modules/participants/participant-types";
import { useParticipantStore } from "@/stores/participant-store";

interface PersonaModalProps {
  participant: Participant;
  onClose: () => void;
}

export function PersonaModal({ participant, onClose }: PersonaModalProps) {
  const update = useParticipantStore((s) => s.update);

  // D-14.3: 가짜 Persona 합성 — id/createdAt/updatedAt은 미사용 (mode='edit'에서 외부 저장).
  const fakePersona = {
    id: `shim:${participant.id}`,
    createdAt: 0,
    updatedAt: 0,
    ...participantToPersonaInput(participant),
  };

  async function handleSubmit(input: PersonaInput): Promise<void> {
    const next = personaInputToParticipant(participant, input);
    // 변경된 필드만 추려서 update 호출 (model/role 등은 prev 보존됨).
    await update(participant.id, {
      name: next.name,
      color: next.color,
      systemPrompt: next.systemPrompt,
    });
  }

  return (
    <PersonaEditModal
      mode="edit"
      participantId={participant.id}
      initial={fakePersona}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
