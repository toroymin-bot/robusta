export type MessageStatus = "streaming" | "done" | "error" | "aborted";

export interface MessageUsage {
  inputTokens?: number;
  outputTokens?: number;
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
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CONVERSATION_ID = "default-conversation" as const;
