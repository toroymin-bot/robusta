"use client";

import {
  hueToBubbleBorder,
  parseHueFromColor,
} from "@/modules/participants/participant-color";
import type { Participant } from "@/modules/participants/participant-types";
import type { Message } from "./conversation-types";
import { StreamingCaret } from "./streaming-caret";

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

  const errorRing = isError
    ? "border-l-[3px] border-l-red-500"
    : "";

  const tokens = formatTokens(message.usage);

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
      </div>
    </div>
  );
}
