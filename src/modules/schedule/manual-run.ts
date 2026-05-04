"use client";

/**
 * manual-run.ts
 *   - C-D39-1 (D-4 23시 슬롯, 2026-05-04) — Tori spec C-D39-1 (V-D39-1 (c) + D-D39-2 (b)).
 *
 * Why: schedule rule 의 "지금" / "5분 후" 수동 발동 헬퍼. cron 자동 트리거와 병행.
 *   - schedule-runner 의 polling fire 는 무수정 (보존) — 본 헬퍼는 funnel 로깅 + dedup 만.
 *   - D-Day 5/8 안전성 우선: 실 AI 호출 wiring 은 D+1 후속 안건 (V-D39-1 운영 가시화 단계).
 *
 * 자율 정정 (D-39-자-1, 2): 명세 `scheduleRun({scheduleId, source})` 직접 호출 → 본 모듈 신규 export `manualFire`.
 *   schedule-runner 의 fire 콜백은 internal cron 폴링 전용 — manual run 은 별도 채널로 분리하여
 *   4중 가드(loop/cap/budget/stop)와 충돌 회피.
 *
 * 자율 정정 (D-39-자-3): 명세 `db.byokKey.get` → 실제 SoT `useApiKeyStore.getState().keys.anthropic`.
 *
 * dedup: 동일 ruleId 1초 내 중복 호출 silent skip (cron 자동 트리거와 충돌 회피).
 */

import { logFunnelEvent } from "@/modules/funnel/funnel-events";
import { useApiKeyStore } from "@/stores/api-key-store";

/** 마지막 fire 시점 — ruleId → ms. cron 자동/수동 양쪽 dedup 통합. */
const lastFireAt = new Map<string, number>();

/** 1초 dedup 윈도우 — cron 폴링과 manual run 중복 제거. */
const DEDUP_MS = 1_000;

/** manual run source 식별 — funnel byType 분석 정합. */
export type ManualRunSource = "manual_now" | "manual_5min";

export interface ManualFireResult {
  ok: boolean;
  reason?: "no-byok-key" | "dedup-skip";
}

/**
 * manualFire — schedule rule 1회 수동 발동.
 *   1) BYOK 키 없으면 즉시 reject (UI는 toast / disabled 표시 책임)
 *   2) 1초 dedup — 같은 ruleId 가 1초 내 재호출되면 silent skip (cron 폴링과 충돌 회피)
 *   3) funnel 'schedule_fired' 1건 로깅 (source 포함)
 *   4) 실 AI 호출 wiring 은 후속 (D+1) — 본 헬퍼는 가시화 + 영속 추적만 담당
 *
 *   엣지:
 *     - SSR/build 안전: typeof window === 'undefined' → 즉시 noop ok:true (호출자 가드 불요)
 *     - 키 검증은 existence 만 (실제 ping 은 schedule-runner 4중 가드에서 담당)
 */
export function manualFire(
  ruleId: string,
  source: ManualRunSource,
): ManualFireResult {
  if (typeof window === "undefined") return { ok: true };

  // (1) BYOK 키 검증.
  const key = useApiKeyStore.getState().keys.anthropic;
  if (!key || key.trim().length === 0) {
    return { ok: false, reason: "no-byok-key" };
  }

  // (2) 1초 dedup.
  const now = Date.now();
  const last = lastFireAt.get(ruleId) ?? 0;
  if (now - last < DEDUP_MS) {
    return { ok: false, reason: "dedup-skip" };
  }
  lastFireAt.set(ruleId, now);

  // (3) funnel 로깅.
  logFunnelEvent({
    type: "schedule_fired",
    scheduleId: ruleId,
    source,
    timestamp: now,
  });

  return { ok: true };
}

/**
 * scheduleManualFire5min — setTimeout 큐. 호출자가 cleanup id 보존 후 unmount 시 clearTimeout.
 *   페이지 unmount 시 손실은 의도 (BYOK 안정성 — 닫힌 탭에서 fire 금지).
 */
export function scheduleManualFire5min(
  ruleId: string,
  onFire: (result: ManualFireResult) => void,
): { cancel: () => void } {
  if (typeof window === "undefined") return { cancel: () => {} };

  const handle = window.setTimeout(() => {
    onFire(manualFire(ruleId, "manual_5min"));
  }, 5 * 60 * 1000);

  return {
    cancel: () => window.clearTimeout(handle),
  };
}

/** test 전용 — dedup Map 초기화. production 호출 금지. */
export function __resetManualFireDedupForTest(): void {
  lastFireAt.clear();
}
