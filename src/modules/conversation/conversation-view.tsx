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
import { streamMessage } from "./conversation-api";
import { pickNextSpeaker } from "./turn-controller";
import { InputBar } from "./input-bar";
import { MessageBubble } from "./message-bubble";
import type { Message } from "./conversation-types";

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
      const ai = participants.find((p) => p.kind === "ai");
      setSpeakerId(ai?.id ?? participants[0]!.id);
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
        return; // 인간 발언 → API 호출 X
      }

      // AI 답변
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

      // history: 마지막 사용자 메시지(userMessage) 까지만 (placeholder 제외)
      const historyForApi = [
        ...(useConversationStore.getState().messages[activeId] ?? []).filter(
          (m) => m.id !== placeholderId,
        ),
      ];

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
          } else if (chunk.kind === "aborted") {
            aborted = true;
            break;
          } else if (chunk.kind === "error") {
            lastError = { reason: chunk.reason, status: chunk.status };
            break;
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
      participants,
      speakerId,
      apiKey,
      activeId,
      conversationTitle,
      appendMessage,
      updateMessage,
      setAbortController,
      pushToast,
      onRequestApiKeyModal,
      createMessageId,
    ],
  );

  function handleSpeakerChange(id: string) {
    try {
      const validated = pickNextSpeaker({
        mode: "manual",
        lastSpeakerId: speakerId,
        participants,
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

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4"
      >
        {!conversationsHydrated ? (
          <div className="px-6 text-sm text-robusta-inkDim">대화를 불러오는 중…</div>
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
      )}
    </section>
  );
}
