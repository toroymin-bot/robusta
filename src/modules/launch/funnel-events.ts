"use client";

/**
 * src/modules/launch/funnel-events.ts
 *   - C-D43-4 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-4 (F-D43-5 / B-D43-3).
 *
 * Why: D-Day 라이브 후 24h "성공" 정의 — 4 단계 × 3 events = 12 events 사전 확정.
 *   기존 @/modules/funnel/funnel-events 의 discriminated union FunnelEvent (insight_displayed /
 *   byok_required / schedule_fired / visit / persona_used) 와 충돌 0 — 본 모듈은 launch 전용 string
 *   union 12 events 로 분리. 호출자는 logLaunchEvent() 1줄 호출 → Dexie funnelEvents store 에 1행 insert.
 *
 * 정책:
 *   - PII 0: 페이로드는 type / timestamp / 선택적 ranking·comments(숫자) 만.
 *   - 기존 funnelEvents store (db.ts v10) 재사용 — db.ts 무수정 (자율 정정 D-43-자-2).
 *   - getDb() 동적 import 로 메인 번들 영향 0.
 *   - SSR 가드 의무.
 *
 * 외부 dev-deps +0.
 */

export const FUNNEL_EVENTS = [
  // acquisition (3)
  "page_view",
  "show_hn_arrival",
  "direct_visit",
  // activation (3)
  "chip_click",
  "byok_input",
  "first_message",
  // aha-moment (3)
  "ai_response",
  "fifth_turn",
  "meeting_record_download",
  // share (3)
  "share_link_copy",
  "twitter_share",
  "show_hn_comment",
  // C-D48-3 (D-2 11시 슬롯, 2026-05-06) — BYOK 시연 funnel 4 events (B-D48-4 / F-D48-3).
  //   자율 정정 D-48-자-1: 명세는 신규 함수 recordFunnelEvent + readFunnelEvents 분리 요구.
  //     기존 logFunnelEvent / getFunnelCounts (C-D43-4) 동일 패턴 — OCP append 재사용.
  //     보존 13 db.ts 0 수정 (funnelEvents store v10 그대로 사용).
  "byok_demo_started",
  "byok_demo_pinged",
  "byok_demo_completed",
  "byok_demo_failed",
  // 자율 D-49-자-1 (D-2 15시 슬롯, 2026-05-06) — byok-demo-card 리셋 1 event.
  //   Why: 시연 ±2h 윈도우 동안 이전 시연 6/6 ✓ 잔존 → 산만. reset 버튼 호출 카운트.
  //   How to apply: byok-demo-card.tsx reset 버튼 onClick 시 1건 기록. 재시연 빈도 측정.
  "byok_demo_card_reset",
] as const;

export type LaunchFunnelEvent = (typeof FUNNEL_EVENTS)[number];

export interface LaunchFunnelRow {
  id?: number;
  type: `launch:${LaunchFunnelEvent}`;
  timestamp: number;
  payload?: Record<string, unknown>;
}

/**
 * launch 전용 prefix "launch:" 로 기존 funnel events 와 분리.
 *   getFunnelCounts 는 prefix 매칭으로 launch event 만 집계.
 */
export async function logFunnelEvent(
  event: LaunchFunnelEvent,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getDb } = await import("@/modules/storage/db");
    const db = getDb();
    const row = {
      type: `launch:${event}` as const,
      timestamp: Date.now(),
      ...(payload ? { payload } : {}),
    };
    // funnelEvents store 의 type 인덱스에 본 prefix 가 들어가도 호환 (string 인덱스).
    // FunnelEventRow union 과 타입 불일치이지만 Dexie 런타임은 JSON 그대로 저장 — 캐스팅으로 충분.
    await db.funnelEvents.add(row as never);
  } catch (err) {
    console.warn("[launch-funnel] logFunnelEvent failed", err);
  }
}

export async function getFunnelCounts(opts?: {
  since?: number;
}): Promise<Record<LaunchFunnelEvent, number>> {
  const counts = Object.fromEntries(
    FUNNEL_EVENTS.map((e) => [e, 0]),
  ) as Record<LaunchFunnelEvent, number>;
  if (typeof window === "undefined") return counts;
  try {
    const { getDb } = await import("@/modules/storage/db");
    const db = getDb();
    const since =
      typeof opts?.since === "number"
        ? opts.since
        : Date.now() - 24 * 3600 * 1000;
    const rows = await db.funnelEvents.toArray();
    for (const r of rows as unknown as Array<{ type: string; timestamp: number }>) {
      if (typeof r.type !== "string") continue;
      if (!r.type.startsWith("launch:")) continue;
      if (typeof r.timestamp !== "number" || r.timestamp < since) continue;
      const ev = r.type.slice("launch:".length) as LaunchFunnelEvent;
      if (ev in counts) counts[ev] = (counts[ev] ?? 0) + 1;
    }
  } catch (err) {
    console.warn("[launch-funnel] getFunnelCounts failed", err);
  }
  return counts;
}
