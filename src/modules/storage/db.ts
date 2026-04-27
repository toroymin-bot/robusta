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

/**
 * D-9.1 (Day 4, 2026-04-29): settings 테이블 신규.
 *   key/value 단순 영구 저장소. 호출자가 JSON.stringify/parse 책임.
 *   현재 사용처: 'theme' (D-9.1 마이그레이션) — 향후 'locale' / 'theme.userOverride' 등 확장.
 */
export interface SettingsRecord {
  key: string;
  value: string;
  updatedAt: number;
}

export class RobustaDB extends Dexie {
  participants!: Table<Participant, string>;
  conversations!: Table<StoredConversation, string>;
  messages!: Table<StoredMessage, string>;
  apiKeys!: Table<StoredApiKey, string>;
  // D-9.1 신규 테이블
  settings!: Table<SettingsRecord, string>;

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
    // v3 — D-9.1 (D4): settings 테이블 신규 + theme localStorage 1회 이관.
    //   기존 v2 테이블(participants/conversations/messages/apiKeys)은 Dexie auto-carry — 데이터 보존.
    //   participants 인덱스에 'name' 유지 (재선언 불필요지만 명시 원칙).
    this.version(3).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages: "id, conversationId, createdAt, status",
      apiKeys: "provider",
      settings: "key", // 신규
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

/**
 * D-9.1 (D4): theme localStorage → IndexedDB(settings) 1회 이관.
 *   부트 시 1회 호출 (useThemeStore.hydrate 안에서 실행).
 *   이미 settings.theme 존재 → noop. 없고 localStorage('robusta:theme')에 값이 있으면 이전 후 localStorage 제거.
 *   실패(privacy / IndexedDB 차단) → silent fallback. 호출자는 theme 자체 default('light')로 동작.
 */
export async function migrateThemeFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = getDb();
    const existing = await db.settings.get("theme");
    if (existing) return; // 이미 마이그레이션 완료
    let ls: string | null = null;
    try {
      // 기존 localStorage 키 (D-8.6 P1 명세에서 사용)
      ls = window.localStorage.getItem("robusta:theme");
    } catch {
      // private browsing 등 — silent
      return;
    }
    if (ls !== "light" && ls !== "dark") return; // 이전할 값 없음
    await db.settings.put({
      key: "theme",
      value: ls,
      updatedAt: Date.now(),
    });
    try {
      window.localStorage.removeItem("robusta:theme");
    } catch {
      // 제거 실패 — 다음 부트에 noop (이미 settings에 박힘 → existing path)
    }
  } catch {
    // IndexedDB 차단 — silent
  }
}
