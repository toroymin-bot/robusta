/**
 * schedule-runner.ts
 *   - C-D28-3 (D6 23시 슬롯, 2026-05-02) — Tori spec C-D28-3 (B-D28-4/B-D28-5).
 *   - C-D29-1 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-1 (KQ_22 (2) BYOK 비용 cap wiring).
 *     · 4중 가드 (3) "비용 cap" 활성. 일일 $1 (DAILY_BUDGET_USD) 기본.
 *     · MODEL_COST_USD 메시지당 단가 추정 테이블 (Tori 추정 — Roy 검수 시 정정 가능).
 *     · CostGuard 인터페이스 — opts 주입 (DI). 미주입 시 default Dexie costAccum 어댑터.
 *
 * Why: 다중 발화자 자율 트리거의 본체 — 5분 polling 으로 enabled 스케줄 평가.
 *   Spec 004 본체에서 cron 매칭 + fire 콜백 wiring 됨. 본 슬롯은 runner 골격만.
 *   lazy import 권장 (메인 번들 진입 회피 — 168 HARD GATE 보호).
 *
 * 4중 가드 (B-D28-5 (d) 흡수):
 *   1) 일일 cap 200 + 시간당 30 (DAILY_CAP / HOURLY_CAP)
 *   2) loop 감지 — 동일 schedule id 5분 내 재 fire 차단
 *   3) 비용 cap — C-D29-1 활성. 일일 누적 USD + estimateUsdForFire 합이 DAILY_BUDGET_USD 초과 시 skip.
 *   4) stop 버튼 — startScheduleRunner 가 cleanup 함수 반환 → 즉시 정지
 *
 * 가시성 가드:
 *   - document.visibilityState === 'hidden' → tick skip + 다음 foreground tick 에 catch-up 1회.
 *
 * cron 매칭:
 *   - Spec 004 본체에서 cron-parser 등 검토. 본 슬롯은 every-N-minutes 단순 매칭만 wiring.
 *   - cron 문자열은 ScheduleRow.cron 그대로 보존 — invalid 시 caller(store) 가 add 거부.
 *
 * OCP: 외부 의존 0 — db.ts 의 ScheduleRow 타입 + costAccum 테이블만. zustand 미사용 (순수 함수 + closure).
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

/**
 * C-D29-1 — 4중 가드 (3) 비용 cap. 일일 USD 누적 한도.
 *   Tori 추정 (KQ_22 (2) (b)): Sonnet 메시지당 ≈$0.003 × 200건 = $0.6, 안전 마진 67%.
 *   Roy 검수 시 정정 가능 (단순 상수 변경).
 */
export const DAILY_BUDGET_USD = 1.0;

/**
 * C-D29-1 — 메시지당 단가 추정 테이블 (USD per message, 1k token in + 500 token out 추정).
 *   Tori 추정 — 모델 단가는 외부 시스템 값이라 Roy 검수 시 정정 가능.
 *   미정의 모델은 평균 단가 fallback (DEFAULT_PER_MESSAGE_USD).
 */
export const MODEL_COST_USD: Record<string, number> = {
  "claude-sonnet-4-6": 0.003,
  "claude-opus-4-6": 0.075,
  "claude-haiku-4-5-20251001": 0.001,
  "gpt-4o": 0.005,
  "gpt-4o-mini": 0.001,
  "gemini-1.5-pro": 0.004,
  "grok-2": 0.005,
  "deepseek-chat": 0.001,
};

/** 미정의 모델 fallback 단가 — 안전한 평균값. */
export const DEFAULT_PER_MESSAGE_USD = 0.005;

/**
 * C-D29-1 — 비용 가드 인터페이스 (DI).
 *   getDailyAccumUsd: 오늘(UTC) 누적 USD 반환. 미존재 시 0.
 *   addAccum: 누적에 usd 가산. 다중 탭 race 안전 (트랜잭션).
 *   estimateUsdForFire: 스케줄 1회 fire 시 발생 추정 USD.
 *   dailyBudgetUsd: 일일 한도. 기본 DAILY_BUDGET_USD.
 */
