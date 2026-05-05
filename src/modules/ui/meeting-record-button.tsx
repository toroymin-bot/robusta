"use client";

/**
 * meeting-record-button.tsx
 *   - C-D43-2 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-2 (V-D43-4 / B-D43-5).
 *
 * Hero 보조 CTA — 회의록 .md 다운로드.
 *   - 5턴 미만 시 disabled (회색) + tooltip "5턴 후 활성".
 *   - conversation-store 메시지 + persona/participant store 의 speaker 라벨 결합 → MeetingMessage[] 어댑터.
 *   - dynamic import 로 메인 번들 영향 최소화 (welcome-view 진입점은 메인 번들 직격, button 자체는 정적이지만
 *     conversation-store / persona-store 는 lazy chunk 로 wiring).
 *   - i18n: meeting.record.cta / meeting.record.cta.disabled.
 *
 * 외부 dev-deps +0.
 */

import { useEffect, useState, type JSX } from "react";
import { t, type Locale } from "@/modules/i18n/messages";
import {
  downloadAsMarkdown,
  isExportable,
  type MeetingMessage,
} from "@/modules/conversation/meeting-record";
import { DEFAULT_CONVERSATION_ID } from "@/modules/conversation/conversation-types";

interface Props {
  locale?: Locale;
}

export default function MeetingRecordButton(props: Props): JSX.Element {
  const locale: Locale = props.locale ?? "ko";
  const [messages, setMessages] = useState<MeetingMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const sync = async () => {
      try {
        const [convMod, partMod] = await Promise.all([
          import("@/stores/conversation-store"),
          import("@/stores/participant-store"),
        ]);
        const convStore = convMod.useConversationStore.getState();
        const partStore = partMod.useParticipantStore.getState();
        const raw = convStore.messages[DEFAULT_CONVERSATION_ID] ?? [];
        const labelOf = (pid: string): { speaker: string; role: "human" | "ai" } => {
          const p = partStore.participants.find((x) => x.id === pid);
          if (!p) return { speaker: "Unknown", role: "ai" };
          return {
            speaker: p.name ?? pid,
            role: p.kind === "human" ? "human" : "ai",
          };
        };
        const meeting: MeetingMessage[] = raw.map((m) => {
          const { speaker, role } = labelOf(m.participantId);
          return {
            speaker,
            role,
            timestamp: new Date(m.createdAt).toISOString(),
            content: m.content,
          };
        });
        if (!cancelled) setMessages(meeting);
      } catch {
        // store hydrate 미완 — 다음 sync 에서 채움.
      }
    };

    void sync();

    void Promise.all([
      import("@/stores/conversation-store"),
      import("@/stores/participant-store"),
    ]).then(([convMod, partMod]) => {
      if (cancelled) return;
      const u1 = convMod.useConversationStore.subscribe(() => void sync());
      const u2 = partMod.useParticipantStore.subscribe(() => void sync());
      unsub = () => {
        u1();
        u2();
      };
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const enabled = isExportable(messages);
  const label = enabled
    ? t("meeting.record.cta", undefined, locale)
    : `${t("meeting.record.cta", undefined, locale)} · ${t("meeting.record.cta.disabled", undefined, locale)}`;

  const cls = enabled
    ? "inline-flex items-center gap-1 rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-ink hover:border-robusta-accent transition focus-visible:ring-2 focus-visible:ring-robusta-accent"
    : "inline-flex items-center gap-1 rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-inkDim opacity-60 cursor-not-allowed";

  return (
    <button
      type="button"
      data-test="meeting-record-cta"
      data-enabled={enabled ? "true" : "false"}
      disabled={!enabled}
      title={enabled ? "" : t("meeting.record.cta.disabled", undefined, locale)}
      onClick={() => {
        if (!enabled) return;
        downloadAsMarkdown(messages, { locale });
      }}
      className={cls}
    >
      {label}
    </button>
  );
}
