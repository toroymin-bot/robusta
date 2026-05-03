"use client";

/**
 * persona-broadcast.ts
 *   C-D34-3 (D-5 23시 슬롯, 2026-05-03) — Tori spec C-D34-3 (F-D33-4 (c) + F-D34-3).
 *
 * Why: 다중 탭에서 페르소나 변경(추가/수정/삭제/clone) 동기화. Roy D-2 BYOK 시연 시
 *   탭 간 페르소나 confusing 사용자 신뢰 손상 방지. cost-broadcast 채널과 분리하여 race 회피.
 *
 * 정책:
 *   - 채널 'robusta-persona-sync' (api-keys 채널과 분리).
 *   - 메시지 schema { type: 'persona-changed', personaId, version, timestamp, senderId }.
 *   - senderId 자기 sender 무시 (echo loop 방지).
 *   - BroadcastChannel 미지원 환경 → silent fallback (try/catch + null 채널).
 *
 * 보존 13 영향: 0 (신규 모듈). persona-store.ts 는 보존 13 대상 아님 (Persona 시스템 보존 범위는
 *   persona-edit-modal.tsx + persona-types.ts 한정 — Do §3.6).
 *
 * 168 영향: lazy chunk 분리 의무 — store.hydrate 시 dynamic import 로 호출.
 */

const CHANNEL_NAME = "robusta-persona-sync";

/** sender id — 모듈 로드 시 1회 발급. self echo 무시 시 사용. */
const SENDER_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sender_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export interface PersonaSyncMessage {
  type: "persona-changed";
  personaId: string;
  version: number;
  timestamp: number;
  senderId: string;
}

let channel: BroadcastChannel | null = null;
let attempted = false;

function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (attempted) return null;
  attempted = true;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    return channel;
  } catch {
    return null;
  }
}

/** 페르소나 변경 발행. 미지원 환경 / 채널 실패 → silent. */
export function publishPersonaChange(
  personaId: string,
  version: number = Date.now(),
): void {
  const c = getChannel();
  if (!c) return;
  try {
    c.postMessage({
      type: "persona-changed",
      personaId,
      version,
      timestamp: Date.now(),
      senderId: SENDER_ID,
    } satisfies PersonaSyncMessage);
  } catch {
    /* silent — IndexedDB-style 차단 환경 안전망. */
  }
}

/**
 * 페르소나 변경 구독. 자기 sender 메시지는 자동 무시.
 *   반환: cleanup 함수 (listener 제거).
 */
export function subscribePersonaSync(
  handler: (msg: PersonaSyncMessage) => void,
): () => void {
  const c = getChannel();
  if (!c) return () => {};
  const listener = (ev: MessageEvent<PersonaSyncMessage>) => {
    const data = ev.data;
    if (!data || data.senderId === SENDER_ID) return;
    handler(data);
  };
  c.addEventListener("message", listener);
  return () => {
    try {
      c.removeEventListener("message", listener);
    } catch {
      /* silent */
    }
  };
}

/** 테스트용 — sender id 노출. production 미사용. */
export function __getPersonaSenderId(): string {
  return SENDER_ID;
}
