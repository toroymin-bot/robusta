"use client";

/**
 * empty-room-hint.tsx
 *   C-D33-5 (D-5 19시 슬롯, 2026-05-03) — Tori spec C-D33-5 (F-D33-5 / B-D33-4 / D-D33-4).
 *   Robusta 컨셉 사수 — 빈 방(메시지 0건) 진입자가 첫 액션을 잡도록 1줄 힌트.
 *
 *   동작:
 *     - 활성 conversation 의 messages 길이 0 → 중앙 placeholder 1줄 표시.
 *     - 1건 이상 → 즉시 unmount (subscribe 즉시성).
 *
 *   디자인 토큰 (D-D33-4):
 *     text-sm (14px), text-neutral-500/text-robusta-inkDim, text-center, py-12, no border.
 *
 *   메인 번들 영향: 호출자(workspace) 가 lazy import → 본 컴포넌트 자체는 chunk 분리.
 */

import { t } from "@/modules/i18n/messages";
import { useConversationStore } from "@/stores/conversation-store";

export function EmptyRoomHint() {
  // 활성 conversation 의 메시지 카운트만 구독 — 다른 룸 변경에 재렌더 0.
  const count = useConversationStore((s) => {
    const arr = s.messages[s.activeConversationId] ?? [];
    return arr.length;
  });
  if (count > 0) return null;
  return (
    <div
      data-test="empty-room-hint"
      className="pointer-events-none absolute inset-x-0 bottom-24 px-4 py-2 text-center text-sm text-robusta-inkDim"
      role="note"
      aria-label={t("room.empty.hint")}
    >
      {t("room.empty.hint")}
    </div>
  );
}

export default EmptyRoomHint;
