#!/usr/bin/env node
/**
 * tests/check-live-plus-192h.test.mjs
 *   - C-D73-1 테스트 6 케이스 (§8.5 명세 정합).
 *
 * 6 케이스 (똘이 §8.5 명시):
 *   1) T+192h 정확 → ok=true, inWindow=true
 *   2) T+191h (lower window) → ok=true
 *   3) T+193h (upper window) → ok=true
 *   4) T+190h59m → ok=false reasons=['out of window']
 *   5) T+193h01m → ok=false reasons=['out of window']
 *   6) 파일 부재 → ok=true (inWindow=true 보존), reasons에 skip 사유
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { checkLivePlus192h } from "../scripts/check-live-plus-192h.mjs";

const LIVE_START_ISO = "2026-05-08T00:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const NON_EXISTENT_PINGS = "data/analytics/__nonexistent_d73_test.jsonl";

function nowIsoAtOffsetMin(deltaMin) {
  const ms = new Date(LIVE_START_ISO).getTime() + 192 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS;
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

console.log("check-live-plus-192h — 6 케이스 테스트");

// case 1: T+192h 정각 → ok=true, inWindow=true
assertCase("case1: T+192h 정각 → ok=true inWindow=true", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(0),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, true, "ok");
  eq(r.inWindow, true, "inWindow");
});

// case 2: T+191h (lower) → ok=true
assertCase("case2: T+191h (lower) → ok=true", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(-60),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, true, "ok");
});

// case 3: T+193h (upper) → ok=true
assertCase("case3: T+193h (upper) → ok=true", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(60),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, true, "ok");
});

// case 4: T+190h59m → ok=false reasons=['out of window']
assertCase("case4: T+190h59m → ok=false reasons['out of window']", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(-61),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, false, "ok");
  if (!r.reasons.includes("out of window")) {
    throw new Error(`reasons missing 'out of window': ${JSON.stringify(r.reasons)}`);
  }
});

// case 5: T+193h01m → ok=false reasons=['out of window']
assertCase("case5: T+193h01m → ok=false reasons['out of window']", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(61),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, false, "ok");
  if (!r.reasons.includes("out of window")) {
    throw new Error(`reasons missing 'out of window': ${JSON.stringify(r.reasons)}`);
  }
});

// case 6: 파일 부재 → ok=true (inWindow 보존), reasons에 skip 사유
assertCase("case6: pings 파일 부재 → reasons에 skip 사유 포함", () => {
  const r = checkLivePlus192h({
    liveStartIso: LIVE_START_ISO,
    nowIso: nowIsoAtOffsetMin(0),
    windowMin: 60,
    pingsPath: NON_EXISTENT_PINGS,
  });
  eq(r.ok, true, "ok");
  eq(r.pingsTotal, 0, "pingsTotal");
  if (!r.reasons.some((x) => /pings 파일 부재/.test(x))) {
    throw new Error(`reasons missing skip: ${JSON.stringify(r.reasons)}`);
  }
});

console.log("");
console.log(
  `check-live-plus-192h tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
