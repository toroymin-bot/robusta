/**
 * cost-broadcast.ts
 *   - C-D30-2 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-2 (꼬미 §2 권장 #5).
 *
 * Why: schedule-runner.addAccum 후 다른 탭에 즉시 알림. 폴백은 Dexie liveQuery (cost-cap-store 폴링).
 *
 * BroadcastChannel API:
 *   Safari 16+, Chrome 54+, Firefox 38+, Edge 79+. 미지원 환경은 typeof !== "undefined" 가드 + console.warn (1회만).
 *
 * 메시지 포맷:
 *   { type: "cost-update", date: "YYYY-MM-DD" (UTC), usd: number }
 *   - date 가 오늘(UTC) 이 아니면 무시 (자정 경계 race 방어)
 *
 * 동시 다중 탭 race:
 *   BroadcastChannel 은 빠른 갱신만 — 최종 일관성은 cost-cap-store 폴링이 보장.
 *
 * OCP: schedule-runner 는 1줄만 추가 (addAccum 후 broadcastCostUpdate).
 */

"use client";

export const COST_BROADCAST_CHANNEL = "robusta.cost";

export interface CostBroadcastMessage {
  type: "cost-update";
  /** "YYYY-MM-DD" UTC. */
  date: string;
  /** 누적 USD (broadcastCostUpdate 호출 시점의 누적값 또는 새 가산값 — 호출자 결정). */
  usd: number;
}

let warnedUnsupported = false;

function utcDateKey(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isBroadcastSupported(): boolean {
  return typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";
}

/**
 * broadcastCostUpdate — 다른 탭에 비용 갱신 알림.
 *   호출자: schedule-runner.addAccum 직후. 미지원 환경은 silent (cost-cap-store 폴링이 처리).
 */
export function broadcastCostUpdate(usd: number): void {
  if (!isBroadcastSupported()) {
    if (!warnedUnsupported && typeof console !== "undefined") {
      console.warn(
        "[robusta] cost-broadcast: BroadcastChannel unsupported — falling back to Dexie polling",
      );
      warnedUnsupported = true;
    }
    return;
  }
  try {
    const channel = new BroadcastChannel(COST_BROADCAST_CHANNEL);
    const message: CostBroadcastMessage = {
      type: "cost-update",
      date: utcDateKey(Date.now()),
      usd,
    };
    channel.postMessage(message);
    channel.close();
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[robusta] cost-broadcast: postMessage failed", err);
    }
  }
}

/**
 * subscribeCostUpdates — 본 탭에서 다른 탭의 비용 갱신 수신.
 *   handler 는 새 누적 USD 를 받음 (raw — 호출자가 refresh 트리거).
 *   반환: unsubscribe 함수 (cleanup 용).
 *   미지원 환경 → no-op unsubscribe.
 */
export function subscribeCostUpdates(
  handler: (usd: number) => void,
): () => void {
  if (!isBroadcastSupported()) {
    return () => {
      // no-op
    };
  }
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(COST_BROADCAST_CHANNEL);
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[robusta] cost-broadcast: subscribe init failed", err);
    }
    return () => {
      // no-op
    };
  }

  const today = utcDateKey(Date.now());
  function onMessage(event: MessageEvent<unknown>): void {
    const data = event.data;
    if (
      !data ||
      typeof data !== "object" ||
      (data as CostBroadcastMessage).type !== "cost-update"
    ) {
      return;
    }
    const msg = data as CostBroadcastMessage;
    // 자정 경계 race 방어 — 다른 출처 / 어제 메시지 무시.
    if (msg.date !== today) return;
    if (typeof msg.usd !== "number" || !Number.isFinite(msg.usd)) return;
    try {
      handler(msg.usd);
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[robusta] cost-broadcast: handler threw", err);
      }
    }
  }

  channel.addEventListener("message", onMessage);

  return () => {
    if (channel) {
      try {
        channel.removeEventListener("message", onMessage);
        channel.close();
      } catch {
        // 이미 close 된 경우 — silent.
      }
      channel = null;
    }
  };
}

export const __cost_broadcast_internal = {
  utcDateKey,
  isBroadcastSupported,
};
