/**
 * schedule-runner.ts
 *   - C-D28-3 (D6 23시 슬롯, 2026-05-02) — Tori spec C-D28-3 (B-D28-4/B-D28-5).
 *
 * Why: 다중 발화자 자율 트리거의 본체 — 5분 polling 으로 enabled 스케줄 평가.
 *   Spec 004 본체에서 cron 매칭 + fire 콜백 wiring 됨. 본 슬롯은 runner 골격만.
 *   lazy import 권장 (메인 번들 진입 회피 — 168 HARD GATE 보호).
 *
 * 4중 가드 (B-D28-5 (d) 흡수):
 *   1) 일일 cap 200 + 시간당 30 (DAILY_CAP / HOURLY_CAP)
 *   2) loop 감지 — 동일 schedule id 5분 내 재 fire 차단
 *   3) 비용 cap — 본 슬롯에서는 일일 fire 횟수 cap 만 (실 비용은 KQ_22 결정 후 wiring)
 *   4) stop 버튼 — startScheduleRunner 가 cleanup 함수 반환 → 즉시 정지
 *
 * 가시성 가드:
 *   - document.visibilityState === 'hidden' → tick skip + 다음 foreground tick 에 catch-up 1회.
 *
 * cron 매칭:
 *   - Spec 004 본체에서 cron-parser 등 검토. 본 슬롯은 every-N-minutes 단순 매칭만 wiring.
 *   - cron 문자열은 ScheduleRow.cron 그대로 보존 — invalid 시 caller(store) 가 add 거부.
 *
 * OCP: 외부 의존 0 — db.ts 의 ScheduleRow 타입만. zustand 미사용 (순수 함수 + closure).
 */

"use client";

import type { ScheduleRow } from "@/modules/storage/db";

/** 5분 polling 간격 (ms). 테스트에서는 opts.tickMs 로 override. */
export const DEFAULT_TICK_MS = 5 * 60 * 1000;

/** 4중 가드 — 일일 fire cap (B-D28-5 흡수). KQ_22 비용 cap 와 별개. */
export const DAILY_CAP = 200;

/** 4중 가드 — 시간당 fire cap. */
export const HOURLY_CAP = 30;

/** 4중 가드 — loop 감지: 동일 schedule id 가 본 ms 이내 재 fire 시 차단. */
export const LOOP_GUARD_MS = 5 * 60 * 1000;

export interface ScheduleRunnerOptions {
  /** polling 간격 (ms). 기본 DEFAULT_TICK_MS. 테스트 override 용. */
  tickMs?: number;
  /** enabled 스케줄 row 배열 returner — 매 tick 마다 호출. */
  getEnabled: () => ScheduleRow[];
  /** cron 매칭 시 호출 — Spec 004 본체에서 LLM call 등 wiring. */
  fire: (s: ScheduleRow) => Promise<void>;
  /** now 주입 — 테스트에서 deterministic 시각 제공. 기본 () => Date.now(). */
  now?: () => number;
  /** visibility 주입 — 테스트에서 'hidden'/'visible' 강제. 기본 document.visibilityState. */
  visibility?: () => "visible" | "hidden";
  /** cron 매칭 함수 주입 — 기본 매분 0초 단순 매칭. Spec 004 본체에서 cron-parser 로 교체. */
  matchCron?: (cron: string, now: number, lastRun: number | null) => boolean;
}

/**
 * 단순 cron 매칭 — Spec 004 본체에서 cron-parser 로 교체 예정.
 *   - "*\/5 * * * *" 형식만 인식 — 5분 단위 every-N-minutes 패턴.
 *   - lastRun 이 null 이거나 (now - lastRun) >= n*60_000 이면 fire.
 *   - 형식 외 cron 은 false (Spec 004 본체에서 확장).
 */
