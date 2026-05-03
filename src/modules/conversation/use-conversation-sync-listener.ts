"use client";

/**
 * use-conversation-sync-listener.ts
 *   C-D36-2 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-2 (F-D36-2).
 *
 * Why: 다중 탭 conversation list 동기화 hook — 다른 탭의 list_changed 알림 수신 시
 *   현재 탭의 conversation-store 가 loadFromDb() 재실행 (Dexie 단일 진실 reload).
 *
 * 동작:
 *   - subscribeConversationSync 마운트 → list_changed 시 store.loadFromDb() 호출.
 *   - active_changed 는 본 hook 단계에선 무시 (list 만 reload — message stream 충돌 회피).
 *   - cleanup return — 컴포넌트 unmount 시 listener 해제 (leak 방지).
 *
 * 보존 13 정합:
 *   - stores/conversation-store.ts 무수정 의무. 본 hook 은 store 의 loadFromDb action 만 호출.
 *   - workspace 안 1줄 hook call — workspace useEffect 카운트 영향 0.
 */

import { useEffect } from "react";
import { useConversationStore } from "@/stores/conversation-store";
import { subscribeConversationSync } from "./conversation-broadcast";

export function useConversationSyncListener(): void {
  const loadFromDb = useConversationStore((s) => s.loadFromDb);
  useEffect(() => {
    const unsub = subscribeConversationSync((payload) => {
      if (payload.type === "list_changed") {
        void loadFromDb().catch(() => {
          // 회복 가능 silent fail — 다음 tick subscribe 정상 동작.
        });
      }
      // active_changed 는 본 hook 에선 무시 — 사용자 명시 전환만 active 변경 의무.
    });
    return unsub;
  }, [loadFromDb]);
}
