/**
 * useConversationEmptyState.ts
 *   - C-D19-2 (D6 07시 슬롯, 2026-05-01) — F-28 / 꼬미 §1 ② 발견사항 흡수.
 *   - emptyStateRegistry(C-D18-3) 의 zeroParticipants/onlyHuman/zeroMessages variant 를
 *     실제 conversation 상태(participants/messages)에 따라 자동 분기.
 *
 * 단일 책임 (Roy id-9 OCP):
 *   - 빈 상태 분기 규칙만 담당. UI 렌더링/콜백은 호출자(EmptyStateCta) 책임.
 *
 * 분기 규칙 (똘이 §6 C-D19-2):
 *   1. participants.length === 0                                  → 'zeroParticipants'
 *   2. participants.length >= 1 && all human                       → 'onlyHuman'
 *   3. participants.some(ai) && messages.length === 0              → 'zeroMessages'
 *   4. 그 외 (정상 진행 중)                                          → kind: 'none'
 *   5. SSR/미로드 상태 (loaded === false)                            → kind: 'none' (FOUC 방지)
 */

import type { Message } from "@/modules/conversation/conversation-types";
import type { Participant } from "@/modules/participants/participant-types";
import type { EmptyKey } from "@/modules/onboarding/empty-state-registry";

export interface ConversationEmptyStateInput {
  participants: Participant[];
  messages: Message[];
  /** 미로드 단계(SSR 또는 hydrated=false) 시 false 전달 — FOUC 방지. */
  loaded?: boolean;
}

export type ConversationEmptyStateResult =
  | { kind: "none" }
  | { kind: "show"; variant: EmptyKey };

/**
 * 분기 규칙 — pure function. 테스트 가능.
 */
export function computeConversationEmptyState(
  input: ConversationEmptyStateInput,
): ConversationEmptyStateResult {
  const { participants, messages, loaded = true } = input;

  if (!loaded) return { kind: "none" };

  if (participants.length === 0) {
    return { kind: "show", variant: "zeroParticipants" };
  }

  const hasAi = participants.some((p) => p.kind === "ai");
  if (!hasAi) {
    // 1명 이상 + 전원 인간 (다중 인간 룸도 동일 처리 — B-22 룸 템플릿 일부 케이스)
    return { kind: "show", variant: "onlyHuman" };
  }

  if (hasAi && messages.length === 0) {
    return { kind: "show", variant: "zeroMessages" };
  }

  return { kind: "none" };
}

/**
 * React 훅 form — 추후 reactive 의존성(예: i18n locale) 추가 시 확장점.
 * 현재는 computeConversationEmptyState 의 thin wrapper.
 */
export function useConversationEmptyState(
  input: ConversationEmptyStateInput,
): ConversationEmptyStateResult {
  return computeConversationEmptyState(input);
}
