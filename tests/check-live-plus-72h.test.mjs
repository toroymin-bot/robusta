#!/usr/bin/env node
/**
 * tests/check-live-plus-72h.test.mjs
 *   - C-D68-1 테스트 (6 케이스, §22.5.1 명세 정합).
 *
 * 6 케이스:
 *   1) within window(72h 정각, windowMin=15) → withinWindow=true, deltaMin=0, reason=within
 *   2) before window(71h 30분, windowMin=15) → withinWindow=false, deltaMin=-30, reason=before
 *   3) after window(72h 30분, windowMin=15)  → withinWindow=false, deltaMin=30,  reason=after
 *   4) env override(LIVE_PLUS_72H_WINDOW_MIN=30) → 72h+25분 → within
 *   5) opts 미지정 + env LIVE_STARTED_AT 폴백 → within
 *   6) opts/env 모두 미지정 → throw('LIVE start unknown')
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { checkLivePlus72h } from "../scripts/check-live-plus-72h.mjs";

const STARTED_KST = "2026-05-08T07:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function nowAtOffsetMin(deltaMin) {
  return new Date(new Date(STARTED_KST).getTime() + 72 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS);
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

console.log("check-live-plus-72h — 6 케이스 테스트");

// case 1: within window (72h 정각)
assertCase("case1: within window(72h 정각) → within deltaMin=0", () => {
  const r = checkLivePlus72h(nowAtOffsetMin(0), { startedAtIso: STARTED_KST });
  eq(r.withinWindow, true, "withinWindow");
  eq(r.deltaMin, 0, "deltaMin");
  eq(r.reason, "within", "reason");
});

// case 2: before window (72h - 30분)
assertCase("case2: before window(71h 30분) → before deltaMin=-30", () => {
  const r = checkLivePlus72h(nowAtOffsetMin(-30), { startedAtIso: STARTED_KST, windowMin: 15 });
  eq(r.withinWindow, false, "withinWindow");
  eq(r.deltaMin, -30, "deltaMin");
  eq(r.reason, "before", "reason");
});

// case 3: after window (72h + 30분)
assertCase("case3: after window(72h 30분) → after deltaMin=30", () => {
  const r = checkLivePlus72h(nowAtOffsetMin(30), { startedAtIso: STARTED_KST, windowMin: 15 });
  eq(r.withinWindow, false, "withinWindow");
  eq(r.deltaMin, 30, "deltaMin");
  eq(r.reason, "after", "reason");
});

// case 4: env override LIVE_PLUS_72H_WINDOW_MIN=30 → 72h+25분 within
assertCase("case4: env override windowMin=30 → 72h+25m within", () => {
  const prev = process.env.LIVE_PLUS_72H_WINDOW_MIN;
  process.env.LIVE_PLUS_72H_WINDOW_MIN = "30";
  try {
    const r = checkLivePlus72h(nowAtOffsetMin(25), { startedAtIso: STARTED_KST });
    eq(r.withinWindow, true, "withinWindow");
    eq(r.deltaMin, 25, "deltaMin");
    eq(r.reason, "within", "reason");
  } finally {
    if (prev === undefined) delete process.env.LIVE_PLUS_72H_WINDOW_MIN;
    else process.env.LIVE_PLUS_72H_WINDOW_MIN = prev;
  }
});

// case 5: opts 미지정 + env LIVE_STARTED_AT 폴백
assertCase("case5: env LIVE_STARTED_AT 폴백 → within", () => {
  const prevStart = process.env.LIVE_STARTED_AT;
  process.env.LIVE_STARTED_AT = STARTED_KST;
  try {
    const r = checkLivePlus72h(nowAtOffsetMin(0));
    eq(r.withinWindow, true, "withinWindow");
    eq(r.deltaMin, 0, "deltaMin");
  } finally {
    if (prevStart === undefined) delete process.env.LIVE_STARTED_AT;
    else process.env.LIVE_STARTED_AT = prevStart;
  }
});

// case 6: opts/env 모두 미지정 → throw
assertCase("case6: opts/env 모두 미지정 → throw('LIVE start unknown')", () => {
  const prevStart = process.env.LIVE_STARTED_AT;
  delete process.env.LIVE_STARTED_AT;
  let threw = null;
  try {
    checkLivePlus72h(new Date());
  } catch (e) {
    threw = e;
  } finally {
    if (prevStart !== undefined) process.env.LIVE_STARTED_AT = prevStart;
  }
  if (!threw) throw new Error("expected throw");
  if (!/LIVE start unknown/.test(threw.message)) {
    throw new Error(`expected message 'LIVE start unknown', got '${threw.message}'`);
  }
});

console.log("");
console.log(
  `check-live-plus-72h tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
