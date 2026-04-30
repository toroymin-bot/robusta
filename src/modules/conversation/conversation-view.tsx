"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConversationStore } from "@/stores/conversation-store";
import { useParticipantStore } from "@/stores/participant-store";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useToastStore } from "@/modules/ui/toast";
// C-D17-17 (Day 5 15시) F-16: BYOK 토큰/비용 누적 store. usage event 도착마다 appendUsage 호출.
import { useUsageStore } from "@/modules/usage/usage-store";
import { streamMessage } from "./conversation-api";
import { pickNextSpeaker, type TurnMode } from "./turn-controller";
import { InputBar } from "./input-bar";
import { MessageBubble } from "./message-bubble";
import type { Message } from "./conversation-types";
import type { Participant } from "@/modules/participants/participant-types";
// D-10.3 (Day 5, 2026-04-28): 토스트 액션 라벨용 i18n.
import { t } from "@/modules/i18n/messages";
// D-D17-2 (Day 5 03시 슬롯, 2026-04-30) C-D17-2: 첫 방문 onboarding CTA — 참여자 0명 + 메시지 0개 빈 화면 대체.
import { EmptyStateCta } from "@/modules/onboarding/empty-state-cta";

const SCROLL_THRESHOLD_PX = 100;

interface ConversationViewProps {
  onRequestApiKeyModal: () => void;
}

