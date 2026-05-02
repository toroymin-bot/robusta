/**
 * insight-parser.ts
 *   - C-D30-5 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-5 (F-D30-5 + B-D30-5).
 *
 * Why: 메시지 본문에 `[!insight:kind]요약[/insight]` 마크업이 포함되어 있으면 Insight 객체로 추출.
 *   Spec 005 LLM 자동 추론 진입 전, MVP 활성화 위한 hybrid 솔루션.
 *   System Prompt 마크업 규칙 (system-prompt-composer 본 슬롯 추가) → AI 가 자율 마크업 → 본 파서 추출.
 *
 * 정규식:
 *   /\[!insight:(agreement|disagreement|complement|blindspot)\](.*?)\[\/insight\]/gs
 *
 *   - kind 매칭 4종 외 → literal 유지 (정규식 미매칭).
 *   - escape `\\[!insight` → 부정 lookbehind `(?<!\\)` 로 무시.
 *   - non-greedy `.*?` + s flag → 줄바꿈 포함 가능. 단 100자 초과 → ellipsis.
 *   - nested 미지원 — non-greedy 가 가까운 종료 태그까지 매칭.
 *
 * 통합 위치:
 *   conversation-api.ts (보존 13) — 메시지 수신 후 cleanText / insights 분리.
 *   conversation-store / message-bubble 가 이미 message.insights 렌더 wiring 완료 (C-D29-2).
 *
 * 168 HARD GATE: <1 kB (gzip) — 정적 import 가능.
 *
 * 엣지 케이스:
 *   1) 잘못된 kind → 정규식 미매칭, literal text 유지
 *   2) escape `\[!insight` → 무시 (literal)
 *   3) 빈 summary → 무시 (insights 미생성)
 *   4) 100자 초과 summary → 100자 + ellipsis "…"
 *   5) 다중 마크업 → 다중 Insight
 *   6) 마크업 미종료 → non-greedy 가 다음 종료 태그까지 → 의도치 않은 매칭 가능 (System Prompt 가이드라인 권장)
 */

import type { Insight, MultiSpeakerInsightKind } from "./conversation-types";

const VALID_KINDS: ReadonlySet<MultiSpeakerInsightKind> = new Set([
  "agreement",
  "disagreement",
  "complement",
  "blindspot",
]);

const SUMMARY_MAX_CHARS = 100;
const ELLIPSIS = "…";

/**
 * INSIGHT_REGEX — 마크업 추출 정규식.
 *   negative lookbehind `(?<!\\)` 로 escape `\[!insight` 무시.
 *   g flag 로 다중 매칭. s flag 로 줄바꿈 포함.
 */
export const INSIGHT_REGEX =
  /(?<!\\)\[!insight:(agreement|disagreement|complement|blindspot)\]([\s\S]*?)\[\/insight\]/g;

export interface ParseInsightsResult {
  /** 마크업 제거된 본문. */
  cleanText: string;
  /** 추출된 Insight 배열 (등장 순). speakerIds = [speakerId] 단일. */
  insights: Insight[];
}

/**
 * parseInsights — 본문 → cleanText + insights 분리.
 *   호출자: conversation-api / conversation-store 수신 후.
 *
 *   speakerId — 본 메시지 발화자 id. Insight.speakerIds = [speakerId] 단일.
 *   다발화자 통찰은 Spec 005 LLM 메타 추론에서 다중 speakerIds 부여.
 *
 *   id 발급: crypto.randomUUID() (브라우저 + Node 18+) → 미지원 환경 폴백.
 */
export function parseInsights(
  text: string,
  speakerId: string,
): ParseInsightsResult {
  if (typeof text !== "string" || text.length === 0) {
    return { cleanText: text ?? "", insights: [] };
  }

  const insights: Insight[] = [];
  let cleanText = "";
  let lastIndex = 0;

  const regex = new RegExp(INSIGHT_REGEX.source, INSIGHT_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const [whole, kindRaw, summaryRaw] = match;
    const kind = kindRaw as MultiSpeakerInsightKind;
    if (!VALID_KINDS.has(kind)) {
      // 안전망 — 정규식이 4종만 캡처하므로 이론상 도달 불가. 도달 시 literal 유지.
      cleanText += text.slice(lastIndex, match.index + whole.length);
      lastIndex = match.index + whole.length;
      continue;
    }
    const summary = truncateSummary((summaryRaw ?? "").trim());
    cleanText += text.slice(lastIndex, match.index);
    lastIndex = match.index + whole.length;

    if (summary.length === 0) {
      // 빈 summary — Insight 미생성. 본문에서도 마크업만 제거.
      continue;
    }

    insights.push({
      id: makeInsightId(),
      kind,
      speakerIds: [speakerId],
      summary,
    });
  }
  cleanText += text.slice(lastIndex);

  // escape `\[!insight` 처리 — 정규식 negative lookbehind 가 매칭 회피.
  // 단, 사용자가 `\[!insight...]` 자체를 본문에 노출하고 싶을 수 있으므로
  // backslash 1개는 유지 (Markdown literal escape 호환 — backslash 다음 문자는 그대로).
  // 본 단순 구현은 backslash 그대로 유지 — 호출자 / UI 가 추가 normalize 가능.

  return { cleanText, insights };
}

function truncateSummary(s: string): string {
  if (s.length <= SUMMARY_MAX_CHARS) return s;
  return s.slice(0, SUMMARY_MAX_CHARS) + ELLIPSIS;
}

function makeInsightId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const __insight_parser_internal = {
  VALID_KINDS,
  SUMMARY_MAX_CHARS,
  ELLIPSIS,
  INSIGHT_REGEX,
  truncateSummary,
};
