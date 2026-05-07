#!/usr/bin/env node
/**
 * sim-funnel-events-day1.mjs
 *   - C-D58-4 (D-Day 03시 슬롯, 2026-05-08) — Tori spec C-D58-4 (read-only 시뮬).
 *
 * Why: D-Day 첫 24h funnelEvents Dexie 누적 패턴을 read-only 로 시뮬레이션.
 *   - 가정: 5 user / hour × 평균 3 event = 15 row / hour × 24h = 360 rows baseline.
 *   - event_type 4종: byok_register / room_open / persona_call / insight_capture
 *     분포 40 / 30 / 20 / 10 % (합 1.0).
 *   - F-D58-1 자체 선정 winner 의 짝 (실측 vs 시뮬 정합 검증 — 실측 부분은 D+1 슬롯).
 *
 * 함수 시그니처:
 *   simulateDay1FunnelEvents(opts) -> {
 *     totalRows: number,
 *     perHour: number,
 *     hours: number,
 *     distribution: { byok_register: number, room_open: number, persona_call: number, insight_capture: number },
 *     perEventType: { byok_register: number, room_open: number, persona_call: number, insight_capture: number }
 *   }
 *
 * 4 케이스 (4/4 PASS 의무):
 *   1) 기본값          → totalRows=360 / perHour=15
 *   2) usersPerHour=0  → totalRows=0
 *   3) distribution 합 0.95 → throw RangeError
 *   4) eventsPerUser=10 → totalRows=1200 (5 × 10 × 24)
 *
 * Dexie 미접근 — 순수 시뮬만 (read-only 정합, F-D58-1 게이트 짝).
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const DEFAULT_DISTRIBUTION = Object.freeze({
  byok_register: 0.4,
  room_open: 0.3,
  persona_call: 0.2,
  insight_capture: 0.1,
});

const HOURS_DAY1 = 24;
const DISTRIBUTION_SUM_TOLERANCE = 0.01;

/**
 * simulateDay1FunnelEvents — D-Day 첫 24h funnelEvents 누적 시뮬.
 *   순수 함수 (외부 부수효과 0).
 */
export function simulateDay1FunnelEvents(opts = {}) {
  const usersPerHour = opts.usersPerHour ?? 5;
  const eventsPerUser = opts.eventsPerUser ?? 3;
  const distribution = opts.distribution ?? DEFAULT_DISTRIBUTION;
  const hours = opts.hours ?? HOURS_DAY1;

  if (!Number.isFinite(usersPerHour) || usersPerHour < 0) {
    throw new RangeError(`invalid usersPerHour: ${usersPerHour}`);
  }
  if (!Number.isFinite(eventsPerUser) || eventsPerUser < 0) {
    throw new RangeError(`invalid eventsPerUser: ${eventsPerUser}`);
  }
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new RangeError(`invalid hours: ${hours}`);
  }

  const distSum = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (Math.abs(distSum - 1.0) > DISTRIBUTION_SUM_TOLERANCE) {
    throw new RangeError(
      `distribution sum out of tolerance: ${distSum} (expected 1.0 ± ${DISTRIBUTION_SUM_TOLERANCE})`,
    );
  }

  const perHour = usersPerHour * eventsPerUser;
  const totalRows = perHour * hours;

  const perEventType = {};
  for (const [k, v] of Object.entries(distribution)) {
    perEventType[k] = Math.round(totalRows * v);
  }

  return {
    totalRows,
    perHour,
    hours,
    distribution: { ...distribution },
    perEventType,
  };
}

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function main() {
  console.log(
    "sim:funnel-day1 — D-Day 첫 24h funnelEvents 누적 시뮬 4 케이스 (F-D58-1 짝)",
  );

  // 1) 기본값
  {
    const r = simulateDay1FunnelEvents();
    if (
      r.totalRows === 360 &&
      r.perHour === 15 &&
      r.hours === 24 &&
      r.perEventType.byok_register === 144 &&
      r.perEventType.room_open === 108 &&
      r.perEventType.persona_call === 72 &&
      r.perEventType.insight_capture === 36
    ) {
      pass(
        "1. 기본값 → totalRows=360 / perHour=15 / event_type 144·108·72·36",
      );
    } else {
      fail("1. 기본값", `unexpected: ${JSON.stringify(r)}`);
    }
  }

  // 2) usersPerHour=0
  {
    const r = simulateDay1FunnelEvents({ usersPerHour: 0 });
    if (r.totalRows === 0 && r.perHour === 0) {
      pass("2. usersPerHour=0 → totalRows=0");
    } else {
      fail("2. usersPerHour=0", `unexpected: ${JSON.stringify(r)}`);
    }
  }

  // 3) distribution 합 0.95
  {
    let threw = false;
    let msg = "";
    try {
      simulateDay1FunnelEvents({
        distribution: {
          byok_register: 0.4,
          room_open: 0.3,
          persona_call: 0.15,
          insight_capture: 0.1,
        },
      });
    } catch (e) {
      threw = true;
      msg = String(e.message ?? e);
    }
    if (threw && /distribution sum/.test(msg)) {
      pass("3. distribution 합 0.95 → throw RangeError");
    } else {
      fail(
        "3. distribution 합 0.95",
        `expected throw, got threw=${threw} msg='${msg}'`,
      );
    }
  }

  // 4) eventsPerUser=10
  {
    const r = simulateDay1FunnelEvents({ eventsPerUser: 10 });
    if (r.totalRows === 1200 && r.perHour === 50) {
      pass("4. eventsPerUser=10 → totalRows=1200 / perHour=50");
    } else {
      fail("4. eventsPerUser=10", `unexpected: ${JSON.stringify(r)}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("sim:funnel-day1 — FAIL");
  } else {
    console.log("sim:funnel-day1 — 4/4 PASS");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
