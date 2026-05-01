export type MessageStatus = "streaming" | "done" | "error" | "aborted";

export interface MessageUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * C-D24-3 (D6 03시 슬롯, 2026-05-02) — Spec 003 다중 발화자 메시지 통찰 강조 푸터 (B-51/F-51/D-51).
 *   사용자가 메시지 hover 시 3종 마크 버튼 (다른 시각 / 반대 근거 / 보완) 노출.
 *   1차는 사용자 수동 마크만 — markedBy='user' 고정.
 *   2차(P2)에서 LLM 메타 분석 기반 자동 마크 추가 시 markedBy='auto' 활용.
 */
export type InsightKind = "newView" | "counter" | "augment";

export interface InsightMark {
  kind: InsightKind;
  /** ISO 8601 — 호환성 위해 문자열 (Message.createdAt 은 epoch number 와 별도). */
  markedAt: string;
  markedBy: "user" | "auto";
}

export interface Message {
  id: string;
  conversationId: string;
  participantId: string;
  content: string;
  createdAt: number;
  status: MessageStatus;
  errorReason?: string;
  usage?: MessageUsage;
  // D-12.1 (Day 6, 2026-04-28): status='streaming' 진입 시점.
  //   부팅 잔재 정리(cleanStaleStreamingMessages) 시 5분 임계 평가에 사용.
  streamingStartedAt?: number;
  // C-D24-3 (D6 03시 슬롯, 2026-05-02) — 통찰 마크 (옵셔널, 비파괴).
  //   기존 메시지 0 손실 — 신규 마크된 메시지에만 부착. IndexedDB 영구화는 별도 마이그레이션.
  insight?: InsightMark;
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CONVERSATION_ID = "default-conversation" as const;
