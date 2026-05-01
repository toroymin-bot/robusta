/**
 * export-menu.tsx
 *   - C-D22-1 (D6 19시 슬롯, 2026-05-01) — F-24 Export 메뉴 UI (SideSheet "도구" 섹션).
 *   - 똘이 §5 C-D18-5 / C-D21-4 후속 — UI 와이어업 단계.
 *
 * 책임 (Single Responsibility):
 *   - 두 가지 포맷(MD/JSON) 다운로드 버튼 + 빈 룸 disabled 처리.
 *   - i18n 카피 + 토스트 (성공/실패) 발화.
 *
 * 비-책임:
 *   - Blob/URL 핸들링 — useRoomExport 훅이 담당.
 *   - Stores 매핑 — buildRoomLike 가 담당.
 *
 * 정책 (KQ_15 자율 결정):
 *   - 헤더 4도구 + 토큰 카운터로 포화 → SideSheet 하단 "도구" 그룹에 등록.
 *   - 데스크탑은 헤더에 노출하지 않음 (모바일과 동일하게 사이드 시트 진입 — 일관성).
 *   - 메시지 0건이면 두 버튼 disabled + 안내 카피.
 *   - 모바일 터치 타깃 최소 44px (compact 모드 기준).
 */

"use client";

import { useCallback, useMemo } from "react";
import { useConversationStore } from "@/stores/conversation-store";
import { useParticipantStore } from "@/stores/participant-store";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
import { useRoomExport } from "@/views/conversation/useRoomExport";
import { buildRoomLike } from "@/views/conversation/buildRoomLike";

export function ExportMenu() {
  // 스토어 selector 분리 — 다른 state 변경 시 본 컴포넌트는 re-render 회피.
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  );
  const messages = useConversationStore(
    (s) => s.messages[s.activeConversationId] ?? [],
  );
  const participants = useParticipantStore((s) => s.participants);
  const pushToast = useToastStore((s) => s.push);

  // useRoomExport 옵션 — getRoom 콜백을 매 호출 시 stores 스냅샷으로 평가.
  const getRoom = useCallback(
    () => buildRoomLike({ conversation, messages, participants }),
    [conversation, messages, participants],
  );
  const { canExport, exportAs } = useRoomExport({ getRoom });

  // 빈 룸 disabled — 메시지 0건이면 두 버튼 비활성.
  const isEmpty = useMemo(() => messages.length === 0, [messages]);
  const disabled = !canExport || !conversation || isEmpty;

  const handleExport = useCallback(
    async (format: "md" | "json") => {
      if (disabled) return;
      try {
        await exportAs(format);
        pushToast({
          tone: "info",
          message: t("export.toast.success").replace(
            "{format}",
            format.toUpperCase(),
          ),
        });
      } catch (err) {
        console.error("[robusta] export failed", err);
        pushToast({
          tone: "error",
          message: t("export.toast.failure"),
        });
      }
    },
    [disabled, exportAs, pushToast],
  );

  // SSR 안전 — activeConversationId 가 비어있으면 null 반환 (FOUC 회피).
  if (!activeConversationId) return null;

  return (
    <section
      role="group"
      aria-label={t("export.menu.aria")}
      data-test="export-menu"
      className="flex flex-col gap-2 border-t border-robusta-divider px-4 py-3"
    >
      <h3
        className="text-xs font-semibold uppercase tracking-widest text-robusta-inkDim"
        data-test="export-menu-section-title"
      >
        {t("export.menu.section")}
      </h3>
      <div className="flex items-center gap-2">
        <span
          className="whitespace-nowrap text-xs text-robusta-ink"
          aria-hidden
        >
          {t("export.menu.title")}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleExport("md")}
          data-test="export-menu-md"
          aria-label={`${t("export.menu.title")} — ${t("export.menu.markdown")}`}
          className="
            min-h-[44px] flex-1 rounded
            border border-robusta-divider px-3 py-1
            text-xs text-robusta-ink
            hover:border-robusta-accent
            focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {t("export.menu.markdown")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleExport("json")}
          data-test="export-menu-json"
          aria-label={`${t("export.menu.title")} — ${t("export.menu.json")}`}
          className="
            min-h-[44px] flex-1 rounded
            border border-robusta-divider px-3 py-1
            text-xs text-robusta-ink
            hover:border-robusta-accent
            focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {t("export.menu.json")}
        </button>
      </div>
      {isEmpty && (
        <p
          className="text-[11px] text-robusta-inkDim"
          data-test="export-menu-empty-hint"
        >
          {t("export.disabled.empty")}
        </p>
      )}
    </section>
  );
}
