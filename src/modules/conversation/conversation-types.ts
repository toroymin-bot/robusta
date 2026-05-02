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

/**
 * C-D29-2 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-2 (Spec 003 폴리시 본체 진화).
 *   InsightMark 가 사용자/자동 1메시지 1마크 단위라면, 본 Insight 는 다중 발화자 통찰 단위.
 *   여러 발화자(speakerIds)의 의견 차이·보완·반박을 1건의 통찰로 묶음.
 *   MVP 는 빈 배열 default — Phase 2 (Spec 005+) 에서 LLM 메타 추론 wiring.
 */
export type MultiSpeakerInsightKind =
  | "agreement" // 합의 — 여러 발화자가 같은 결론
  | "disagreement" // 반박 — 의견 충돌
  | "complement" // 보완 — 한 발화자가 다른 발화자의 빈 곳 채움
  | "blindspot"; // 사각지대 — 사용자가 못 본 시야

export interface Insight {
  id: string;
  kind: MultiSpeakerInsightKind;
  /** 본 통찰에 기여한 발화자(페르소나) id 배열. 1명 이상. */
  speakerIds: string[];
  /** 1줄 요약. 100자 초과 시 컴포넌트가 ellipsis. */
  summary: string;
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
  // C-D29-2 (D-5 03시 슬롯, 2026-05-03) — 다중 발화자 통찰 배열 (옵셔널, 비파괴).
  //   MVP 는 빈 배열/undefined 기본 — Phase 2 (Spec 005+) 에서 LLM 자동 추론 wiring.
  //   기존 메시지 0 손실 — 신규 추론 메시지에만 부착.
  insights?: Insight[];
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CONVERSATION_ID = "default-conversation" as const;
