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
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CONVERSATION_ID = "default-conversation" as const;
