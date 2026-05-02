/**
 * cost-cap-store.ts
 *   - C-D30-1 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-1 (꼬미 §2 권장 #3 + B-D30-2 + D-D30-1).
 *
 * Why: BYOK 비용 cap 사용자 가시화. schedule-runner.createDefaultCostGuard 의 일일 누적 USD 를
 *   React 훅 형태로 expose. Settings 위젯 (CostCapWidget) + 헤더 배지 (CostCapBadge) 가 구독.
 *
 * 데이터 흐름:
 *   schedule-runner addAccum → Dexie costAccum put + cost-broadcast (C-D30-2) postMessage →
 *   useCostCap 훅이 폴링(15초) + BroadcastChannel 수신 → 즉시 갱신.
 *
 * 자정 리셋 시각:
 *   schedule-runner 는 UTC 자정 (utcDateKey) 으로 자동 리셋. 표시는 KST 시각.
 *   다음 UTC 자정 = 다음 KST 09:00. resetAtKst 는 "오늘/내일 09:00" 형식.
 *
 * 168 HARD GATE: 본 모듈 + widget + badge 모두 lazy chunk (호출자가 dynamic import 권장).
 *
 * OCP: schedule-runner 는 무수정. costAccum 테이블도 무수정. 단순 read-only 구독.
 */

"use client";

import { useEffect, useState } from "react";
import {
  DAILY_BUDGET_USD,
  createDefaultCostGuard,
} from "@/modules/schedules/schedule-runner";

/**
 * 폴링 주기 (ms). BroadcastChannel 미지원 환경 폴백.
 *   다중 탭 race 시 마지막 쓰기 우선 + 본 폴링이 일관성 보장.
 */
export const COST_CAP_POLL_MS = 15_000;

export interface UseCostCapState {
  /** 오늘 누적 USD. 초기 hydrate 전 0. */
  dailyUsd: number;
  /** 일일 한도 USD. DAILY_BUDGET_USD 고정 (Phase 2 사용자 설정). */
  capUsd: number;
  /** 0~100 정수 percent. (dailyUsd / capUsd * 100) clamp. */
  pct: number;
  /** 다음 리셋 시각 KST 표시 ("09:00"). UTC 자정 기준 KST 환산 = 09:00 고정. */
  resetAtKst: string;
  /** hydrate 완료 여부. false 이면 위젯이 placeholder 렌더 가능. */
  hydrated: boolean;
}

/**
 * useCostCap — Settings 위젯 / 헤더 배지 공용 훅.
 *
 * 동작:
 *   1) 마운트 시 createDefaultCostGuard().getDailyAccumUsd() 1회 fetch
 *   2) BroadcastChannel(COST_BROADCAST_CHANNEL) "cost-update" 메시지 수신 → 즉시 갱신
 *   3) 15초 폴링 — 미지원 환경 + race 일관성 보장
 *
 * 엣지 케이스:
 *   - SSR (window undefined) → 초기 상태 (dailyUsd=0, hydrated=false) 그대로
 *   - IndexedDB 차단 → in-memory fallback (createDefaultCostGuard 내부 처리), getDailyAccumUsd 0 반환
 *   - capUsd > dailyUsd 음수 → pct 0 (clamp)
 *   - dailyUsd > capUsd 초과 (override 등) → pct 100 (clamp)
 */
export function useCostCap(): UseCostCapState {
  const [state, setState] = useState<UseCostCapState>({
    dailyUsd: 0,
    capUsd: DAILY_BUDGET_USD,
    pct: 0,
    resetAtKst: "09:00",
    hydrated: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const guard = createDefaultCostGuard(DAILY_BUDGET_USD);
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const usd = await guard.getDailyAccumUsd();
        if (cancelled) return;
        setState({
          dailyUsd: usd,
          capUsd: DAILY_BUDGET_USD,
          pct: clampPct(usd, DAILY_BUDGET_USD),
          resetAtKst: "09:00",
          hydrated: true,
        });
      } catch (err) {
        if (cancelled) return;
        if (typeof console !== "undefined") {
          console.warn("[robusta] cost-cap-store: refresh failed", err);
        }
        setState((prev) => ({ ...prev, hydrated: true }));
      }
    }

    void refresh();

    // C-D30-2 — BroadcastChannel 수신. 미지원 환경은 폴링만 동작.
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      try {
        const { subscribeCostUpdates } = await import("./cost-broadcast");
        if (cancelled) return;
        unsubscribe = subscribeCostUpdates(() => {
          void refresh();
        });
      } catch {
        // dynamic import 실패 — 폴링만 동작.
      }
    })();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, COST_CAP_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return state;
}

/** 0~100 정수 percent clamp. */
export function clampPct(usd: number, cap: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(cap) || cap <= 0) return 0;
  const raw = Math.round((usd / cap) * 100);
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
}

/**
 * pct → tone token. D-D30-1 명세:
 *   < 80%  → "info"    (blue-600)
 *   80~95% → "warning" (amber-600)
 *   > 95%  → "error"   (red-600)
 */
export type CostCapTone = "info" | "warning" | "error";

export function pctToTone(pct: number): CostCapTone {
  if (pct > 95) return "error";
  if (pct >= 80) return "warning";
  return "info";
}

export const __cost_cap_internal = {
  COST_CAP_POLL_MS,
};
