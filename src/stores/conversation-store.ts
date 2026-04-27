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
// D-10.3: 재전송 지원 — 순수 plan 함수 + streamMessage + 의존 stores.
import { buildRetryPlan } from "@/modules/conversation/retry-plan";
import { streamMessage } from "@/modules/conversation/conversation-api";
import { useParticipantStore } from "@/stores/participant-store";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";

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
  /**
   * D-10.3: 메시지 재전송. error/aborted 메시지의 [↻ 재전송] 버튼 또는 토스트 액션이 호출.
   *   - 새 placeholder를 append (원본 error/aborted 메시지는 OCP 원칙으로 보존).
   *   - 동일 speaker로 streamMessage 재실행.
   *   - 5xx 백오프(streamMessage 내부) → retrying chunk yield.
   *   - 키/참여자/유효성 실패 시 토스트만 표시, throw 안 함.
   */
  retry: (messageId: string) => Promise<void>;
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

  // D-10.3: 메시지 재전송 — buildRetryPlan으로 결정 + streamMessage 재실행.
  // 동시 streaming 진행 중에는 호출자가 abort 후 재시도하도록 가드(현재 controller 살아있으면 거부).
  async retry(messageId) {
    const state = get();
    const conversationId = state.activeConversationId;
    const messages = state.messages[conversationId] ?? [];
    const participants = useParticipantStore.getState().participants;
    const apiKey = useApiKeyStore.getState().keys.anthropic;
    const pushToast = useToastStore.getState().push;

    const plan = buildRetryPlan({
      messages,
      messageId,
      participants,
      apiKey,
      conversationId,
      createMessageId: state.createMessageId,
    });

    if (!plan.ok) {
      // 거부 사유별 사용자 메시지 — 운영 가시화 + 디버깅 단서.
      const messageMap: Record<typeof plan.reason, string> = {
        "not-found": "재전송할 메시지를 찾을 수 없습니다.",
        "not-retryable": "이 메시지는 재전송할 수 없습니다.",
        "speaker-missing": "발언자 정보가 사라졌습니다.",
        "speaker-not-ai": "사용자 메시지는 재전송할 수 없습니다.",
        "no-api-key": "먼저 Anthropic 키를 등록하세요.",
      };
      pushToast({ tone: "error", message: messageMap[plan.reason] });
      return;
    }

    // 동시 streaming 가드 — 이미 진행 중이면 거부 (사용자가 ⏹ 정지 후 재시도 권장).
    if (state.abortController !== null) {
      pushToast({ tone: "warning", message: "이미 메시지 전송 중입니다." });
      return;
    }

    await state.appendMessage(plan.placeholder);

    const controller = new AbortController();
    set({ abortController: controller });

    let accumulated = "";
    let lastError: { reason: string; status?: number } | null = null;
    let aborted = false;
    let usagePatch: Message["usage"];

    try {
      for await (const chunk of streamMessage({
        apiKey: apiKey!,
        speaker: plan.speaker,
        participants,
        history: plan.history,
        signal: controller.signal,
      })) {
        if (chunk.kind === "delta") {
          accumulated += chunk.text;
          await state.updateMessage(plan.placeholder.id, {
            content: accumulated,
            status: "streaming",
          });
        } else if (chunk.kind === "usage") {
          usagePatch = chunk.usage;
        } else if (chunk.kind === "aborted") {
          aborted = true;
          break;
        } else if (chunk.kind === "error") {
          lastError = { reason: chunk.reason, status: chunk.status };
          break;
        } else if (chunk.kind === "fallback") {
          pushToast({
            tone: "info",
            message: t("toast.fallback", { from: chunk.from, to: chunk.to }),
          });
        } else if (chunk.kind === "retrying") {
          // D-10.3: 5xx 자동 재시도 진행 중 — UI는 placeholder content가 비어있는 streaming 상태 유지.
          // 사용자에게는 별도 토스트 X (자동 재시도라 노이즈 방지). console에만 진단 로그.
          // eslint-disable-next-line no-console
          console.info(
            `[robusta] 5xx 자동 재시도 ${chunk.attempt}/3 (status=${chunk.status})`,
          );
        } else if (chunk.kind === "done") {
          break;
        }
      }
    } catch (err) {
      lastError = {
        reason: err instanceof Error ? err.message : "stream error",
      };
    } finally {
      set({ abortController: null });
    }

    if (aborted) {
      await state.updateMessage(plan.placeholder.id, {
        status: "aborted",
        content: accumulated,
        ...(usagePatch ? { usage: usagePatch } : {}),
      });
      return;
    }

    if (lastError) {
      const status = lastError.status;
      // D-10.3 + D-10.4: 5xx 한도 초과 시 토스트에 [↻ 재전송] 액션 부착 — 새 placeholder를 다시 retry.
      if (status && status >= 500) {
        pushToast({
          tone: "error",
          message: t("toast.error.retryExhausted"),
          action: {
            label: t("action.retry"),
            onClick: () => {
              void get().retry(plan.placeholder.id);
            },
          },
        });
      } else if (status === 401) {
        pushToast({
          tone: "error",
          message: "Anthropic 키 인증 실패. 키를 다시 등록하세요.",
        });
      } else if (status === 429) {
        pushToast({
          tone: "error",
          message: "Anthropic 한도 초과. 잠시 후 다시 시도하세요.",
        });
      } else {
        pushToast({
          tone: "error",
          message: status
            ? `요청 실패 (${status}): ${lastError.reason}`
            : `오류: ${lastError.reason}`,
        });
      }
      await state.updateMessage(plan.placeholder.id, {
        status: "error",
        content: accumulated,
        errorReason: lastError.reason,
        ...(usagePatch ? { usage: usagePatch } : {}),
      });
      return;
    }

    await state.updateMessage(plan.placeholder.id, {
      status: "done",
      content: accumulated,
      ...(usagePatch ? { usage: usagePatch } : {}),
    });
  },
}));

export const __conversation_store_internal = {
  PERSIST_DEBOUNCE_MS,
  flushPersist,
};
