/**
 * auto-mark.ts
 *   - C-D25-1 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-1, B-56/F-56/D-56.
 *
 * Spec 003 통찰 강조 푸터의 자동 마크 활성화.
 *   AI 응답 메시지 완료 시 텍스트에서 시그널 어휘를 추출 → markedBy='auto' 으로 자동 마크.
 *   사용자 수동 마크(C-D24-3)와 공존 — 이미 mark가 있으면 자동 분기 skip.
 *
 * 어휘 사전 v0 — 정밀도 1차 추정 60~70%. 다음 슬롯에서 false positive/negative 측정 후 보강.
 *
 * 우선순위 (의미 강도 순):
 *   newView (다른 시각) > counter (반대 근거) > augment (보완)
 *
 * 가드:
 *   - participantKind !== 'ai' → null (사용자 메시지 자동 마크 X)
 *   - participantId가 system / context-slicer → null (시스템 메시지 자동 마크 X)
 *   - 빈 content → null (스트리밍 시작 직전 placeholder 가드)
 *   - 이미 사용자 마크가 있으면 → null (사용자 의도 우선)
 *
 * OCP:
 *   - 신규 모듈, 외부 의존 0 (순수 함수 + 어휘 상수 only).
 *   - 호출처는 conversation-view runAiTurn, conversation-store retry/runAutoTurn 의 'done' 분기.
 */

import type {
  InsightKind,
  InsightMark,
} from "@/modules/conversation/conversation-types";

/** ko 어휘 — 의미 영역별 5건씩. */
const COUNTER_VOCAB_KO = [
  "하지만",
  "그러나",
  "반면",
  "오히려",
  "반대로",
] as const;
const AUGMENT_VOCAB_KO = [
  "덧붙여",
  "추가로",
  "또한",
  "거기에",
  "게다가",
] as const;
const NEWVIEW_VOCAB_KO = [
  "다르게 보면",
  "다른 시각",
  "관점을 바꾸면",
  "한편",
  "시각을 달리하면",
] as const;

/** en 어휘 — 의미 영역별 5건씩. 모두 lower-case 비교. */
const COUNTER_VOCAB_EN = [
  "however",
  "but ",
  "on the other hand",
  "instead",
  "rather",
] as const;
const AUGMENT_VOCAB_EN = [
  "also",
  "in addition",
  "moreover",
  "furthermore",
  "on top of",
] as const;
const NEWVIEW_VOCAB_EN = [
  "another view",
  "differently",
  "from another angle",
  "alternatively",
  "another perspective",
] as const;

export interface InferInsightKindOptions {
  text: string;
  locale: "ko" | "en";
}

/**
 * 텍스트에서 통찰 시그널 어휘를 추출 → InsightKind 반환.
 *   매칭 0건 → null. 우선순위: newView > counter > augment.
 */
export function inferInsightKind({
  text,
  locale,
}: InferInsightKindOptions): InsightKind | null {
  if (!text || !text.trim()) return null;
  const lower = text.toLowerCase();
  const counter = locale === "ko" ? COUNTER_VOCAB_KO : COUNTER_VOCAB_EN;
  const augment = locale === "ko" ? AUGMENT_VOCAB_KO : AUGMENT_VOCAB_EN;
  const newView = locale === "ko" ? NEWVIEW_VOCAB_KO : NEWVIEW_VOCAB_EN;

  if (newView.some((w) => lower.includes(w.toLowerCase()))) return "newView";
  if (counter.some((w) => lower.includes(w.toLowerCase()))) return "counter";
  if (augment.some((w) => lower.includes(w.toLowerCase()))) return "augment";
  return null;
}

export interface MaybeAutoMarkArgs {
  content: string;
  participantKind: "ai" | "human";
  participantId: string;
  /** 이미 마크된 메시지면 자동 분기 skip — 사용자 의도 우선. */
  existingMark?: InsightMark;
  locale: "ko" | "en";
}

/**
 * AI 응답 'done' 분기에서 호출 — 자동 마크 후보 결정.
 *   반환값이 InsightMark 면 호출자가 message.insight 로 patch.
 *   반환값이 null 이면 자동 마크 skip.
 */
export function maybeAutoMark({
  content,
  participantKind,
  participantId,
  existingMark,
  locale,
}: MaybeAutoMarkArgs): InsightMark | null {
  if (existingMark) return null;
  if (participantKind !== "ai") return null;
  if (
    participantId === "system" ||
    participantId === "system-source-context-slicer"
  ) {
    return null;
  }
  const kind = inferInsightKind({ text: content, locale });
  if (!kind) return null;
  return {
    kind,
    markedAt: new Date().toISOString(),
    markedBy: "auto",
  };
}

/** 단위 테스트/디버그 용 — 어휘 사전 export. */
export const __auto_mark_internal = {
  COUNTER_VOCAB_KO,
  AUGMENT_VOCAB_KO,
  NEWVIEW_VOCAB_KO,
  COUNTER_VOCAB_EN,
  AUGMENT_VOCAB_EN,
  NEWVIEW_VOCAB_EN,
};
