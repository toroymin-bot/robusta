"use client";

/**
 * schedules/schedule-broadcast.ts
 *   C-D35-3 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-3 (D-35-자-3).
 *
 * Why: 다른 탭에서 schedule 추가/삭제 시 list 자동 갱신.
 *   persona-broadcast(C-D34-3) 패턴 재사용 — 채널 분리 ('robusta-schedule-sync').
 *
 * 동작:
 *   - publishScheduleChange(): 다른 탭에 list reload 신호 1회.
 *   - subscribeScheduleSync(cb): 다른 탭의 신호 수신 시 cb 호출. cleanup 함수 반환.
 *
 * BroadcastChannel 미지원 환경(SSR / 구 브라우저) → silent fallback (try/catch).
 *   echo 방지 — 자기 자신이 publish 한 메시지는 수신 무시 (senderId 비교).
 */

const CHANNEL_NAME = "robusta-schedule-sync";
const SENDER_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

interface ScheduleSyncMessage {
  type: "schedule-changed";
  senderId: string;
  timestamp: number;
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    return channel;
  } catch {
    return null;
  }
}

export function publishScheduleChange(): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    const msg: ScheduleSyncMessage = {
      type: "schedule-changed",
      senderId: SENDER_ID,
      timestamp: Date.now(),
    };
    ch.postMessage(msg);
  } catch {
    /* silent */
  }
}

export function subscribeScheduleSync(cb: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  function handler(ev: MessageEvent<ScheduleSyncMessage>): void {
    const data = ev.data;
    if (!data || data.type !== "schedule-changed") return;
    if (data.senderId === SENDER_ID) return; // echo 방지
    cb();
  }
  try {
    ch.addEventListener("message", handler as EventListener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      ch.removeEventListener("message", handler as EventListener);
    } catch {
      /* silent */
    }
  };
}

export const __schedule_broadcast_internal = {
  CHANNEL_NAME,
  SENDER_ID,
};