export function ConversationView({ onRequestApiKeyModal }: ConversationViewProps) {
  const conversationsHydrated = useConversationStore((s) => s.hydrated);
  const loadConversations = useConversationStore((s) => s.loadFromDb);
  const activeId = useConversationStore((s) => s.activeConversationId);
  const messagesByConv = useConversationStore((s) => s.messages);
  const conversations = useConversationStore((s) => s.conversations);
  const appendMessage = useConversationStore((s) => s.appendMessage);
  const updateMessage = useConversationStore((s) => s.updateMessage);
  const setAbortController = useConversationStore((s) => s.setAbortController);
  const abortStreaming = useConversationStore((s) => s.abortStreaming);
  const createMessageId = useConversationStore((s) => s.createMessageId);
  // D-8.2: turnMode + lock 상태 + 액션
  const turnMode = useConversationStore((s) => s.turnMode);
  const lockedAfterHuman = useConversationStore((s) => s.lockedAfterHuman);
  const setTurnMode = useConversationStore((s) => s.setTurnMode);
  const setLockedAfterHuman = useConversationStore((s) => s.setLockedAfterHuman);
  // D-D11-1 (Day 10, 2026-04-29) C-D11-1: AI-Auto 트리거 풀 액션 — 인간 가로채기 + 모드 전환.
  const startAutoLoopAction = useConversationStore((s) => s.startAutoLoopAction);
  const stopAutoLoopAction = useConversationStore((s) => s.stopAutoLoopAction);
  const autoLoopHandle = useConversationStore((s) => s.autoLoopHandle);

  const participants = useParticipantStore((s) => s.participants);
  const participantsHydrated = useParticipantStore((s) => s.hydrated);

  const apiKey = useApiKeyStore((s) => s.keys.anthropic);

  const pushToast = useToastStore((s) => s.push);

  const [speakerId, setSpeakerId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!conversationsHydrated) {
      void loadConversations().catch((err) =>
        console.error("[robusta] conversation load failed", err),
      );
    }
  }, [conversationsHydrated, loadConversations]);

  useEffect(() => {
    if (!speakerId && participantsHydrated && participants.length > 0) {
      // 첫 발언자 기본값: 인간 우선 (round-robin 시작점)
      const human = participants.find((p) => p.kind === "human");
      setSpeakerId(human?.id ?? participants[0]!.id);
    }
  }, [speakerId, participants, participantsHydrated]);

  useEffect(() => {
    return () => {
      abortStreaming();
    };
  }, [abortStreaming]);

  const messages: Message[] = useMemo(
    () => messagesByConv[activeId] ?? [],
    [messagesByConv, activeId],
  );

  const conversationTitle = useMemo(
    () => conversations.find((c) => c.id === activeId)?.title,
    [conversations, activeId],
  );

  // 현재 conversation의 participantIds (D-8.2 round-robin 순서)
  const participantIds = useMemo(() => {
    const conv = conversations.find((c) => c.id === activeId);
    return conv?.participantIds ?? participants.map((p) => p.id);
  }, [conversations, activeId, participants]);

  // auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (autoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    autoScrollRef.current = distance < SCROLL_THRESHOLD_PX;
  }

  /**
   * AI 발언 1회 실행 — speaker가 AI일 때 호출.
   * D-8.3: fallback 토스트 처리. D-8.2: 완료 후 lock 정책 적용.
   */
  const runAiTurn = useCallback(
    async (speaker: Participant) => {
      if (speaker.kind !== "ai") return;

      if (!apiKey) {
        onRequestApiKeyModal();
        pushToast({
          tone: "error",
          message: "먼저 Anthropic 키를 등록하세요.",
        });
        return;
      }

      const placeholderId = createMessageId();
      const placeholder: Message = {
        id: placeholderId,
        conversationId: activeId,
        participantId: speaker.id,
        content: "",
        createdAt: Date.now() + 1,
        status: "streaming",
      };
      await appendMessage(placeholder);

      const controller = new AbortController();
      setAbortController(controller);
      setIsStreaming(true);

      // history: placeholder 제외한 현재 활성 conversation 메시지
      const historyForApi = (
        useConversationStore.getState().messages[activeId] ?? []
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
          history: historyForApi,
          signal: controller.signal,
          conversationTitle,
        })) {
          if (chunk.kind === "delta") {
            accumulated += chunk.text;
            await updateMessage(placeholderId, {
              content: accumulated,
              status: "streaming",
            });
          } else if (chunk.kind === "usage") {
            usagePatch = chunk.usage;
            // C-D17-17 (Day 5 15시) F-16: 누적 토큰/비용 박제. 모델은 speaker.model 또는 fallback.
            //   chunk.usage는 input/output 둘 중 하나만 박혀 있을 수 있음(message_start vs message_delta) — 0 처리.
            //   usage-store는 in-memory + IndexedDB 양쪽 박힘. 차단 환경에선 silent fallback.
            void useUsageStore.getState().appendUsage({
              model: speaker.model ?? "claude-sonnet-4-6",
              input: chunk.usage.inputTokens ?? 0,
              output: chunk.usage.outputTokens ?? 0,
            });
          } else if (chunk.kind === "aborted") {
            aborted = true;
            break;
          } else if (chunk.kind === "error") {
            lastError = { reason: chunk.reason, status: chunk.status };
            break;
          } else if (chunk.kind === "fallback") {
            // D-8.3: 모델 ID 폴백 발생 → info 토스트만, bubble은 그대로 (명세 §11.3)
            pushToast({
              tone: "info",
              message: `${chunk.from} 미사용 → ${chunk.to} 폴백`,
            });
          } else if (chunk.kind === "retrying") {
            // D-10.3: 5xx 자동 재시도 진행 중 — 별도 토스트는 X (자동이므로 노이즈 방지).
            // bubble은 streaming 상태 유지. 진단 로그만 콘솔에 박음.
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
        setAbortController(null);
        setIsStreaming(false);
      }

      if (aborted) {
        await updateMessage(placeholderId, {
          status: "aborted",
          content: accumulated,
          usage: usagePatch,
        });
        pushToast({ tone: "info", message: "스트리밍을 중단했습니다." });
        return;
      }

      if (lastError) {
        const status = lastError.status;
        if (status === 401) {
          onRequestApiKeyModal();
          pushToast({
            tone: "error",
            message: "Anthropic 키 인증 실패. 키를 다시 등록하세요.",
          });
        } else if (status === 429) {
          pushToast({
            tone: "error",
            message: "Anthropic 한도 초과. 잠시 후 다시 시도하세요.",
          });
        } else if (status && status >= 500) {
          // D-10.3 + D-10.4: 5xx 자동 재시도 한도 초과 → 사용자가 액션 버튼으로 즉시 재전송.
          pushToast({
            tone: "error",
            message: t("toast.error.retryExhausted"),
            action: {
              label: t("action.retry"),
              onClick: () => {
                // store.retry는 placeholder의 새 row를 추가 (원본 error는 보존).
                void useConversationStore.getState().retry(placeholderId);
              },
            },
          });
        } else if (status && status >= 400 && status < 500) {
          pushToast({
            tone: "error",
            message: `요청 실패 (${status}): ${lastError.reason}`,
          });
        } else {
          pushToast({
            tone: "error",
            message: `오류: ${lastError.reason}`,
          });
        }
        await updateMessage(placeholderId, {
          status: "error",
          content: accumulated,
          errorReason: lastError.reason,
          usage: usagePatch,
        });
        return;
      }

      await updateMessage(placeholderId, {
        status: "done",
        content: accumulated,
        usage: usagePatch,
      });
    },
    [
      apiKey,
      activeId,
      conversationTitle,
      participants,
      appendMessage,
      updateMessage,
      setAbortController,
      pushToast,
      onRequestApiKeyModal,
      createMessageId,
    ],
  );

  /**
   * 사용자가 입력바에서 메시지 전송 시 호출.
   * D-8.2: 인간 발언 시 lock=true (round-robin 자동 진행 차단).
   *        AI 발언 시 그대로 1회 turn 실행.
   */
  const onSend = useCallback(
    async (text: string) => {
      const speaker = participants.find((p) => p.id === speakerId);
      if (!speaker) {
        pushToast({ tone: "error", message: "발언자가 선택되지 않았습니다." });
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        conversationId: activeId,
        participantId: speaker.id,
        content: text,
        createdAt: Date.now(),
        status: "done",
      };
      await appendMessage(userMessage);

      if (speaker.kind !== "ai") {
        // D-8.2: 인간 발언 → round-robin 자동 진행 차단 (사용자 [▶ 다음 발언] 클릭 필요)
        setLockedAfterHuman(true);
        // D-D11-1 §4.5 E1: AI-Auto 진행 중이면 인간 가로채기 → paused-human + info 토스트.
        if (autoLoopHandle) {
          stopAutoLoopAction("human");
        }
        return;
      }

      // AI 발언 — 그대로 turn 실행
      await runAiTurn(speaker);
    },
    [
      participants,
      speakerId,
      activeId,
      appendMessage,
      pushToast,
      createMessageId,
      runAiTurn,
      setLockedAfterHuman,
      autoLoopHandle,
      stopAutoLoopAction,
    ],
  );

  /**
   * D-8.2 [▶ 다음 발언] 버튼 핸들러.
   * round-robin 다음 발언자 선택 → AI면 1회 turn 실행 → lock=true 유지 (안전 기본값).
   */
  const onNextTurn = useCallback(async () => {
    if (isStreaming) return;
    // 마지막 발언자 id (chronological 마지막 메시지 또는 currently selected speaker)
    const lastMsg = messages[messages.length - 1];
    const lastSpeakerId = lastMsg?.participantId ?? null;

    let nextId: string;
    try {
      nextId = pickNextSpeaker({
        mode: "round-robin",
        lastSpeakerId,
        participants,
        participantIds,
      });
    } catch (err) {
      pushToast({
        tone: "error",
        message: err instanceof Error ? err.message : "다음 발언자 선택 실패",
      });
      return;
    }

    const next = participants.find((p) => p.id === nextId);
    if (!next) {
      pushToast({ tone: "error", message: "다음 발언자를 찾을 수 없습니다." });
      return;
    }

    // UI select도 동기화 (사용자가 다음 발언자를 인식할 수 있도록)
    setSpeakerId(next.id);

    if (next.kind !== "ai") {
      // round-robin 순환에 인간이 다음이면 → 다시 lock 유지하고 사용자에게 입력 요청
      pushToast({
        tone: "info",
        message: `${next.name}의 차례입니다. 메시지를 입력하세요.`,
      });
      // lock 유지 — 사용자가 직접 입력해야
      return;
    }

    // AI 차례 — 1회 turn 실행 + 끝나면 lock 유지 (안전 기본값, 명세 §3)
    await runAiTurn(next);
    // AI 발언 완료 후에도 lockedAfterHuman 그대로 유지 (자동 chain 방지)
    setLockedAfterHuman(true);
  }, [
    isStreaming,
    messages,
    participants,
    participantIds,
    pushToast,
    runAiTurn,
    setLockedAfterHuman,
  ]);

  function handleSpeakerChange(id: string) {
    try {
      // manual 모드 검증 — manualPick으로 우선 적용
      const validated = pickNextSpeaker({
        mode: "manual",
        lastSpeakerId: speakerId,
        participants,
        participantIds,
        manualPick: id,
      });
      setSpeakerId(validated);
    } catch (err) {
      pushToast({
        tone: "error",
        message: err instanceof Error ? err.message : "발언자 변경 실패",
      });
    }
  }

  function handleTurnModeChange(mode: TurnMode) {
    if (mode === "trigger") {
      // D4 P1 — Roy_Request 별도 큐
      pushToast({
        tone: "info",
        message: "trigger(스케줄) 모드는 D4에서 제공됩니다.",
      });
      return;
    }
    // D-D10-5 (Day 9, 2026-04-28) C-D10-5: ai-auto 골격 — enum/순수 함수.
    // D-D11-1 (Day 10, 2026-04-29) C-D11-1: 트리거 풀 본체 박음 → ai-auto 전환 시 자동 시작.
    //   ~~"AI-Auto 모드는 골격만 박혀 있습니다 — 자율 발화 트리거는 곧 제공됩니다."~~ (D-D10-5 안내 제거)
    //   AI < 2명 가드: pickNextSpeakerAutoAi가 null 반환 → 시작 직후 noSpeaker 토스트로 폴백되지만,
    //   사용자 혼란 방지 위해 진입 시점에서 한 번 차단.
    // D-D11-2b (Day 11, 2026-04-29, B19) C-D11-2b: BYOK 사전 체크 추가.
    //   기존엔 키 없이도 모드 전환 → startAutoLoop이 즉시 byokMissing 토스트로 멈춤(혼란).
    //   본 가드: 모드 전환 자체를 차단 + autoLoop.byokMissing i18n 토스트 1회.
    if (mode === "ai-auto") {
      if (!apiKey) {
        pushToast({
          tone: "warning",
          message: t("autoLoop.byokMissing"),
        });
        onRequestApiKeyModal();
        return;
      }
      const aiCount = participants.filter((p) => p.kind === "ai").length;
      if (aiCount < 2) {
        pushToast({
          tone: "warning",
          message: t("autoLoop.noSpeaker"),
        });
        return;
      }
      setTurnMode(mode);
      // turnMode 갱신 후 자동 시작. setTurnMode 안의 stopAutoLoopAction("manual")은
      // mode !== ai-auto 분기에서만 동작하므로 이중 호출 X.
      startAutoLoopAction();
      return;
    }
    setTurnMode(mode);
    // 모드 전환 시 lock 초기화 (manual에서는 lock 무관)
    if (mode === "manual") {
      setLockedAfterHuman(false);
    }
  }

  // group consecutive messages by participant for "isFirstInGroup"
  const grouped = useMemo(() => {
    const result: { msg: Message; isFirstInGroup: boolean }[] = [];
    let lastPid: string | null = null;
    for (const m of messages) {
      const isFirst = m.participantId !== lastPid;
      result.push({ msg: m, isFirstInGroup: isFirst });
      lastPid = m.participantId;
    }
    return result;
  }, [messages]);

  // [▶ 다음 발언] 버튼 노출/활성 조건 (명세 §3)
  // - round-robin 모드일 때만 노출
  // - 비활성: lockedAfterHuman === false || isStreaming
  const showNextTurnButton = turnMode === "round-robin";
  const nextTurnDisabled = !lockedAfterHuman || isStreaming;

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4"
      >
        {!conversationsHydrated || !participantsHydrated ? (
          <div className="px-6 text-sm text-robusta-inkDim">대화를 불러오는 중…</div>
        ) : participants.length === 0 && grouped.length === 0 ? (
          // D-D17-2 (Day 5 03시) C-D17-2: 첫 방문(참여자 0 + 메시지 0) — 노란 "샘플 보기" CTA로 대체.
          //   기존 ~~"대화를 시작하세요…" 안내~~ 는 참여자가 1명 이상일 때만 노출 (아래 분기).
          //   Roy Do v24 id-15 "초등학생 직관" 정합.
          <EmptyStateCta variant="sample" />
        ) : grouped.length === 0 ? (
          <div className="mx-auto max-w-md px-6 py-12 text-center text-sm text-robusta-inkDim">
            대화를 시작하세요. 좌측에서 참여자를 확인하고, 하단에서 발언자를 골라
            메시지를 보내세요.
            {!apiKey && (
              <span className="mt-2 block text-xs">
                AI 발언을 보내려면 먼저{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={onRequestApiKeyModal}
                >
                  Anthropic 키
                </button>
                를 등록하세요.
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {grouped.map(({ msg, isFirstInGroup }) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                participant={participants.find((p) => p.id === msg.participantId)}
                isFirstInGroup={isFirstInGroup}
              />
            ))}
          </div>
        )}
      </div>

      {participantsHydrated && participants.length > 0 && speakerId && (
        <div className="border-t border-robusta-divider bg-robusta-canvas">
          {/* D-8.2: 발언 모드 선택 + [▶ 다음 발언] 버튼 (round-robin 시) */}
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-2 text-xs text-robusta-inkDim">
            <label className="flex items-center gap-2">
              <span>발언 모드</span>
              <select
                value={turnMode}
                onChange={(e) => handleTurnModeChange(e.target.value as TurnMode)}
                disabled={isStreaming}
                className="rounded border border-robusta-divider bg-transparent px-2 py-1 text-xs text-robusta-ink disabled:opacity-60"
                aria-label="발언 모드 선택"
              >
                <option value="manual">수동</option>
                <option value="round-robin">순환 (round-robin)</option>
                {/* D-D10-5 (Day 9, 2026-04-28, B12) C-D10-5: AI-Auto 골격 노출(4번째 옵션).
                    실제 setInterval 트리거는 C-D11-1로 분리 — 본 슬롯은 enum/순수 함수만. */}
                <option value="ai-auto">AI-Auto (자율)</option>
              </select>
            </label>
            {showNextTurnButton && (
              <button
                type="button"
                onClick={() => void onNextTurn()}
                disabled={nextTurnDisabled}
                className="rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-ink hover:border-robusta-accent disabled:opacity-50"
                aria-label="다음 발언자에게 차례 넘기기"
              >
                ▶ 다음 발언
              </button>
            )}
          </div>
          <InputBar
            participants={participants}
            speakerId={speakerId}
            onSpeakerChange={handleSpeakerChange}
            onSend={onSend}
            onAbort={abortStreaming}
            isStreaming={isStreaming}
            hasApiKey={Boolean(apiKey)}
            onRequestApiKeyModal={onRequestApiKeyModal}
          />
        </div>
      )}
    </section>
  );
}
