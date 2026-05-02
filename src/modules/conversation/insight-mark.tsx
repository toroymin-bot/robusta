/**
 * insight-mark.tsx
 *   - C-D24-3 (D6 03시 슬롯, 2026-05-02) — Spec 003 다중 발화자 메시지 통찰 강조 푸터.
 *     · B-51 (Spec 003) + F-51 (수동 마크) + D-51 (디자인 토큰).
 *     · Robusta 컨셉 본체 — Do §1.1 "AI들과의 회의실 → 통찰".
 *
 * 동작:
 *   - 메시지 hover 시 마크 버튼 (3종) 노출. 데스크탑은 hover, 모바일은 long-press 480ms.
 *   - 마크되면 푸터 1줄 (글리프 + 라벨) + 우측 캡처 버튼 (B-46 / B-52 사이드 시트 진입).
 *   - 시스템 메시지 (participantId === 'system' 또는 'system-source-context-slicer') 푸터 미마운트.
 *
 * dynamic import:
 *   - 호출자 (message-bubble) 가 next/dynamic 으로 lazy 로드.
 *   - 메인 번들 +0 의무 (168 kB 게이트 유지).
 *
 * OCP:
 *   - 신규 파일. 기존 message-bubble 의 마크업 비파괴 — wrapper 하단에 footer 슬롯 1줄 추가.
 */

"use client";

import { useState } from "react";
import type {
  InsightKind,
  InsightMark,
  Message,
} from "./conversation-types";
import { t } from "@/modules/i18n/messages";
import { useConversationStore } from "@/stores/conversation-store";
import { useInsightStore } from "@/modules/insights/insight-store";
import { useToastStore } from "@/modules/ui/toast";
// C-D27-2 (D6 15시 슬롯, 2026-05-02) — auto-mark sample 누적: TP/FP/FN 3 케이스 분기.
//   100건 도달 후 dev-mode-strip 정밀도/재현율 표시 활성. 메인 번들 영향 0.
import { useAutoMarkSampleStore } from "@/stores/auto-mark-sample-store";

/** 3종 글리프 매핑 — 잡스 단순. 추가 종류는 P2(예: ❓ 의문 제기) 분리. */
export const KIND_GLYPH: Record<InsightKind, string> = {
  newView: "💡", // 다른 시각
  counter: "⚖", // 반대 근거
  augment: "➕", // 보완
};

const KIND_LABEL_KEY: Record<
  InsightKind,
  "insight.kind.newView" | "insight.kind.counter" | "insight.kind.augment"
> = {
  newView: "insight.kind.newView",
  counter: "insight.kind.counter",
  augment: "insight.kind.augment",
};

/** 시스템 메시지 가드 — 사용자 통찰 마크 대상이 아님. */
function isSystemMessage(participantId: string): boolean {
  return (
    participantId === "system" ||
    participantId === "system-source-context-slicer"
  );
}

export interface InsightFooterProps {
  message: Message;
  /** 캡처 시 호출 — 부모(인사이트 라이브러리 진입점)가 사이드 시트 open. */
  onCapture?: (mark: InsightMark) => void;
  /** 모바일 long-press 480ms 시 강제 활성 (테스트 환경에서 hover 대신). */
  forceShowButtons?: boolean;
}

/**
 * 통찰 강조 푸터 — 메시지 wrapper 하단에 마운트.
 *   미마크 + (hover || forceShowButtons) → 3종 마크 버튼.
 *   마크됨 → 푸터 1줄 (글리프 + 라벨) + 캡처 + ↺ 해제.
 *   시스템 메시지 → null (마운트 X).
 */
