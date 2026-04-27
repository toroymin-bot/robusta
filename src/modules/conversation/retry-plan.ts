/**
 * retry-plan.ts — D-10.3 (Day 5, 2026-04-28) 메시지 재전송 계획.
 *
 * 순수 함수: 현재 messages 배열과 target messageId를 받아
 * 재전송에 필요한 speaker/history/placeholder/cause를 산출.
 *   - 부작용 없음 (db/네트워크/store 변경 X). 오직 입력 → 출력.
 *   - store.retry가 본 함수의 출력을 받아 appendMessage + streamMessage를 진행.
 *   - self-check가 직접 호출하여 결정 로직 검증 (브라우저 없이 동작).
 *
 * 검증 규칙 (명세 §3 동작 시나리오):
 *   1. messageId가 존재하지 않으면 reason='not-found'.
 *   2. message.status가 'error' | 'aborted'가 아니면 reason='not-retryable'.
 *   3. 화자가 participants에 없으면 reason='speaker-missing'.
 *   4. 화자가 human이면 reason='speaker-not-ai' (사용자 발언은 재전송 의미 없음).
 *   5. apiKey가 빈 값이면 reason='no-api-key'.
 *   6. 모두 통과 시 ok:true + speaker + history(현재 messages 그대로 — historyToAnthropicMessages가 error/aborted 제거)
 *      + placeholder(새 streaming 메시지, 새 id, createdAt = now+1ms로 마지막 보장).
 *
 * 새 placeholder는 OCP 원칙(Do 4/27 #7) 준수: 기존 error row를 건드리지 않고 새 row를 추가한다.
 */

import type { Message } from "./conversation-types";
import type { Participant } from "@/modules/participants/participant-types";

export type RetryDeniedReason =
  | "not-found"
  | "not-retryable"
  | "speaker-missing"
  | "speaker-not-ai"
  | "no-api-key";

export type RetryPlan =
  | {
      ok: true;
      speaker: Participant;
      history: Message[];
      placeholder: Message;
    }
  | {
      ok: false;
      reason: RetryDeniedReason;
    };

export interface BuildRetryPlanInput {
  messages: Message[];
  messageId: string;
  participants: Participant[];
  apiKey: string | undefined;
  conversationId: string;
  /** placeholder id 생성기 — 호출자가 store.createMessageId 등을 주입. */
  createMessageId: () => string;
  /** 테스트용 — 운영은 Date.now 사용. createdAt 결정성 위해 주입 가능. */
  now?: () => number;
}

export function buildRetryPlan(input: BuildRetryPlanInput): RetryPlan {
  const target = input.messages.find((m) => m.id === input.messageId);
  if (!target) return { ok: false, reason: "not-found" };
  if (target.status !== "error" && target.status !== "aborted") {
    return { ok: false, reason: "not-retryable" };
  }
  const speaker = input.participants.find((p) => p.id === target.participantId);
  if (!speaker) return { ok: false, reason: "speaker-missing" };
  if (speaker.kind !== "ai") return { ok: false, reason: "speaker-not-ai" };
  const trimmedKey = (input.apiKey ?? "").trim();
  if (trimmedKey.length === 0) return { ok: false, reason: "no-api-key" };

  const nowFn = input.now ?? Date.now;
  // history: 현재 messages 그대로. 새 placeholder는 별도 append.
  // historyToAnthropicMessages가 error/aborted 메시지를 필터링하므로 안전.
  const history = input.messages;
  const placeholder: Message = {
    id: input.createMessageId(),
    conversationId: input.conversationId,
    participantId: speaker.id,
    content: "",
    // createdAt: 마지막 메시지(원본 error)보다 큰 값 보장 — 정렬 안정성.
    createdAt: Math.max(target.createdAt + 1, nowFn()),
    status: "streaming",
  };
  return { ok: true, speaker, history, placeholder };
}
