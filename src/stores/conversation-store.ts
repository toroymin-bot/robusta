"use client";

import { create } from "zustand";
// D-D11-2 (Day 11, 2026-04-29, B19) C-D11-2: autoLoopConfig localStorage persist.
//   사용자가 헤더 셀렉터로 변경한 intervalMs/maxAutoTurns가 새로고침 후에도 유지.
//   key = "robusta:auto-loop-config" / partialize로 autoLoopConfig만 persist (다른 state 휘발 보존).
//   SSR 안전 — createJSONStorage(localStorage)는 server에서 fallback (zustand 내장).
import { persist, createJSONStorage } from "zustand/middleware";
import { getDb, cleanStaleStreamingMessages } from "@/modules/storage/db";
import {
  DEFAULT_CONVERSATION_ID,
  type Conversation,
  type Message,
} from "@/modules/conversation/conversation-types";
import type { TurnMode } from "@/modules/conversation/turn-controller";
// D-D11-1 (Day 10, 2026-04-29, B14) C-D11-1: AI-Auto 트리거 풀 라이프사이클.
import {
  startAutoLoop,
  pickNextSpeakerAutoAi,
  type AutoLoopHandle,
  type AutoLoopStatus,
  type AutoLoopConfig,
  type AutoLoopStopReason,
} from "@/modules/conversation/turn-controller";
import { DEFAULT_PARTICIPANTS } from "@/modules/participants/participant-seed";
// D-10.3: 재전송 지원 — 순수 plan 함수 + streamMessage + 의존 stores.
import { buildRetryPlan } from "@/modules/conversation/retry-plan";
import {
  streamMessage,
  parseMessageInsights,
} from "@/modules/conversation/conversation-api";
import { useParticipantStore } from "@/stores/participant-store";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
// D-12.2 (Day 6): 첫 401 발생 시 키 메타에 마킹.
import { markUnauthorized } from "@/modules/api-keys/api-key-meta";
// C-D25-1 (D6 07시 슬롯, 2026-05-02) — B-56 자동 마크 v0. AI 응답 'done' 분기 마다 호출.
//   C-D25-5 168 회복: dynamic import — 어휘 사전이 메인 번들에 영향 0.

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
   * C-D28-5 (D6 23시 슬롯, 2026-05-02) — Tori spec C-D28-5 (B-D28+/F-D28-2).
   *   Welcome 카드 클릭 → pickScenario(scenarioId) 호출. 4 deps wiring 됨:
   *     1) registerPersona — usePersonaStore.upsert (lazy import 로 메인 번들 보호)
   *     2) setSeedPlaceholder — seedPlaceholder 상태 갱신
   *     3) markVisited — visited-store
   *     4) switchToWorkspace — welcomePhase 'workspace' 전환
   *   page.tsx 가 welcomePhase 구독 → "welcome"/"workspace" 분기.
   *   호출 2회는 idempotent (markVisited / personas.upsert 모두 멱등).
   */
  seedPlaceholder: string;
  welcomePhase: "welcome" | "workspace";
  pickScenario: (scenarioId: string) => Promise<void>;
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
  /**
   * D-12.3 (Day 6, 2026-04-28): network/timeout 사유의 error 메시지 일괄 재전송.
   *   - 호출자: online-listener (window 'online' 이벤트 → 토스트 action).
   *   - filter.since 이후 createdAt + filter.reasons 매치 + status='error' 만 대상.
   *   - 최대 5건만 처리 (UX·비용 안전판), 200ms 간격 순차 retry.
   *   - 진행 중 abortController 살아있으면 즉시 skipped 카운트만 증가.
   */
  retryAll: (filter: {
    since: number;
    reasons: ReadonlyArray<"network" | "timeout">;
    maxCount?: number;
    intervalMs?: number;
  }) => Promise<{ retried: number; skipped: number }>;

  // D-D11-1 (Day 10, 2026-04-29, B14) C-D11-1: AI-Auto 트리거 풀 상태/액션.
  //   handle은 setInterval/visibilitychange listener 보유 — terminal 시 caller가 stop으로 정리.
  //   autoLoopStatus는 UI 바인딩(헤더 ▶/⏸/배지). C-D11-2에서 헤더 컴포넌트 박을 때 subscribe.
  //   autoLoopConfig는 메모리 only — localStorage persist는 C-D11-2 헤더 셀렉터에서.
  autoLoopHandle: AutoLoopHandle | null;
  autoLoopStatus: AutoLoopStatus;
  autoTurnsCompleted: number;
  autoLoopConfig: AutoLoopConfig;
  startAutoLoopAction: () => void;
  stopAutoLoopAction: (reason: AutoLoopStopReason) => void;
  resumeAutoLoopAction: () => boolean;
  setAutoLoopConfig: (cfg: Partial<AutoLoopConfig>) => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
  conversations: [],
  messages: {},
  hydrated: false,
  activeConversationId: DEFAULT_CONVERSATION_ID,
  abortController: null,
  // D-8.2: 기본 manual — 안전한 기본값. 사용자가 round-robin 토글 시 변경.
  turnMode: "manual",
  // D-8.2: 초기 false (사용자가 첫 메시지 보내기 전).
  lockedAfterHuman: false,
  // C-D28-5: 시나리오 사전 등록 후 입력 바 placeholder. 빈 값 = 기본 카피.
  seedPlaceholder: "",
  // C-D28-5: 첫 진입 페이즈. visited-store 와 별개 — pickScenario 호출 시 'workspace' 전환.
  welcomePhase: "welcome",

  async loadFromDb() {
    const db = getDb();
    // D-12.1: 부팅 직후 streaming 잔재 정리 (5분 임계). v4 upgrade 후 재로드.
    try {
      await cleanStaleStreamingMessages();
    } catch (err) {
      console.warn("[robusta] cleanStaleStreamingMessages skipped", err);
    }
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
    // D-12.1: status='streaming'인 신규 메시지는 streamingStartedAt 정의.
    //   기존에 streamingStartedAt이 있으면 보존(재시도 placeholder 등이 명시 박은 케이스).
    const enriched: Message =
      msg.status === "streaming" && msg.streamingStartedAt === undefined
        ? { ...msg, streamingStartedAt: Date.now() }
        : msg;
    const messages = { ...get().messages };
    const list = messages[enriched.conversationId] ?? [];
    messages[enriched.conversationId] = [...list, enriched];
    set({ messages });
    if (enriched.status === "streaming") {
      schedulePersist(enriched);
    } else {
      await getDb().messages.put(enriched);
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
  // D-D11-1 보강: ai-auto가 아닌 모드로 전환 시 진행 중 AutoLoop 핸들 정리.
  setTurnMode(mode) {
    if (mode !== "ai-auto" && get().autoLoopHandle) {
      get().stopAutoLoopAction("manual");
    }
    set({ turnMode: mode });
  },

  // D-8.2: lock 상태 직접 변경.
  // - 사용자 발언 후: true (자동 진행 차단)
  // - [▶ 다음 발언] 클릭 또는 AI 발언 완료 후: false
  setLockedAfterHuman(locked) {
    set({ lockedAfterHuman: locked });
  },

  /**
   * C-D28-5: pickScenario — 4 deps 내부 wiring.
   *   1) registerPersona (usePersonaStore.upsert) — 카탈로그 lazy import
   *   2) setSeedPlaceholder — 본 store 상태 갱신
   *   3) markVisited — visited-store
   *   4) switchToWorkspace — welcomePhase = 'workspace'
   *
   *   엣지 케이스:
   *   - scenario_id 미존재 → console.warn + 무동작 (rollback 0).
   *   - persona-store hydrate 미완료 → upsert 자체는 idempotent (Dexie put).
   *   - 호출 2회 → idempotent (markVisited / upsert / phase 전환 모두 멱등).
   *
   *   lazy import: scenario-catalog / persona-catalog / scenario-pick / catalog-i18n / visited-store /
   *               persona-store / persona-from-preset 모두 dynamic import — 메인 번들 영향 0
   *               (catalog 분리 일관성 게이트 통과).
   */
  async pickScenario(scenarioId) {
    try {
      const [
        { SCENARIO_CATALOG_V1 },
        { pickScenario: pickScenarioFn },
        { usePersonaStore },
        { personaFromPreset },
        { markVisited },
      ] = await Promise.all([
        import("@/modules/scenarios/scenario-catalog"),
        import("@/modules/scenarios/scenario-pick"),
        import("@/modules/personas/persona-store"),
        import("@/modules/personas/persona-from-preset"),
        import("@/modules/visit/visited-store"),
      ]);
      const scenario = SCENARIO_CATALOG_V1.find((s) => s.id === scenarioId);
      if (!scenario) {
        console.warn(
          `[robusta] pickScenario: scenarioId='${scenarioId}' 카탈로그 미존재 — 무동작`,
        );
        return;
      }
      const upsert = usePersonaStore.getState().upsert;
      pickScenarioFn(scenario, {
        registerPersona(entry) {
          // PersonaCatalogEntry → Persona 변환 + persona-store.upsert (멱등).
          const persona = personaFromPreset(entry);
          void upsert(persona);
        },
        setSeedPlaceholder: (text) => {
          set({ seedPlaceholder: text });
        },
        markVisited: () => {
          markVisited();
        },
        switchToWorkspace: () => {
          set({ welcomePhase: "workspace" });
        },
      });
    } catch (err) {
      console.warn("[robusta] pickScenario failed", err);
    }
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
        } else if (chunk.kind === "compacted") {
          // C-D23-2 (D6 23시) F-22 가시화 — 컨텍스트 슬라이서가 자동 압축한 경우 1줄 info 토스트.
          //   사용자가 "이전 대화가 사라졌나?" 오해 방지 — 시스템이 잘 처리했음을 명시.
          pushToast({
            tone: "info",
            message: t("toast.context.compacted", {
              original: String(chunk.original),
              shrunk: String(chunk.shrunk),
            }),
          });
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
        // D-12.2: 첫 401 → 키 메타에 lastUnauthorizedAt 정의. BYOK 모달 재진입 시 ⚠ 배지.
        // markUnauthorized는 throw 안 함 (silent fallback 내장).
        void markUnauthorized("anthropic", apiKey!);
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

    // C-D25-1 (D6 07시) — B-56 자동 마크 v0. retry는 동일 speaker(AI)로만 plan 통과.
    //   C-D25-5 168 회복: dynamic import — 메인 번들 영향 0.
    // C-D26-1 (D6 11시 슬롯) — auto-mark v1: vocab dynamic 분리로 maybeAutoMark async 화.
    const { maybeAutoMark: maybeAutoMarkRetry } = await import(
      "@/modules/insights/auto-mark"
    );
    const autoMark = await maybeAutoMarkRetry({
      content: accumulated,
      participantKind: plan.speaker.kind,
      participantId: plan.speaker.id,
      existingMark: undefined,
      locale: "ko",
    });
    // C-D31-2 (D-5 11시 슬롯, 2026-05-03) — F-D31-3: Spec 003 폴리시 wiring.
    //   AI 발언자(retry 는 plan 단계에서 speaker-not-ai 거부 → 여기 도달 시 AI 확정) 한정.
    //   parseMessageInsights 는 throw 없음 (insight-parser.ts 내부 안전망) — 빈/마크업 부재 본문은
    //   원본 그대로 반환하므로 idempotent. cleanText 로 본문 마크업 제거 + insights 부착.
    //   ※ 보존 10 conversation-store.ts 직접 수정 첫 사례 — Spec 003 본체 활성 정당화.
    const parsedRetry = parseMessageInsights(accumulated, plan.speaker.id);
    await state.updateMessage(plan.placeholder.id, {
      status: "done",
      content: parsedRetry.cleanText,
      ...(usagePatch ? { usage: usagePatch } : {}),
      ...(autoMark ? { insight: autoMark } : {}),
      ...(parsedRetry.insights.length > 0
        ? { insights: parsedRetry.insights }
        : {}),
    });
  },

  // D-12.3: 네트워크 회복 자동 재개 — 5분 이내 network/timeout error 메시지 일괄 retry.
  //   호출자: online-listener (window 'online' → 토스트 action).
  //   abortController 진행 중이면 skipped만 누적, 새 retry는 시작하지 않음.
  //   maxCount/intervalMs 미지정 시 권장값 사용 (5건 / 200ms — 명세 §9 자율 영역).
  /**
   * D-D9-4 (Day 9, 2026-04-28) C-D10-4: retryAll JSDoc 보강 (코드 변경 X — 시그니처 안내만).
   *   재시도 — since 시각 이후 reasons 분류 메시지를 maxCount건까지 intervalMs 간격으로 재호출.
   *   AbortError는 즉시 abort yield(재시도 X). 4xx invalid_request_error + /model/i는 폴백 1회.
   *   진행 중 abortController 살아있으면 즉시 skipped 카운트만 증가.
   *
   *   @param filter.since        재시도 후보 시각 (ms epoch).
   *   @param filter.reasons      재시도할 실패 사유 화이트리스트 (substring 매치).
   *   @param filter.maxCount     최대 재시도 건수 (기본 5).
   *   @param filter.intervalMs   재시도 간격 ms (기본 200).
   *   @returns                   { retried: 실제 재시도된 건수, skipped: 건너뛴 건수 }.
   */
  async retryAll(filter) {
    const maxCount = filter.maxCount ?? 5;
    const intervalMs = filter.intervalMs ?? 200;
    const reasonSet = new Set<string>(filter.reasons);
    const state = get();
    const conversationId = state.activeConversationId;
    const messages = state.messages[conversationId] ?? [];

    const candidates = messages.filter(
      (m) =>
        m.status === "error" &&
        m.createdAt >= filter.since &&
        typeof m.errorReason === "string" &&
        // 사유 매칭 — errorReason 내부에 network/timeout 단어 포함 시 매치.
        // (Anthropic SDK/fetch가 정규화된 코드를 주지 않으므로 substring 매치가 현실적.)
        Array.from(reasonSet).some((r) =>
          (m.errorReason ?? "").toLowerCase().includes(r),
        ),
    );

    let retried = 0;
    let skipped = 0;

    for (const m of candidates) {
      if (retried >= maxCount) {
        skipped++;
        continue;
      }
      // 매 retry 사이클마다 진행 중 streaming 가드 재확인.
      if (get().abortController !== null) {
        skipped++;
        continue;
      }
      try {
        await get().retry(m.id);
        retried++;
      } catch {
        skipped++;
      }
      if (retried < maxCount && intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return { retried, skipped };
  },

  // ============================================================================
  // D-D11-1 (Day 10, 2026-04-29, B14) C-D11-1: AI-Auto 트리거 풀 actions.
  // ============================================================================
  autoLoopHandle: null,
  autoLoopStatus: "idle",
  autoTurnsCompleted: 0,
  // 기본 — Do 페이지 \"속도 내자\" 정책 + 안전판: 15초 인터벌 / 10턴 한도.
  // 사용자 셀렉터(C-D11-2)는 5/15/30/60s, 5/10/20/30턴.
  autoLoopConfig: { intervalMs: 15000, maxAutoTurns: 10 },

  startAutoLoopAction() {
    const prev = get().autoLoopHandle;
    if (prev) {
      // 진행 중 핸들이 있으면 먼저 정리. 새 시작은 turnsCompleted 0 리셋.
      prev.stop("manual");
    }
    set({ autoTurnsCompleted: 0 });

    const ctx = {
      pickNextSpeaker: (): string | null => {
        const state = get();
        const list = state.messages[state.activeConversationId] ?? [];
        const lastId = list.length > 0 ? list[list.length - 1]!.participantId : null;
        const participants = useParticipantStore.getState().participants;
        const result = pickNextSpeakerAutoAi(
          participants,
          lastId,
          state.autoLoopConfig.intervalMs,
        );
        return result?.next ?? null;
      },
      streamMessage: (speakerId: string, signal: AbortSignal): Promise<void> =>
        runAutoTurn(speakerId, signal, get, set),
      isStreaming: (): boolean => get().abortController !== null,
      hasByokKey: (): boolean =>
        Boolean(useApiKeyStore.getState().keys.anthropic),
    };

    const handle = startAutoLoop(ctx, {
      ...get().autoLoopConfig,
      onTickEnd: (turnIndex) => {
        set({ autoTurnsCompleted: turnIndex });
      },
      onStatusChange: (status, reason) => {
        set({ autoLoopStatus: status });
        // paused 상태 안내 토스트 — terminal은 onError에서 별도 처리.
        const pushToast = useToastStore.getState().push;
        if (status === "paused-human") {
          pushToast({ tone: "info", message: t("autoLoop.paused.human") });
        } else if (status === "paused-hidden") {
          pushToast({ tone: "info", message: t("autoLoop.paused.hidden") });
        } else if (status === "completed") {
          // ToastTone에 'success' 없음 — 'info' 톤 + ✅ 시각 단서로 완료 신호.
          pushToast({
            tone: "info",
            message: `✅ ${t("autoLoop.completed", { turns: get().autoTurnsCompleted })}`,
          });
        }
        void reason;
      },
      onError: (reason, detail) => {
        const pushToast = useToastStore.getState().push;
        if (reason === "byokMissing") {
          pushToast({ tone: "error", message: t("autoLoop.byokMissing") });
        } else if (reason === "noSpeaker") {
          pushToast({ tone: "warning", message: t("autoLoop.noSpeaker") });
        } else if (reason === "streamError") {
          pushToast({
            tone: "error",
            message: detail ? `AI-Auto 오류: ${detail}` : "AI-Auto 오류",
          });
        }
      },
    });

    set({ autoLoopHandle: handle, autoLoopStatus: handle.status() });
  },

  stopAutoLoopAction(reason) {
    const handle = get().autoLoopHandle;
    if (!handle) return;
    handle.stop(reason);
    // terminal 시 핸들 참조 해제. paused는 resume 가능하도록 보존.
    const next = handle.status();
    if (next !== "paused-human" && next !== "paused-hidden") {
      set({ autoLoopHandle: null, autoLoopStatus: next });
    } else {
      set({ autoLoopStatus: next });
    }
  },

  resumeAutoLoopAction() {
    const handle = get().autoLoopHandle;
    if (!handle) return false;
    const ok = handle.resume();
    set({ autoLoopStatus: handle.status() });
    return ok;
  },

  setAutoLoopConfig(cfg) {
    const merged = { ...get().autoLoopConfig, ...cfg };
    set({ autoLoopConfig: merged });
    // D-D11-2 (Day 11, 2026-04-29) C-D11-2 §11.7 E11 보강:
    //   maxAutoTurns 축소 시 turnsCompleted >= new max면 즉시 stop("completed").
    //   ~~기존: running이면 단순 재시작 (turnsCompleted 0 리셋)~~ — E11 케이스 누락.
    //   본 가드 우선 평가 (running이 아니어도 paused 상태에서 maxTurns 축소 가능).
    if (
      cfg.maxAutoTurns !== undefined &&
      get().autoTurnsCompleted >= merged.maxAutoTurns
    ) {
      const handle = get().autoLoopHandle;
      if (handle) {
        get().stopAutoLoopAction("completed");
      }
      return;
    }
    // E9: 진행 중이면 새 config로 재시작 — turnsCompleted 0 리셋(startAutoLoopAction 의도).
    if (get().autoLoopStatus === "running") {
      get().startAutoLoopAction();
    }
  },
    }),
    {
      // D-D11-2 (Day 11, 2026-04-29) C-D11-2 §11.4: autoLoopConfig localStorage persist.
      //   partialize로 autoLoopConfig만 직렬화 — 메시지/conversations/turnMode 등은 휘발 보존.
      //   SSR: zustand persist는 storage 미존재 시 메모리 fallback (콘솔 경고 1회).
      name: "robusta:auto-loop-config",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ autoLoopConfig: state.autoLoopConfig }),
    },
  ),
);

