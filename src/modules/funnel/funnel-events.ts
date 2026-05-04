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
    }
  // C-D34-5 (D-5 23시 슬롯, 2026-05-03) — schedule 발동 추적 (F-D34-5).
  //   schedule-runner 가 cron 매칭 + 4중 가드 통과 후 fire() 호출 시점에 1건 로깅.
  //   scheduleId 로 후속 분석 (어떤 스케줄이 가장 자주 발동) — Phase 2 funnel UI.
  // C-D39-1 (D-4 23시 슬롯, 2026-05-04) — manual run source 옵셔널 확장.
  //   source 미주입(기존 cron) = undefined / 'manual_now' / 'manual_5min'. PII 0 유지.
  //   기존 schedule-runner 호출자(C-D34-5) 무수정 — 옵셔널이라 backward-compatible.
  | {
      type: "schedule_fired";
      scheduleId: string;
      source?: "manual_now" | "manual_5min";
      timestamp: number;
    }
  // C-D36-3 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-3 (F-D36-3 / B-D35-5 4-funnel KPI).
  //   visit: 첫 마운트 시 sessionStorage 가드 1회 (탭별 1건). PII 0 — 페이로드 type/timestamp 만.
  | {
      type: "visit";
      timestamp: number;
    }
  // C-D36-3 — persona_used: 메시지 송신 시 personaId 변경 감지 1회 로그 (D-36-자-3).
  //   페이로드 personaId 단일 — 어떤 페르소나가 가장 자주 사용되는지 분석 단서.
  // C-D37-2 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-2 (V-D37-1).
  //   페이로드 확장: messageCount / firstUsedAt / lastUsedAt 추가. PII 0 유지 (personaId/숫자만).
  //   호출자가 bumpPersonaStat 결과로 페이로드 채움 — 자체 IndexedDB persona-stats 누적.
  | {
      type: "persona_used";
      personaId: string;
      messageCount: number;
      firstUsedAt: number;
      lastUsedAt: number;
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
