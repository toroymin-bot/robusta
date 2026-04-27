"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";
import {
  DEFAULT_CONVERSATION_ID,
  type Conversation,
  type Message,
} from "@/modules/conversation/conversation-types";
import type { TurnMode } from "@/modules/conversation/turn-controller";
import { DEFAULT_PARTICIPANTS } from "@/modules/participants/participant-seed";

const PERSIST_DEBOUNCE_MS = 200;

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

interface PersistEntry {
  msg: Message;
  timer: ReturnType<typeof setTimeout> | null;
}

const persistTimers = new Map<string, PersistEntry>();

function schedulePersist(msg: Message): void {
  const existing = persistTimers.get(msg.id);
  if (existing?.timer) clearTimeout(existing.timer);
  const entry: PersistEntry = {
    msg,
    timer: setTimeout(() => {
      void getDb()
        .messages.put(entry.msg)
        .catch((err) =>
          console.error("[robusta] message persist failed", msg.id, err),
        );
      persistTimers.delete(msg.id);
    }, PERSIST_DEBOUNCE_MS),
  };
  persistTimers.set(msg.id, entry);
}

async function flushPersist(messageId: string): Promise<void> {
  const entry = persistTimers.get(messageId);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  persistTimers.delete(messageId);
  await getDb().messages.put(entry.msg);
}

interface ConversationStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> 시간순
  hydrated: boolean;
  activeConversationId: string;
  abortController: AbortController | null;
  /**
   * D-8.2 발언 모드 — default 'manual'. round-robin 시 자동 진행 가능.
   * 메모리만 (새로고침 시 'manual'로 초기화 — 명세 §11.2 의도된 동작).
   */
  turnMode: TurnMode;
  /**
   * D-8.2 lock-after-human — 사용자(human) 발언 직후 true.
   * round-robin 모드에서도 true 동안 자동 진행 X — 사용자가 [▶ 다음 발언] 클릭 필요.
   * AI 발언 완료 시 자동 false (다음 AI 자동 진행 가능).
   */
  lockedAfterHuman: boolean;

  loadFromDb: () => Promise<void>;
  appendMessage: (msg: Message) => Promise<void>;
  updateMessage: (id: string, patch: Partial<Message>) => Promise<void>;
  setActiveConversation: (id: string) => void;
  setAbortController: (controller: AbortController | null) => void;
  abortStreaming: () => void;
  createMessageId: () => string;
  setTurnMode: (mode: TurnMode) => void;
  setLockedAfterHuman: (locked: boolean) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  messages: {},
  hydrated: false,
  activeConversationId: DEFAULT_CONVERSATION_ID,
  abortController: null,
  // D-8.2: 기본 manual — 안전한 기본값. 사용자가 round-robin 토글 시 변경.
  turnMode: "manual",
  // D-8.2: 초기 false (사용자가 첫 메시지 보내기 전).
  lockedAfterHuman: false,

  async loadFromDb() {
    const db = getDb();
    const count = await db.conversations.count();
    if (count === 0) {
      const now = Date.now();
      const seed: Conversation = {
        id: DEFAULT_CONVERSATION_ID,
        title: "첫 대화",
        participantIds: DEFAULT_PARTICIPANTS.map((p) => p.id),
        createdAt: now,
        updatedAt: now,
      };
      await db.conversations.put(seed);
      set({
        conversations: [seed],
        messages: { [seed.id]: [] },
        hydrated: true,
        activeConversationId: seed.id,
      });
      return;
    }

    const conversations = await db.conversations.toArray();
    const allMessages = await db.messages.toArray();
    const grouped: Record<string, Message[]> = {};
    for (const m of allMessages) {
      const list = grouped[m.conversationId] ?? [];
      list.push(m);
      grouped[m.conversationId] = list;
    }
    for (const cid of Object.keys(grouped)) {
      grouped[cid]!.sort((a, b) => a.createdAt - b.createdAt);
    }

    const active =
      conversations.find((c) => c.id === DEFAULT_CONVERSATION_ID)?.id ??
      conversations[0]?.id ??
      DEFAULT_CONVERSATION_ID;

    set({
      conversations,
      messages: grouped,
      hydrated: true,
      activeConversationId: active,
    });
  },

  async appendMessage(msg) {
    const messages = { ...get().messages };
    const list = messages[msg.conversationId] ?? [];
    messages[msg.conversationId] = [...list, msg];
    set({ messages });
    if (msg.status === "streaming") {
      schedulePersist(msg);
    } else {
      await getDb().messages.put(msg);
    }
  },

  async updateMessage(id, patch) {
    const messages = { ...get().messages };
    let updated: Message | null = null;
    for (const cid of Object.keys(messages)) {
      const list = messages[cid]!;
      const idx = list.findIndex((m) => m.id === id);
      if (idx === -1) continue;
      const next: Message = { ...list[idx]!, ...patch, id };
      const newList = [...list];
      newList[idx] = next;
      messages[cid] = newList;
      updated = next;
      break;
    }
    if (!updated) return;
    set({ messages });
    if (updated.status === "streaming") {
      schedulePersist(updated);
    } else {
      await flushPersist(id);
      await getDb().messages.put(updated);
    }
  },

  setActiveConversation(id) {
    set({ activeConversationId: id });
  },

  setAbortController(controller) {
    set({ abortController: controller });
  },

  abortStreaming() {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
      set({ abortController: null });
    }
  },

  createMessageId() {
    return newId("m");
  },

  // D-8.2: 발언 모드 변경 (manual / round-robin / trigger).
  setTurnMode(mode) {
    set({ turnMode: mode });
  },

  // D-8.2: lock 상태 직접 변경.
  // - 사용자 발언 후: true (자동 진행 차단)
  // - [▶ 다음 발언] 클릭 또는 AI 발언 완료 후: false
  setLockedAfterHuman(locked) {
    set({ lockedAfterHuman: locked });
  },
}));

export const __conversation_store_internal = {
  PERSIST_DEBOUNCE_MS,
  flushPersist,
};