// D-D11-1 C-D11-1: AutoLoop 한 턴 — 새 placeholder + streamMessage SSE 소비.
//   conversation-view.runAiTurn과 비슷하지만 토스트는 store가 onError로 처리하므로 생략.
//   abort signal은 startAutoLoop이 stop 시 abort()로 끊는다 → AbortError yield → resolve.
async function runAutoTurn(
  speakerId: string,
  signal: AbortSignal,
  get: () => ConversationStore,
  set: (partial: Partial<ConversationStore>) => void,
): Promise<void> {
  const state = get();
  const conversationId = state.activeConversationId;
  const participants = useParticipantStore.getState().participants;
  const speaker = participants.find((p) => p.id === speakerId);
  if (!speaker || speaker.kind !== "ai") {
    throw new Error("runAutoTurn: speaker not found or not ai");
  }
  const apiKey = useApiKeyStore.getState().keys.anthropic;
  if (!apiKey) {
    throw new Error("runAutoTurn: no api key");
  }
  // E2 동시 streaming 방지 — startAutoLoop tick에서 isStreaming 가드. 여기서는 conservative 재확인.
  if (state.abortController !== null) {
    return;
  }

  const placeholderId = state.createMessageId();
  const placeholder: Message = {
    id: placeholderId,
    conversationId,
    participantId: speaker.id,
    content: "",
    createdAt: Date.now() + 1,
    status: "streaming",
  };
  await state.appendMessage(placeholder);

  // AutoLoop의 AbortSignal을 store abortController로 표면화 — sendUserMessage가 보면 abort 가능.
  const controller = new AbortController();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", () => controller.abort(), { once: true });
  set({ abortController: controller });

  const history = (
    useConversationStore.getState().messages[conversationId] ?? []
  ).filter((m) => m.id !== placeholderId);

  let accumulated = "";
  let lastError: { reason: string; status?: number } | null = null;
  let aborted = false;
  let usagePatch: Message["usage"];

  try {
    for await (const chunk of streamMessage({
      apiKey,
      speaker,
      participants,
      history,
      signal: controller.signal,
    })) {
      if (chunk.kind === "delta") {
        accumulated += chunk.text;
        await state.updateMessage(placeholderId, {
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
      } else if (chunk.kind === "done") {
        break;
      }
      // fallback / retrying / compacted chunk는 store가 별도 토스트 X — AutoLoop 모드는 노이즈 최소화.
      //   메인 send 경로(상단 streamMessage)는 사용자 명시 액션이라 토스트 노출,
      //   AutoLoop 은 백그라운드 자동 발화라 토스트 누적 방지.
    }
  } catch (err) {
    lastError = {
      reason: err instanceof Error ? err.message : "stream error",
    };
  } finally {
    set({ abortController: null });
  }

  if (aborted) {
    await state.updateMessage(placeholderId, {
      status: "aborted",
      content: accumulated,
      ...(usagePatch ? { usage: usagePatch } : {}),
    });
    return;
  }

  if (lastError) {
    await state.updateMessage(placeholderId, {
      status: "error",
      content: accumulated,
      errorReason: lastError.reason,
      ...(usagePatch ? { usage: usagePatch } : {}),
    });
    // tick은 reject로 종료 → startAutoLoop이 stop("streamError") + onError 토스트.
    throw new Error(lastError.reason);
  }

  // C-D25-1 (D6 07시) — B-56 자동 마크 v0. AutoLoop 한 턴 종료 시 자동 마크 후보 적용.
  //   speaker는 함수 진입 시 ai로 검증됨. system 가드는 maybeAutoMark 내부.
  //   C-D25-5 168 회복: dynamic import — 메인 번들 영향 0.
  // C-D26-1 (D6 11시 슬롯) — auto-mark v1: async 화 (vocab dynamic).
  const { maybeAutoMark: maybeAutoMarkAuto } = await import(
    "@/modules/insights/auto-mark"
  );
  const autoMark = await maybeAutoMarkAuto({
    content: accumulated,
    participantKind: speaker.kind,
    participantId: speaker.id,
    existingMark: undefined,
    locale: "ko",
  });
  // C-D31-2 (D-5 11시 슬롯, 2026-05-03) — F-D31-3: AutoLoop 한 턴 종료 시점 동일 wiring.
  //   speaker 는 함수 진입 시 AI 검증 (system 가드는 maybeAutoMark 내부 + AutoLoop 자체 정책).
  //   parseMessageInsights 안전망 (throw 0) — content 빈 string / 마크업 없음 모두 idempotent.
  const parsedAuto = parseMessageInsights(accumulated, speaker.id);
  await state.updateMessage(placeholderId, {
    status: "done",
    content: parsedAuto.cleanText,
    ...(usagePatch ? { usage: usagePatch } : {}),
    ...(autoMark ? { insight: autoMark } : {}),
    ...(parsedAuto.insights.length > 0
      ? { insights: parsedAuto.insights }
      : {}),
  });
}

export const __conversation_store_internal = {
  PERSIST_DEBOUNCE_MS,
  flushPersist,
};
