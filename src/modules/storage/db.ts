"use client";

import Dexie, { type Table } from "dexie";
import type { Participant } from "@/modules/participants/participant-types";

export interface StoredApiKey {
  provider: string;
  key: string;
  savedAt: number;
}

export interface StoredMessageUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  participantId: string;
  content: string;
  createdAt: number;
  status: "streaming" | "done" | "error" | "aborted";
  errorReason?: string;
  usage?: StoredMessageUsage;
}

export interface StoredConversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export class RobustaDB extends Dexie {
  participants!: Table<Participant, string>;
  conversations!: Table<StoredConversation, string>;
  messages!: Table<StoredMessage, string>;
  apiKeys!: Table<StoredApiKey, string>;

  constructor() {
    super("robusta");
    this.version(1).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages: "id, conversationId, createdAt",
      apiKeys: "provider",
    });
    // v2 — D-7: messages 스키마는 동일 인덱스(필드 추가만, 인덱스 변경 없음)지만
    // 안전한 마이그레이션 포인트로 명시. 잔재 streaming 메시지를 aborted 로 리커버.
    this.version(2)
      .stores({
        participants: "id, kind, name",
        conversations: "id, updatedAt",
        messages: "id, conversationId, createdAt, status",
        apiKeys: "provider",
      })
      .upgrade(async (tx) => {
        const messages = tx.table<StoredMessage, string>("messages");
        await messages.toCollection().modify((m) => {
          if (m.status === "streaming") {
            m.status = "aborted";
            m.errorReason = m.errorReason ?? "interrupted by reload";
          }
        });
      });
  }
}

let dbInstance: RobustaDB | null = null;

export function getDb(): RobustaDB {
  if (typeof window === "undefined") {
    throw new Error("RobustaDB is only available in the browser.");
  }
  if (!dbInstance) {
    dbInstance = new RobustaDB();
  }
  return dbInstance;
}
