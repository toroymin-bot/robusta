/**
 * buildRoomLike.ts
 *   - C-D22-1 (D6 19시 슬롯, 2026-05-01) — F-24 Export UI 와이어업의 매퍼 단계.
 *
 * 책임 (Single Responsibility):
 *   - ConversationStore + ParticipantStore → roomExporter.RoomLike 변환만 수행.
 *   - SSR 가드 / 다운로드 / 메뉴 마크업은 비-책임.
 *
 * 정책:
 *   - activeConversation 미존재(=hydrate 전) → null 반환. 호출자가 SSR/disabled 처리.
 *   - 메시지의 status='streaming' 도 그대로 포함 (사용자가 실시간 스냅샷 export 가능).
 *   - role 매핑: Participant.kind('human'|'ai') → ExportParticipant.role 동일 문자열로 보존.
 *   - Message.role: 우리 도메인은 단일 'message' 모델 → exporter 의 'system'|'user'|'assistant'
 *     중 인간은 'user', AI 는 'assistant' 로 단순 매핑. system 메시지 개념 미존재 → 사용 안 함.
 *
 * 비-책임:
 *   - 다운로드 트리거(useRoomExport).
 *   - i18n 카피.
 */

"use client";

import type {
  Conversation,
  Message,
} from "@/modules/conversation/conversation-types";
import type { Participant } from "@/modules/participants/participant-types";
import type {
  RoomLike,
  ExportMessage,
  ExportParticipant,
  ExportRoomMeta,
} from "@/services/export/roomExporter";

export interface BuildRoomLikeInput {
  conversation: Conversation | undefined;
  messages: Message[];
  participants: Participant[];
}

function toExportMeta(c: Conversation): ExportRoomMeta {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function toExportParticipant(p: Participant): ExportParticipant {
  return { id: p.id, name: p.name, role: p.kind };
}

function toExportMessage(m: Message, participantKind: Participant["kind"] | undefined): ExportMessage {
  // 인간 → user / AI → assistant. system 메시지 개념 미존재.
  const role: ExportMessage["role"] = participantKind === "ai" ? "assistant" : "user";
  return {
    id: m.id,
    participantId: m.participantId,
    role,
    content: m.content,
    createdAt: m.createdAt,
  };
}

/**
 * Stores → RoomLike. conversation 미존재 시 null.
 *  - 호출자: useRoomExport opts.getRoom 콜백.
 */
export function buildRoomLike(input: BuildRoomLikeInput): RoomLike | null {
  const { conversation, messages, participants } = input;
  if (!conversation) return null;
  const kindById = new Map<string, Participant["kind"]>();
  for (const p of participants) kindById.set(p.id, p.kind);
  return {
    meta: toExportMeta(conversation),
    participants: participants.map(toExportParticipant),
    messages: messages.map((m) => toExportMessage(m, kindById.get(m.participantId))),
  };
}

export const __build_room_like_internal = {
  toExportMeta,
  toExportParticipant,
  toExportMessage,
};