export function defaultMatchCron(
  cron: string,
  now: number,
  lastRun: number | null,
): boolean {
  const m = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/.exec(cron.trim());
  if (!m) return false;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (lastRun === null) return true;
  return now - lastRun >= n * 60_000;
}

/**
 * startScheduleRunner — 5분 polling worker 시작.
 *   반환: cleanup 함수 (stop 버튼). 호출 시 setInterval clear + listener detach.
 *
 *   엣지 케이스:
 *   - tab 백그라운드 → tick skip. foreground 복귀 시 catch-up 1회 (visibilitychange listener).
 *   - 시계 변경 → 다음 tick 정상 동작 (loop 가드는 5분 ms 절대값 비교).
 *   - cron 매칭 0건 → no-op.
 *   - 동일 id 5분 내 2회 → 1회만 fire.
 *   - 일일/시간당 cap 초과 → tick 차단.
 */
export function startScheduleRunner(
  opts: ScheduleRunnerOptions,
): () => void {
  const tickMs = opts.tickMs ?? DEFAULT_TICK_MS;
  const now = opts.now ?? (() => Date.now());
  const visibility =
    opts.visibility ??
    (() =>
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
        ? "hidden"
        : "visible");
  const matchCron = opts.matchCron ?? defaultMatchCron;

  // 가드 상태 (closure).
  const lastFireAt = new Map<string, number>(); // id → last fire ms (loop 가드)
  const dailyCounts = new Map<string, number>(); // YYYY-MM-DD → count
  const hourlyCounts = new Map<string, number>(); // YYYY-MM-DDTHH → count

  function dayKey(t: number): string {
    const d = new Date(t);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function hourKey(t: number): string {
    return `${dayKey(t)}T${String(new Date(t).getUTCHours()).padStart(2, "0")}`;
  }

  function tick(): void {
    if (visibility() === "hidden") return; // 백그라운드 → skip
    const t = now();
    const dk = dayKey(t);
    const hk = hourKey(t);
    const dailyTotal = dailyCounts.get(dk) ?? 0;
    const hourlyTotal = hourlyCounts.get(hk) ?? 0;
    if (dailyTotal >= DAILY_CAP) return; // 4중 가드 (1)
    if (hourlyTotal >= HOURLY_CAP) return; // 4중 가드 (1)

    const rows = opts.getEnabled().filter((r) => r.enabled);
    for (const r of rows) {
      const last = lastFireAt.get(r.id);
      if (typeof last === "number" && t - last < LOOP_GUARD_MS) {
        continue; // 4중 가드 (2) — loop 감지
      }
      if (!matchCron(r.cron, t, r.last_run)) continue;
      // fire — 비동기. 실패는 caller 책임 (try/catch 내부).
      lastFireAt.set(r.id, t);
      dailyCounts.set(dk, (dailyCounts.get(dk) ?? 0) + 1);
      hourlyCounts.set(hk, (hourlyCounts.get(hk) ?? 0) + 1);
      void opts.fire(r).catch((err) => {
        console.warn("[robusta] schedule fire failed", r.id, err);
      });
      // cap 재평가 — 본 tick 안에 cap 도달하면 후속 row skip.
      if ((dailyCounts.get(dk) ?? 0) >= DAILY_CAP) return;
      if ((hourlyCounts.get(hk) ?? 0) >= HOURLY_CAP) return;
    }
  }

  // setInterval — 즉시 1회 실행 X (브라우저 부담 회피, 다음 tick 부터).
  const intervalId =
    typeof window === "undefined"
      ? null
      : window.setInterval(tick, tickMs);

  // visibilitychange — foreground 복귀 시 catch-up 1회.
  function onVisibilityChange(): void {
    if (visibility() === "visible") tick();
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  // cleanup — 4중 가드 (4): stop 버튼이 호출.
  return () => {
    if (intervalId !== null && typeof window !== "undefined") {
      window.clearInterval(intervalId);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    lastFireAt.clear();
    dailyCounts.clear();
    hourlyCounts.clear();
  };
}
