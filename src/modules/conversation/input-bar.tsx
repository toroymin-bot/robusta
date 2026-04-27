"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { parseHueFromColor } from "@/modules/participants/participant-color";
import type { Participant } from "@/modules/participants/participant-types";

interface InputBarProps {
  participants: Participant[];
  speakerId: string;
  onSpeakerChange: (id: string) => void;
  onSend: (text: string) => Promise<void>;
  onAbort: () => void;
  isStreaming: boolean;
  hasApiKey: boolean;
  onRequestApiKeyModal: () => void;
}

export function InputBar({
  participants,
  speakerId,
  onSpeakerChange,
  onSend,
  onAbort,
  isStreaming,
  hasApiKey,
  onRequestApiKeyModal,
}: InputBarProps) {
  const [text, setText] = useState("");
  const composingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentSpeaker = useMemo(
    () => participants.find((p) => p.id === speakerId) ?? participants[0],
    [participants, speakerId],
  );

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const next = Math.min(textareaRef.current.scrollHeight, 200);
    textareaRef.current.style.height = `${next}px`;
  }, [text]);

  const submit = useCallback(async () => {
    const value = text.trim();
    if (value.length === 0) return;
    if (isStreaming) return;
    if (!currentSpeaker) return;
    if (currentSpeaker.kind === "ai" && !hasApiKey) {
      onRequestApiKeyModal();
      return;
    }
    setText("");
    await onSend(value);
  }, [text, isStreaming, currentSpeaker, hasApiKey, onRequestApiKeyModal, onSend]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (!(e.metaKey || e.ctrlKey)) return;
    if (composingRef.current) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  }

  const speakerHue =
    currentSpeaker && parseHueFromColor(currentSpeaker.color);
  const dotColor =
    typeof speakerHue === "number" ? `hsl(${speakerHue} 65% 55%)` : "transparent";

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-robusta-divider bg-robusta-canvas px-4 py-3"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-robusta-inkDim">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <label className="flex items-center gap-2">
            <span>발언자</span>
            <select
              value={speakerId}
              onChange={(e) => onSpeakerChange(e.target.value)}
              disabled={isStreaming}
              className="rounded border border-robusta-divider bg-transparent px-2 py-1 text-xs text-robusta-ink disabled:opacity-60"
              aria-label="발언자 선택"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.kind === "ai" ? "AI" : "인간"})
                </option>
              ))}
            </select>
          </label>
          {currentSpeaker?.kind === "ai" && !hasApiKey && (
            <span className="text-red-600">키 미등록 — 전송 시 자동 모달</span>
          )}
        </div>

        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하고 ⌘/Ctrl + Enter 로 보내기"
            rows={2}
            className="flex-1 resize-none rounded border border-robusta-divider bg-robusta-canvas px-3 py-2 text-sm text-robusta-ink outline-none focus:border-robusta-accent"
            disabled={isStreaming && currentSpeaker?.kind !== "ai"}
            aria-label="메시지 입력"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onAbort}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white"
              aria-label="스트리밍 중단"
            >
              ⏹ 정지
            </button>
          ) : (
            <button
              type="submit"
              disabled={text.trim().length === 0}
              className="rounded bg-robusta-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              보내기
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
