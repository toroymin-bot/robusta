#!/usr/bin/env node
/**
 * tests/check-live-plus-96h.test.mjs
 *   - C-D69-1 테스트 (6 케이스, §24.6.1 명세 정합).
 *
 * 6 케이스:
 *   1) T+96h 정확 → inWindow=true, deltaMs=0
 *   2) T+96h - 14m → inWindow=true
 *   3) T+96h + 14m → inWindow=true
 *   4) T+96h - 16m → inWindow=false
 *   5) T+96h + 16m → inWindow=false
 *   6) nowIso < liveStartIso → throw RangeError
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { checkLivePlus96h } from "../scripts/check-live-plus-96h.mjs";

const LIVE_START_ISO = "2026-05-08T02:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function nowIsoAtOffsetMin(deltaMin) {
  const ms = new Date(LIVE_START_ISO).getTime() + 96 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS;
  return new Date(ms).toISOString();
}

let passed = 0;
let failed = 0;

function assertCase(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

console.log("check-live-plus-96h — 6 케이스 테스트");

// case 1: T+96h 정확
assertCase("case1: T+96h 정확 → inWindow=true deltaMs=0", () => {
  const r = checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(0), windowMin: 15 });
  eq(r.inWindow, true, "inWindow");
  eq(r.deltaMs, 0, "deltaMs");
  eq(r.phase, "live", "phase");
});

// case 2: T+96h - 14m → inWindow=true
assertCase("case2: T+96h - 14m → inWindow=true", () => {
  const r = checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(-14), windowMin: 15 });
  eq(r.inWindow, true, "inWindow");
  eq(r.phase, "live", "phase");
});

// case 3: T+96h + 14m → inWindow=true
assertCase("case3: T+96h + 14m → inWindow=true", () => {
  const r = checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(14), windowMin: 15 });
  eq(r.inWindow, true, "inWindow");
  eq(r.phase, "live", "phase");
});

// case 4: T+96h - 16m → inWindow=false
assertCase("case4: T+96h - 16m → inWindow=false", () => {
  const r = checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(-16), windowMin: 15 });
  eq(r.inWindow, false, "inWindow");
  eq(r.phase, "pre-live", "phase");
});

// case 5: T+96h + 16m → inWindow=false
assertCase("case5: T+96h + 16m → inWindow=false", () => {
  const r = checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(16), windowMin: 15 });
  eq(r.inWindow, false, "inWindow");
  eq(r.phase, "post-window", "phase");
});

// case 6: nowIso < liveStartIso → throw RangeError
assertCase("case6: nowIso < liveStartIso → throw RangeError", () => {
  const before = new Date(new Date(LIVE_START_ISO).getTime() - ONE_HOUR_MS).toISOString();
  let threw = null;
  try {
    checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: before, windowMin: 15 });
  } catch (e) {
    threw = e;
  }
  if (!threw) throw new Error("expected throw");
  if (!(threw instanceof RangeError)) {
    throw new Error(`expected RangeError, got ${threw.constructor.name}`);
  }
  if (!/nowIso must be/.test(threw.message)) {
    throw new Error(`expected message contains 'nowIso must be', got '${threw.message}'`);
  }
});

console.log("");
console.log(
  `check-live-plus-96h tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
