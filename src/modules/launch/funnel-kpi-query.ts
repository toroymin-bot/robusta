"use client";

/**
 * funnel-kpi-query.ts
 *   - C-D44-3 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-3 (B-D44-5 + F-D44-3).
 *
 * Why: 지난 24h funnelEvents 집계 — read-only. 보존 13 db.ts 무수정 의무.
 *
 * 자율 정정:
 *   - D-44-자-2: 명세 SoT 모듈 경로 미존재 — 실 모듈 '@/modules/storage/db' 직접 import.
 *   - D-44-자-4: 명세 윈도우 'event.ts' 추정 → 실 필드명은 'timestamp' (db.ts v10 인덱스).
 *
 * 정책:
 *   - read-only 의무 — db.put/add/delete/update 호출 0건 (verify-d44 gate 8 grep).
 *   - SSR 가드 — typeof window 체크.
 *   - 외부 dev-deps +0.
 */

import type { LaunchFunnelEvent } from "./funnel-events";

export interface FunnelKPI {
  total: number;
  byType: Record<string, number>;
  windowStart: string; // ISO
  windowEnd: string;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 지난 24h funnelEvents read-only 집계.
 *   - 'launch:' prefix 만 매칭 (launch event 분리).
 *   - 윈도우: now - 24h ≤ timestamp < now.
 *   - SSR: 빈 결과 + 윈도우 표기만.
 */
export async function getFunnel24h(): Promise<FunnelKPI> {
  const now = Date.now();
  const windowEnd = new Date(now).toISOString();
  const windowStart = new Date(now - WINDOW_MS).toISOString();

  if (typeof window === "undefined") {
    return { total: 0, byType: {}, windowStart, windowEnd };
  }

  try {
    const { getDb } = await import("@/modules/storage/db");
    const db = getDb();
    const rows = await db.funnelEvents.toArray();

    const byType: Record<string, number> = {};
    let total = 0;
    const since = now - WINDOW_MS;

    for (const r of rows as unknown as Array<{
      type: string;
      timestamp: number;
    }>) {
      if (typeof r.type !== "string") continue;
      if (typeof r.timestamp !== "number") continue;
      if (r.timestamp < since || r.timestamp >= now) continue;
      if (!r.type.startsWith("launch:")) continue;
      const ev = r.type.slice("launch:".length);
      byType[ev] = (byType[ev] ?? 0) + 1;
      total += 1;
    }

    return { total, byType, windowStart, windowEnd };
  } catch (err) {
    console.warn("[funnel-kpi] getFunnel24h failed", err);
    return { total: 0, byType: {}, windowStart, windowEnd };
  }
}

export type { LaunchFunnelEvent };
