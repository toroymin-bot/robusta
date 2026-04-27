/**
 * online-listener.ts — D-12.3 (Day 6, 2026-04-28) 네트워크 회복 자동 재개 토스트.
 *
 * 동작:
 *   1) window 'online' 이벤트에 한 번만 등록 (모듈 패턴 — hot-reload 안전).
 *   2) 직전 5분 이내 status='error' (errorReason ∋ network/timeout) 메시지 존재 시
 *      → toast info 푸시 (label = action.retryAll, onClick = retryAll).
 *   3) 1회/3초 throttle (visibilitychange + online 동시 발화 방지).
 *
 * 자율 영역(명세 §9): retryAll 간격 200ms, throttle 윈도우 3초 — 본 모듈에서 throttle만 가짐.
 *
 * 추정 26: window.online이 모바일/PWA 환경에서도 정상 발화. 다음 사용자 시점 검증.
 */

"use client";

import { useToastStore } from "./toast";
import { useConversationStore } from "@/stores/conversation-store";
import { t } from "@/modules/i18n/messages";

/** 5분 윈도우 — 그 이전의 error 메시지는 자동 재개 후보에서 제외 (사용자가 이미 잊었을 가능성). */
export const ONLINE_RETRY_WINDOW_MS = 5 * 60 * 1000;

/** throttle 윈도우 — 자율 영역, 변경 자유. */
export const ONLINE_THROTTLE_MS = 3000;

let registered = false;
let lastFiredAt = 0;

/**
 * 부트 시 1회 호출. 두 번 호출되어도 중복 등록 X (모듈 가드).
 * 호출자: 최상위 layout 또는 page useEffect.
 */
export function registerOnlineListener(): void {
  if (typeof window === "undefined") return;
  if (registered) return;
  registered = true;
  window.addEventListener("online", handleOnline);
}

/**
 * 테스트/cleanup 용 unregister. 운영 코드에서는 사용 X.
 */
export function unregisterOnlineListener(): void {
  if (typeof window === "undefined") return;
  if (!registered) return;
  registered = false;
  window.removeEventListener("online", handleOnline);
  lastFiredAt = 0;
}

function handleOnline(): void {
  const now = Date.now();
  if (now - lastFiredAt < ONLINE_THROTTLE_MS) return;
  lastFiredAt = now;

  const since = now - ONLINE_RETRY_WINDOW_MS;
  const state = useConversationStore.getState();
  const messages = state.messages[state.activeConversationId] ?? [];
  const candidates = messages.filter(
    (m) =>
      m.status === "error" &&
      m.createdAt >= since &&
      typeof m.errorReason === "string" &&
      (m.errorReason.toLowerCase().includes("network") ||
        m.errorReason.toLowerCase().includes("timeout") ||
        m.errorReason.toLowerCase().includes("offline")),
  );

  if (candidates.length === 0) return;

  useToastStore.getState().push({
    tone: "info",
    message: t("toast.network.restored"),
    action: {
      label: t("action.retryAll"),
      onClick: () => {
        void useConversationStore.getState().retryAll({
          since,
          reasons: ["network", "timeout"],
        });
      },
    },
  });
}

export const __online_listener_internal = {
  ONLINE_RETRY_WINDOW_MS,
  ONLINE_THROTTLE_MS,
  handleOnline,
  reset: () => {
    registered = false;
    lastFiredAt = 0;
  },
};