export function InsightFooter({
  message,
  onCapture,
  forceShowButtons,
}: InsightFooterProps) {
  // hooks 는 early return 전에 모두 호출 (react-hooks/rules-of-hooks).
  const [hover, setHover] = useState(false);
  const updateMessage = useConversationStore((s) => s.updateMessage);
  const captureInsight = useInsightStore((s) => s.capture);
  const pushToast = useToastStore((s) => s.push);

  // 시스템 메시지 가드 (C-D23-2 context-slicer 등) — hooks 이후 분기.
  if (isSystemMessage(message.participantId)) return null;

  const showButtons = !message.insight && (hover || forceShowButtons);

  function handleMark(kind: InsightKind) {
    const mark: InsightMark = {
      kind,
      markedAt: new Date().toISOString(),
      markedBy: "user",
    };
    // C-D27-2: 자동 마크 → 사용자 확정 (TP) 또는 자동 마크 미존재 → 사용자 신규 (FN/FP).
    //   inferred = 기존 message.insight 의 kind (auto 였으면 추론값) / 없었으면 null.
    //   actual = 사용자가 선택한 kind. classifySample 4 분기는 sample-store 적재 후 measure 함수가 산출.
    const previousAuto =
      message.insight && message.insight.markedBy === "auto"
        ? message.insight.kind
        : null;
    useAutoMarkSampleStore.getState().add({
      inferred: previousAuto,
      actual: kind,
      text: message.content,
    });
    void updateMessage(message.id, { insight: mark });
  }

  function handleUnmark() {
    // C-D27-2: auto 마크 사용자 거부 = FP. 'user' 마크 해제는 sample 미적재 (이미 add 시 적재됨).
    if (message.insight && message.insight.markedBy === "auto") {
      useAutoMarkSampleStore.getState().add({
        inferred: message.insight.kind,
        actual: null,
        text: message.content,
      });
    }
    // 옵셔널 필드 해제 — patch 에 insight: undefined 로 명시.
    void updateMessage(message.id, { insight: undefined });
    pushToast({
      tone: "info",
      message: t("insight.unmark.toast"),
    });
  }

  function handleCapture() {
    if (!message.insight) return;
    captureInsight({
      roomId: message.conversationId,
      sourceMessageId: message.id,
      text: message.content,
      personaId: message.participantId,
      insightKind: message.insight.kind,
    });
    if (onCapture) onCapture(message.insight);
  }

  return (
    <div
      className="mx-auto mt-1 max-w-3xl px-4"
      data-test={`insight-footer-${message.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {showButtons && (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-robusta-inkDim">
          {(["newView", "counter", "augment"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleMark(k)}
              title={t("insight.markButton.tooltip")}
              data-test={`insight-mark-button-${k}`}
              className="
                rounded border border-robusta-divider px-1.5 py-0.5
                hover:border-robusta-accent hover:text-robusta-ink
                focus:outline-none focus:border-robusta-accent
              "
            >
              <span aria-hidden>{KIND_GLYPH[k]}</span>
              <span className="ml-1">{t(KIND_LABEL_KEY[k])}</span>
            </button>
          ))}
        </div>
      )}
      {message.insight && (
        <div
          className={`
            mt-1 flex items-center gap-2
            border-t pt-1
            ${message.insight.markedBy === "auto" ? "border-dashed" : "border-solid"}
            border-robusta-divider
            text-[11px] italic text-robusta-inkDim
          `}
          data-test={`insight-footer-marked-${message.insight.kind}`}
          data-marked-by={message.insight.markedBy}
        >
          <span aria-hidden>{KIND_GLYPH[message.insight.kind]}</span>
          <span>{t(KIND_LABEL_KEY[message.insight.kind])}</span>
          {message.insight.markedBy === "auto" && (
            <span
              className="rounded bg-robusta-accentSoft/40 px-1 text-[10px] font-normal not-italic text-robusta-inkDim"
              data-test="insight-auto-label"
              title={t("insight.auto.label")}
            >
              {t("insight.auto.label")}
            </span>
          )}
          <button
            type="button"
            onClick={handleCapture}
            className="ml-auto rounded px-1.5 py-0.5 hover:text-robusta-ink hover:bg-robusta-accentSoft/30"
            data-test="insight-capture-button"
            aria-label="캡처"
          >
            💡 캡처
          </button>
          <button
            type="button"
            onClick={handleUnmark}
            className="rounded px-1 py-0.5 hover:text-robusta-ink"
            data-test="insight-unmark-button"
            aria-label={t("insight.unmark.action")}
            title={t("insight.unmark.action")}
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
}

export default InsightFooter;