export interface CostGuard {
  dailyBudgetUsd: number;
  estimateUsdForFire: (s: ScheduleRow) => number;
  getDailyAccumUsd: () => Promise<number>;
  addAccum: (usd: number) => Promise<void>;
}

/** UTC 기준 "YYYY-MM-DD" 키. 자정 경계는 키 변경으로 자동 리셋. */
function utcDateKey(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * C-D29-1 — fire 발생 추정 USD 계산.
 *   ScheduleRow.target_persona 가 모델 id (또는 페르소나 id) 일 수 있어
 *   MODEL_COST_USD 직접 lookup. 미정의 시 DEFAULT_PER_MESSAGE_USD + console.warn.
 *   Spec 004 본체에서 ScheduleRow에 modelId 필드 도입 시 명세 수정 예정.
 */
export function estimateUsdForFire(s: ScheduleRow): number {
  const key = s.target_persona;
  const cost = MODEL_COST_USD[key];
  if (typeof cost === "number") return cost;
  if (typeof console !== "undefined") {
    console.warn(
      "[robusta] schedule-runner: unknown model cost",
      key,
      "→ DEFAULT_PER_MESSAGE_USD",
    );
  }
  return DEFAULT_PER_MESSAGE_USD;
}

/**
 * C-D29-1 — Dexie costAccum 어댑터 default 생성.
 *   IndexedDB 차단 / SSR 시 in-memory fallback (탭 종료 시 소실 — 안전 측 cap 발생, OK).
 *   호출자: startScheduleRunner default opts.costGuard.
 */
export function createDefaultCostGuard(
  dailyBudgetUsd: number = DAILY_BUDGET_USD,
): CostGuard {
  let memoryAccum: { date: string; usd: number } | null = null;

  async function getDailyAccumUsd(): Promise<number> {
    const today = utcDateKey(Date.now());
    if (typeof window === "undefined") {
      // SSR — in-memory only.
      return memoryAccum && memoryAccum.date === today ? memoryAccum.usd : 0;
    }
    try {
      const { getDb } = await import("@/modules/storage/db");
      const db = getDb();
      const row = await db.costAccum.get(today);
      return typeof row?.usd === "number" ? row.usd : 0;
    } catch {
      // IndexedDB 차단 — in-memory fallback.
      return memoryAccum && memoryAccum.date === today ? memoryAccum.usd : 0;
    }
  }

  async function addAccum(usd: number): Promise<void> {
    const today = utcDateKey(Date.now());
    if (typeof window === "undefined") {
      memoryAccum = {
        date: today,
        usd: (memoryAccum?.date === today ? memoryAccum.usd : 0) + usd,
      };
      return;
    }
    try {
      const { getDb } = await import("@/modules/storage/db");
      const db = getDb();
      await db.transaction("rw", db.costAccum, async () => {
        const row = await db.costAccum.get(today);
        const next = (typeof row?.usd === "number" ? row.usd : 0) + usd;
        await db.costAccum.put({
          date: today,
          usd: next,
          updatedAt: Date.now(),
        });
      });
    } catch (err) {
      // IndexedDB 차단 — in-memory fallback.
      memoryAccum = {
        date: today,
        usd: (memoryAccum?.date === today ? memoryAccum.usd : 0) + usd,
      };
      if (typeof console !== "undefined") {
        console.warn("[robusta] schedule-runner: costAccum persist skipped", err);
      }
    }
  }

  return {
    dailyBudgetUsd,
    estimateUsdForFire,
    getDailyAccumUsd,
    addAccum,
  };
}

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
  /**
   * C-D29-1 — 4중 가드 (3) 비용 가드. 미주입 시 createDefaultCostGuard() 사용.
   *   skip 시 onBudgetSkip 호출 (Toast warning 등 — D-D29-5 매핑).
   */
  costGuard?: CostGuard;
  /**
   * C-D29-1 — 비용 cap 으로 skip 시 호출. 호출자는 Toast warning + last_status="skip:budget" wiring.
   *   미주입 시 console.info 만.
   */
  onBudgetSkip?: (s: ScheduleRow, accum: number, estimate: number) => void;
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
  // C-D29-1 — 4중 가드 (3) 비용 가드. 미주입 시 default Dexie costAccum 어댑터.
  const costGuard = opts.costGuard ?? createDefaultCostGuard();

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

  async function tick(): Promise<void> {
    if (visibility() === "hidden") return; // 백그라운드 → skip
    const t = now();
    const dk = dayKey(t);
    const hk = hourKey(t);
    const dailyTotal = dailyCounts.get(dk) ?? 0;
    const hourlyTotal = hourlyCounts.get(hk) ?? 0;
    if (dailyTotal >= DAILY_CAP) return; // 4중 가드 (1)
    if (hourlyTotal >= HOURLY_CAP) return; // 4중 가드 (1)

    // C-D29-1 — 4중 가드 (3) 비용 가드: tick 시작 시 1회 read.
    //   본 tick 내 fire 가산은 메모리 추적 + Dexie 영속 (addAccum).
    const accumStart = await costGuard.getDailyAccumUsd();
    let accumTick = accumStart;

    const rows = opts.getEnabled().filter((r) => r.enabled);
    for (const r of rows) {
      const last = lastFireAt.get(r.id);
      if (typeof last === "number" && t - last < LOOP_GUARD_MS) {
        continue; // 4중 가드 (2) — loop 감지
      }
      if (!matchCron(r.cron, t, r.last_run)) continue;
      // C-D29-1 — 4중 가드 (3) 비용 cap: estimate + accum 합이 budget 초과 → skip.
      const estimate = costGuard.estimateUsdForFire(r);
      if (accumTick + estimate > costGuard.dailyBudgetUsd) {
        if (opts.onBudgetSkip) {
          opts.onBudgetSkip(r, accumTick, estimate);
        } else if (typeof console !== "undefined") {
          console.info(
            "[robusta] schedule-runner: skip (budget cap)",
            r.id,
            { accum: accumTick, estimate, budget: costGuard.dailyBudgetUsd },
          );
        }
        continue;
      }
      // fire — 비동기. 실패는 caller 책임 (try/catch 내부).
      lastFireAt.set(r.id, t);
      dailyCounts.set(dk, (dailyCounts.get(dk) ?? 0) + 1);
      hourlyCounts.set(hk, (hourlyCounts.get(hk) ?? 0) + 1);
      // C-D29-1 — 가산 (memory + Dexie). 영속 실패는 silent (in-memory fallback).
      accumTick += estimate;
      void costGuard.addAccum(estimate).catch((err) => {
        if (typeof console !== "undefined") {
          console.warn("[robusta] schedule-runner: addAccum failed", err);
        }
      });
      void opts.fire(r).catch((err) => {
        console.warn("[robusta] schedule fire failed", r.id, err);
      });
      // cap 재평가 — 본 tick 안에 cap 도달하면 후속 row skip.
      if ((dailyCounts.get(dk) ?? 0) >= DAILY_CAP) return;
      if ((hourlyCounts.get(hk) ?? 0) >= HOURLY_CAP) return;
    }
  }

  // setInterval — 즉시 1회 실행 X (브라우저 부담 회피, 다음 tick 부터).
  //   C-D29-1: tick 이 async (비용 가드 read 위해). setInterval 콜백은 void wrap.
  const intervalId =
    typeof window === "undefined"
      ? null
      : window.setInterval(() => {
          void tick();
        }, tickMs);

  // visibilitychange — foreground 복귀 시 catch-up 1회.
  function onVisibilityChange(): void {
    if (visibility() === "visible") {
      void tick();
    }
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
