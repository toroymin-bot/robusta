"use client";

import {
  hueToBubbleBorder,
  parseHueFromColor,
} from "@/modules/participants/participant-color";
import type { Participant } from "@/modules/participants/participant-types";
import type { Message } from "./conversation-types";
import { StreamingCaret } from "./streaming-caret";
// D-10.3 (Day 5, 2026-04-28): error/aborted 메시지에 [↻ 재전송] 버튼 노출.
import { useConversationStore } from "@/stores/conversation-store";
import { t } from "@/modules/i18n/messages";

interface MessageBubbleProps {
  message: Message;
  participant: Participant | undefined;
  isFirstInGroup: boolean;
}

function formatTokens(usage?: Message["usage"]): string | null {
  if (!usage) return null;
  const parts: string[] = [];
  if (typeof usage.inputTokens === "number") parts.push(`in ${usage.inputTokens}`);
  if (typeof usage.outputTokens === "number")
    parts.push(`out ${usage.outputTokens}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function MessageBubble({
  message,
  participant,
  isFirstInGroup,
}: MessageBubbleProps) {
  const isAi = participant?.kind === "ai";
  const hue = participant ? parseHueFromColor(participant.color) : null;
  const borderLeft =
    isFirstInGroup && hue !== null
      ? `3px solid ${hueToBubbleBorder(hue)}`
      : "3px solid transparent";

  const dotBg = hue !== null ? `hsl(${hue} 65% 55%)` : "transparent";

  const baseBg = isAi
    ? "bg-robusta-accentSoft text-robusta-ink dark:bg-[#3A3320]"
    : "bg-transparent text-robusta-ink";

  const isError = message.status === "error";
  const isAborted = message.status === "aborted";
  const isStreaming = message.status === "streaming";
  // D-10.3: 재전송 가능 = AI 발언이면서 error/aborted 상태. (사용자 발언은 buildRetryPlan에서도 차단.)
  const canRetry = isAi && (isError || isAborted);

  const errorRing = isError
    ? "border-l-[3px] border-l-red-500"
    : "";

  const tokens = formatTokens(message.usage);

  // D-10.3: 버튼 클릭 → store.retry. 동시 streaming 가드는 store가 처리.
  function handleRetry() {
    void useConversationStore.getState().retry(message.id);
  }

  return (
    <div className="px-4">
      <div className="mx-auto max-w-3xl">
        {isFirstInGroup && participant && (
          <div className="mt-3 flex items-center gap-2 px-1 text-xs text-robusta-inkDim">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: dotBg }}
            />
            <span className="font-medium text-robusta-ink">
              {participant.name}
            </span>
            {participant.kind === "ai" && participant.model && (
              <span className="text-[10px] uppercase tracking-wider text-robusta-inkDim">
                {participant.model}
              </span>
            )}
          </div>
        )}

        <div
          className={`mt-1 inline-block max-w-[min(680px,100%)] rounded-2xl px-4 py-3 text-sm leading-relaxed ${baseBg} ${errorRing}`}
          style={{ borderLeft }}
          role={isError ? "alert" : undefined}
        >
          {isError ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-red-600">
                ⚠ 오류 — {message.errorReason ?? "알 수 없는 에러"}
              </span>
              {message.content.length > 0 && (
                <span className="whitespace-pre-wrap break-words">
                  {message.content}
                </span>
              )}
            </div>
          ) : isAborted ? (
            <div className="flex flex-col gap-1">
              <span className="whitespace-pre-wrap break-words text-robusta-inkDim">
                {message.content || "(빈 응답)"}
              </span>
              <span className="text-xs text-robusta-inkDim">중단됨</span>
            </div>
          ) : (
            <span className="whitespace-pre-wrap break-words">
              {message.content}
              {isStreaming && <StreamingCaret />}
            </span>
          )}
        </div>

        {tokens && (
          <div className="mt-1 px-1 text-[10px] uppercase tracking-wider text-robusta-inkDim">
            {tokens}
          </div>
        )}

        {canRetry && (
          <div className="mt-1 px-1">
            <button
              type="button"
              onClick={handleRetry}
              className="
                rounded border border-robusta-divider
                px-2 py-0.5 font-mono text-[11px]
                text-robusta-inkDim hover:border-robusta-accent hover:text-robusta-ink
              "
              aria-label={t("action.retry")}
            >
              {t("action.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
