"use client";

/**
 * funnel-events.ts
 *   C-D32-2 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-2 (F-D32-2 / B-D31-5 (c)).
 *   Insight 가시화 + 기타 funnel 이벤트의 Dexie 영속 추적.
 *
 *   꼬미 자율 결정 (15시 슬롯):
 *     - 명세는 보존 13 자산을 가정했으나 실제 funnel 모듈 부재 — 본 슬롯에서 신규 생성.
 *     - Dexie v10 신규 테이블 funnelEvents (PK auto-increment id, 인덱스 type/timestamp).
 *     - main bundle 영향 0: getDb() 동적 import 로 SSR/메인 번들 회피.
 *     - 동일 messageId 중복 로깅 방지: in-memory Set + 호출자 useRef 가드 페어.
 *
 *   FunnelEvent union 은 append-only — 신규 이벤트는 새 type 만 추가.
 *
 *   외부 의존 0 (BYOK 정합 — 외부 SaaS 미사용).
 */

export type FunnelEvent =
  | {
      type: "insight_displayed";
      messageId: string;
      insightCount: number;
      speakerId: string;
      timestamp: number;
    }
  // C-D33-1 (D-5 19시 슬롯, 2026-05-03) — KeyInputModal 진입점 hook 추적.
  //   source: 'entry' = mount 시 anthropic 키 부재 / 'send_401' = streamMessage 응답 401.
  | {
      type: "byok_required";
      source: "entry" | "send_401";
      timestamp: number;
    };

// C-D33-1 (D-5 19시 슬롯, 2026-05-03) — FunnelEvent 가 다중 member union 으로 확장됨에 따라
//   interface extends 불가 → type alias 로 전환 (의미 동일, Dexie row 타입 그대로).
export type FunnelEventRow = FunnelEvent & { id?: number };

/**
 * dedupe 가드 — 동일 process(tab) 안에서 messageId 중복 insight_displayed 방지.
 *   페이지 reload 시 비워짐 (영속 dedupe 는 호출자 책임).
 */
const insightDisplayedSeen = new Set<string>();

/**
 * logFunnelEvent — 비동기 fire-and-forget. throw 시 console.warn 후 swallow.
 *   호출자(UI) 가 에러 처리에 신경쓰지 않도록 Promise 미반환.
 */
export function logFunnelEvent(event: FunnelEvent): void {
  if (typeof window === "undefined") return;
  // (1) insight_displayed 동일 messageId 중복 차단.
  if (event.type === "insight_displayed") {
    if (insightDisplayedSeen.has(event.messageId)) return;
    insightDisplayedSeen.add(event.messageId);
  }
  // (2) Dexie 영속 — 동적 import 로 메인 번들 영향 0.
  void (async () => {
    try {
      const { getDb } = await import("@/modules/storage/db");
      const db = getDb();
      await db.funnelEvents.add(event as FunnelEventRow);
    } catch (err) {
      // BYOK 정합 — 외부 텔레메트리 0. console.warn 만 발생.
      console.warn("[funnel] logFunnelEvent failed", err);
    }
  })();
}

/**
 * 테스트/디버그 용 — funnelEvents 모두 조회.
 *   Phase 2 분석 단계에서 export UI 가 호출.
 */
export async function listFunnelEvents(): Promise<FunnelEventRow[]> {
  if (typeof window === "undefined") return [];
  const { getDb } = await import("@/modules/storage/db");
  const db = getDb();
  return db.funnelEvents.toArray();
}

/**
 * 테스트 용 dedupe 리셋 — production 미호출.
 */
export function __resetInsightDedupe(): void {
  insightDisplayedSeen.clear();
}
