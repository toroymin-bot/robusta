"use client";

/**
 * meeting-record.ts
 *   - C-D43-2 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-2 (F-D43-2 / B-D43-5 / V-D43-4).
 *
 * Why: Robusta = "출력은 메시지가 아니라 통찰". 다자(多者) 브레인스토밍 결과를 .md 로 다운로드 — 통찰 가치 가시화.
 *   BYOK 정합 — 외부 SaaS 0, Blob URL 로 클라이언트 내 다운로드만.
 *
 * 정책:
 *   - 5턴 미만 → isExportable=false (빈 회의록 방지).
 *   - UTF-8 명시 (한국어/영문 mixed 인코딩 정합) — Blob type "text/markdown;charset=utf-8".
 *   - C-D46-3 (D-2 03시, 2026-05-06): BOM UTF-8 prefix '﻿' (= 0xEF 0xBB 0xBF 3바이트) —
 *     윈도우 메모장 mixed 인코딩 깨짐 방지. toMarkdown() 출력 첫 문자 '﻿' 의무.
 *   - filename 영문만 ("meeting-{ISO}.md") — cross-platform safe.
 *   - URL.revokeObjectURL 의무 (메모리 누수 방지).
 *   - markdown injection 신뢰 — BYOK 자가 사용 모델, 사용자 입력 신뢰.
 *
 * 외부 dev-deps +0. 보존 13 v3 무손상 (meeting-record.ts 미포함, OCP 가능).
 */

import type { Message } from "./conversation-types";
import { t, type Locale } from "@/modules/i18n/messages";

export interface MeetingMessage {
  speaker: string; // 페르소나 이름 (사람이 읽는 라벨)
  role: "human" | "ai";
  timestamp: string; // ISO 8601
  content: string; // 메시지 본문 (markdown 허용)
}

export interface MeetingExportOpts {
  filename?: string;
  title?: string;
  locale?: Locale;
}

/**
 * Message → MeetingMessage 어댑터.
 *   participantId → speaker 매핑은 호출자 책임 (페르소나 store 접근 의무).
 *   speaker / role 미주입 시 fallback ("Unknown" / "ai").
 */
export function messageToMeetingMessage(
  m: Pick<Message, "content" | "createdAt">,
  args: { speaker: string; role: "human" | "ai" },
): MeetingMessage {
  return {
    speaker: args.speaker,
    role: args.role,
    timestamp: new Date(m.createdAt).toISOString(),
    content: m.content,
  };
}

/**
 * 5턴 이상 + 적어도 1 ai role 포함 시에만 export 가능.
 *   빈 회의록 방지 (V-D43-4 disabled tooltip 의무).
 */
export function isExportable(messages: MeetingMessage[]): boolean {
  if (messages.length < 5) return false;
  return messages.some((m) => m.role === "ai");
}

function todayIso(now: number = Date.now()): string {
  // YYYY-MM-DD (UTC) — filename / title 안정적.
  return new Date(now).toISOString().slice(0, 10);
}

export function toMarkdown(
  messages: MeetingMessage[],
  opts?: MeetingExportOpts,
): string {
  const locale: Locale = opts?.locale ?? "ko";
  const titlePrefix = opts?.title ?? t("meeting.record.title", undefined, locale);
  const subtitle = t("meeting.record.subtitle", undefined, locale);
  const sectionParticipants = t(
    "meeting.record.section.participants",
    undefined,
    locale,
  );
  const sectionDialog = t("meeting.record.section.dialog", undefined, locale);
  const dateLabel = todayIso();

  // 참여자 라벨 (중복 제거, 입장 순서 보존).
  const participantsSet = new Map<string, "human" | "ai">();
  for (const m of messages) {
    if (!participantsSet.has(m.speaker)) {
      participantsSet.set(m.speaker, m.role);
    }
  }
  const participantLines = Array.from(participantsSet.entries())
    .map(([name, role]) => `- ${name} (${role === "ai" ? "AI" : "Human"})`)
    .join("\n");

  // 대화 본문.
  const dialogLines = messages
    .map((m) => {
      const ts = m.timestamp.slice(11, 19); // HH:mm:ss UTC
      const body = m.content
        .split("\n")
        .map((ln) => `> ${ln}`)
        .join("\n");
      return `**${m.speaker}** · ${ts}\n${body}`;
    })
    .join("\n\n");

  // C-D46-3 — BOM UTF-8 prefix '﻿' (= 0xEF 0xBB 0xBF, 3바이트). 윈도우 메모장 mixed 인코딩 정합.
  return `﻿# ${titlePrefix} — ${dateLabel}

> ${subtitle}

---

## ${sectionParticipants}
${participantLines || "- (none)"}

## ${sectionDialog}

${dialogLines || "(empty)"}

---

_Robusta · BYOK · 키는 브라우저 저장 · 0 서버 보관_
`;
}

/**
 * Blob 다운로드 트리거.
 *   SSR 가드 + try/catch 로 silent fail (잡스 잡음 0).
 *   URL.revokeObjectURL 의무.
 */
export function downloadAsMarkdown(
  messages: MeetingMessage[],
  opts?: MeetingExportOpts,
): void {
  if (typeof window === "undefined") return;
  const md = toMarkdown(messages, opts);
  const filename = opts?.filename ?? `meeting-${todayIso()}.md`;
  try {
    const blob = new Blob([md], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 즉시 revoke 시 일부 브라우저(Safari) 다운로드 트리거 전 URL 회수 위험 → 다음 task 로 위임.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    console.warn("[meeting-record] download failed", err);
  }
}
