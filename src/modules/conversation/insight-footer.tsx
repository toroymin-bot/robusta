/**
 * insight-footer.tsx
 *   - C-D29-2 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-2 (Spec 003 폴리시 본체 진화).
 *     · 다중 발화자 통찰 푸터: chip + count + 클릭 펼침 (D-D29-3 (c) sticky header + scrollable list).
 *     · 4 kind hue 매핑 (D-D29-4): agreement=green / disagreement=red / complement=blue / blindspot=amber.
 *     · MVP 는 message.insights 가 빈 배열/undefined → 미렌더 (Phase 2 LLM 추론 후 활성).
 *
 * Why: Robusta 컨셉 본체 — Do §1.1 "AI들과의 회의실 → 통찰". 1메시지 1마크(insight-mark.tsx) 외에
 *   여러 발화자의 의견 차이·보완·반박을 1건의 통찰로 묶어 사용자에게 시각화.
 *
 * 명명 회피: 기존 `InsightFooter` (insight-mark.tsx) 와 충돌 회피 — 본 컴포넌트는 `MultiSpeakerInsightFooter`.
 *   message-bubble.tsx 가 두 컴포넌트 동시 마운트 (insights 가 있고 status==='done' 인 메시지에 한정).
 *
 * dynamic import:
 *   - 호출자 (message-bubble) 가 next/dynamic ssr:false 로 lazy 로드.
 *   - 메인 번들 +0 의무 (168 kB 게이트 유지).
 *
 * OCP:
 *   - 신규 파일. 기존 message-bubble 의 마크업 비파괴 — wrapper 하단에 footer 슬롯 추가.
 *   - Insight 타입은 conversation-types.ts 에 신규 추가 (Message.insights 옵셔널).
 */

"use client";

import { useState } from "react";
import type {
  Insight,
  MultiSpeakerInsightKind,
} from "./conversation-types";
import { t } from "@/modules/i18n/messages";

/** 4 kind i18n 라벨 키 매핑 (D-D29-4) — t() 의 MessageKey 좁힘 보장. */
export const MULTI_KIND_LABEL_KEY = {
  agreement: "insight.multi.kind.agreement",
  disagreement: "insight.multi.kind.disagreement",
  complement: "insight.multi.kind.complement",
  blindspot: "insight.multi.kind.blindspot",
} as const satisfies Record<
  MultiSpeakerInsightKind,
  | "insight.multi.kind.agreement"
  | "insight.multi.kind.disagreement"
  | "insight.multi.kind.complement"
  | "insight.multi.kind.blindspot"
>;

/** 4 kind hue 색상 (D-D29-4 b: 5 hue 활용 — agreement=green/disagreement=red/complement=blue/blindspot=amber). */
const KIND_HUE_HEX: Record<MultiSpeakerInsightKind, string> = {
  agreement: "#22C55E", // green-500
  disagreement: "#EF4444", // red-500
  complement: "#3B82F6", // blue-500
  blindspot: "#F59E0B", // amber-500
};

/** summary 100자 ellipsis (모바일 가독성). */
function ellipsis(s: string, max = 100): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export interface MultiSpeakerInsightFooterProps {
  messageId: string;
  insights: Insight[];
  /** 페르소나 id → 표시 이름 매핑. 미존재 시 "(삭제됨)" fallback. */
  speakerNameOf?: (personaId: string) => string | null;
}

/**
 * MultiSpeakerInsightFooter
 *   - 닫힘: <Chip tone="info">통찰 {count}</Chip>.
 *   - 클릭: sticky header + scrollable list (kind hue 칩 + summary + 발화자 페르소나 칩).
 *   - insights 빈 배열 → null 렌더.
 */
export function MultiSpeakerInsightFooter({
  messageId,
  insights,
  speakerNameOf,
}: MultiSpeakerInsightFooterProps) {
  const [expanded, setExpanded] = useState(false);
  if (!insights || insights.length === 0) return null;
  const count = insights.length;

  return (
    <div
      className="mx-auto mt-1 max-w-3xl px-4"
      data-test="multi-speaker-insight-footer"
      data-message-id={messageId}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="
          inline-flex items-center gap-1 rounded border border-robusta-divider
          bg-robusta-canvas px-2 py-0.5 text-[11px] text-robusta-inkDim
          hover:border-robusta-accent hover:text-robusta-ink
        "
        aria-expanded={expanded}
        aria-label={t("insight.footer.label").replace(
          "{count}",
          String(count),
        )}
      >
        <span aria-hidden>💬</span>
        <span>
          {t("insight.footer.label").replace("{count}", String(count))}
        </span>
      </button>
      {expanded && (
        <div
          className="
            mt-1 max-h-64 overflow-y-auto rounded border border-robusta-divider
            bg-robusta-canvas
          "
          role="region"
          aria-label={t("insight.footer.panel.aria")}
        >
          <div
            className="
              sticky top-0 border-b border-robusta-divider bg-robusta-canvas
              px-3 py-1 text-[10px] uppercase tracking-wider text-robusta-inkDim
            "
          >
            {t("insight.footer.panel.title").replace(
              "{count}",
              String(count),
            )}
          </div>
          <ul className="divide-y divide-robusta-divider">
            {insights.map((ins) => {
              const hue = KIND_HUE_HEX[ins.kind];
              const speakerLabels = ins.speakerIds.map((pid) => {
                const name = speakerNameOf?.(pid) ?? null;
                return name ?? t("insight.footer.speaker.deleted");
              });
              return (
                <li
                  key={ins.id}
                  className="flex flex-col gap-1 px-3 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: hue }}
                      aria-hidden
                    />
                    <span className="text-[10px] uppercase tracking-wider text-robusta-inkDim">
                      {t(MULTI_KIND_LABEL_KEY[ins.kind])}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-robusta-ink">
                    {ellipsis(ins.summary)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {speakerLabels.map((name, idx) => (
                      <span
                        key={`${ins.id}-${idx}`}
                        className="
                          inline-block rounded border border-robusta-divider
                          px-1.5 py-0.5 text-[10px] text-robusta-inkDim
                        "
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
