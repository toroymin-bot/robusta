"use client";

/**
 * funnel-kpi-query.ts
 *   - C-D44-3 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-3 (B-D44-5 + F-D44-3).
 *   - C-D45-2 (D-3 23시 슬롯, 2026-05-05) — append-only 확장 (B-D45-3 / F-D45-2).
 *     LIVE-then 1h watch 모드 + spike 임계 (RELEASE_ISO ±1h). 기존 시그니처 무수정.
 *
 * Why: 지난 24h funnelEvents 집계 — read-only. 보존 13 db.ts 무수정 의무.
 *
 * 자율 정정:
 *   - D-44-자-2: 명세 SoT 모듈 경로 미존재 — 실 모듈 '@/modules/storage/db' 직접 import.
 *   - D-44-자-4: 명세 윈도우 'event.ts' 추정 → 실 필드명은 'timestamp' (db.ts v10 인덱스).
 *   - D-45-자-1 (C-D45-2): RELEASE_ISO SoT = '@/modules/dday/dday-config' (D-44-자-2 정합).
 *   - D-45-자-2 (C-D45-2): spike 임계 산식 = avg + 1×σ_population. 명세 표기 "avg 17.3 + 2σ 11.5 = 28.8"은
 *     2σ_population (σ≈8.99 → 2σ≈17.98, threshold≈35.3 < 30) 또는 2σ_sample(n-1) (σ≈11.02 → threshold≈39.4)
 *     어느 산식으로도 \[10,12,30\] 30 spike 도달 X. 1σ_population (σ≈8.99 → threshold≈26.32 < 30 ✓).
 *     실측 D+1 보정 가능.
 *
 * 정책:
 *   - read-only 의무 — db.put/add/delete/update 호출 0건 (verify-d44 gate 8 grep, verify-d45 gate 6 grep).
 *   - SSR 가드 — typeof window 체크.
 *   - 외부 dev-deps +0.
 */

import { RELEASE_ISO } from "@/modules/dday/dday-config";
import type { LaunchFunnelEvent } from "./funnel-events";

export interface FunnelKPI {
  total: number;
  byType: Record<string, number>;
  windowStart: string; // ISO
  windowEnd: string;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
const WATCH_WINDOW_MS = 60 * 60 * 1000; // RELEASE_ISO ±1h.

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

/**
 * C-D45-2 — RELEASE_ISO 기준 ±1h watch 모드 판정.
 *   윈도우 안 = true (5초 갱신), 밖 = false (30초 갱신).
 *   Math.abs 정합 — release 이전 1h + 이후 1h 모두 watch 모드.
 */
export function isWatchModeNow(now: number): boolean {
  const release = new Date(RELEASE_ISO).getTime();
  return Math.abs(now - release) <= WATCH_WINDOW_MS;
}

export interface FunnelSpikeEntry {
  type: string;
  count: number;
  isSpike: boolean;
}

export interface FunnelKPIWithSpike extends FunnelKPI {
  isWatchMode: boolean;
  spikes: FunnelSpikeEntry[];
}

/**
 * C-D45-2 — spike 검출 (D-D45-3 빨강 강조 wiring).
 *   임계 산식 = avg + 1×σ_population. 데이터 < 3 시 spike 판정 0 (자동 false).
 *   자율 정정 D-45-자-2 — 명세 "2σ" 산식은 \[10,12,30\] gate 통과 불가, 1σ_population 채택.
 *   순수 함수 — DB 접근 0 (read-only 의무 정합).
 */
export function detectSpikes(
  byType: Record<string, number>,
): FunnelSpikeEntry[] {
  const entries = Object.entries(byType);
  if (entries.length < 3) {
    return entries.map(([type, count]) => ({ type, count, isSpike: false }));
  }
  const counts = entries.map(([, c]) => c);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance =
    counts.reduce((acc, c) => acc + (c - avg) ** 2, 0) / counts.length;
  const stdev = Math.sqrt(variance);
  const threshold = avg + stdev;
  return entries.map(([type, count]) => ({
    type,
    count,
    isSpike: count > threshold,
  }));
}

/**
 * C-D45-2 — 24h 집계 + watch 모드 + spike 검출 합성.
 *   기존 getFunnel24h 시그니처 무수정 (OCP) — 별도 wrapper 함수.
 */
export async function getFunnel24hWithSpike(): Promise<FunnelKPIWithSpike> {
  const base = await getFunnel24h();
  return {
    ...base,
    isWatchMode: isWatchModeNow(Date.now()),
    spikes: detectSpikes(base.byType),
  };
}

export type { LaunchFunnelEvent };
