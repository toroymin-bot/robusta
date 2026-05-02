/**
 * auto-mark.ts
 *   - C-D25-1 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-1 v0 어휘 사전.
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1 v1 정밀도 보강.
 *
 * Spec 003 통찰 강조 푸터의 자동 마크 활성화.
 *   AI 응답 메시지 완료 시 텍스트에서 시그널 어휘를 추출 → markedBy='auto' 으로 자동 마크.
 *   사용자 수동 마크(C-D24-3)와 공존 — 이미 mark가 있으면 자동 분기 skip.
 *
 * v1 (D-D26): 어휘 사전을 ./auto-mark-vocab 별도 chunk 로 분리 (메인 번들 +0).
 *   inferInsightKind / maybeAutoMark 모두 async — 호출자는 await 1 frame.
 *   ko/en 각 5→8 단어 (총 48). 인접 메시지 컨텍스트는 v2 분리.
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
 *   - vocab dynamic import (호출처 시그니처 비파괴 — 이미 await maybeAutoMark 패턴).
 *   - precision 측정은 ./auto-mark-precision 모듈 분리.
 */

import type {
  InsightKind,
  InsightMark,
} from "@/modules/conversation/conversation-types";

export interface InferInsightKindOptions {
  text: string;
  locale: "ko" | "en";
}

/**
 * 텍스트에서 통찰 시그널 어휘를 추출 → InsightKind 반환.
 *   매칭 0건 → null. 우선순위: newView > counter > augment.
 *   v1: vocab dynamic import — 메인 번들 +0.
 *   import 실패 시 null fallback (앱 동작 유지).
 */
export async function inferInsightKind({
  text,
  locale,
}: InferInsightKindOptions): Promise<InsightKind | null> {
  if (!text || !text.trim()) return null;
  let vocab: typeof import("./auto-mark-vocab");
  try {
    vocab = await import("./auto-mark-vocab");
  } catch {
    return null;
  }
  const lower = text.toLowerCase();
  const counter =
    locale === "ko" ? vocab.COUNTER_VOCAB_KO : vocab.COUNTER_VOCAB_EN;
  const augment =
    locale === "ko" ? vocab.AUGMENT_VOCAB_KO : vocab.AUGMENT_VOCAB_EN;
  const newView =
    locale === "ko" ? vocab.NEWVIEW_VOCAB_KO : vocab.NEWVIEW_VOCAB_EN;

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
export async function maybeAutoMark({
  content,
  participantKind,
  participantId,
  existingMark,
  locale,
}: MaybeAutoMarkArgs): Promise<InsightMark | null> {
  if (existingMark) return null;
  if (participantKind !== "ai") return null;
  if (
    participantId === "system" ||
    participantId === "system-source-context-slicer"
  ) {
    return null;
  }
  const kind = await inferInsightKind({ text: content, locale });
  if (!kind) return null;
  return {
    kind,
    markedAt: new Date().toISOString(),
    markedBy: "auto",
  };
}
