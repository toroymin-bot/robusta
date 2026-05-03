"use client";

/**
 * conversation-broadcast.ts
 *   C-D36-2 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-2 (F-D36-2).
 *
 * Why: 다중 탭 conversation list 동기화 — 탭 A 에서 새 conversation 추가 시 탭 B 자동 갱신.
 *   message stream 동기화는 제외 (race 회피, 단순화) — list / active 만.
 *
 * 동작 (자율 결정 D-36-자-2):
 *   - BroadcastChannel name: 'robusta-conversation-sync' (페르소나 / 스케줄 채널과 분리, race 회피).
 *   - publishConversationChange / subscribeConversationSync — schedule-broadcast 패턴 정확 재사용.
 *   - Safari < 15.4 graceful no-op (BroadcastChannel 미지원 환경 — 단일 탭 동작 유지).
 *   - SSR 가드: typeof window === 'undefined' 시 channel 생성 skip.
 *
 * 보존 13: stores/conversation-store.ts SHA 무변동 의무. 본 모듈에서 store 변경 listen 0
 *   (호출자가 명시 publish 호출). conversation-workspace useEffect 카운트 영향 0
 *   (별도 hook use-conversation-sync-listener 안 useEffect — workspace grep 영향 0).
 */

const CHANNEL_NAME = "robusta-conversation-sync";

export type ConversationSyncPayload =
  | { type: "list_changed" }
  | { type: "active_changed"; conversationId: string };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel === null) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // Safari private mode 등 BroadcastChannel 생성 실패 — 단일 탭 동작 유지.
      channel = null;
    }
  }
  return channel;
}

/**
 * 다른 탭에 conversation 변경 알림. SSR / 미지원 환경 graceful no-op.
 *   호출자: conversation-store 의 변경 액션 후 (1줄 추가).
 *   self-broadcast: BroadcastChannel API 자체가 같은 탭 echo 안 함 (브라우저 기본).
 */
export function publishConversationChange(payload: ConversationSyncPayload): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(payload);
  } catch {
    // 직렬화 실패 등 silent fail — sync 부재가 사용자 경험을 깨뜨리지 않음.
  }
}

/**
 * 다른 탭의 변경 알림 구독. unsubscribe 함수 반환 (cleanup 의무).
 *   listener 호출 시점 = 다른 탭에서 publishConversationChange 호출 직후.
 */
export function subscribeConversationSync(
  listener: (payload: ConversationSyncPayload) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handler = (ev: MessageEvent<ConversationSyncPayload>) => {
    listener(ev.data);
  };
  ch.addEventListener("message", handler);
  return () => {
    ch.removeEventListener("message", handler);
  };
}
