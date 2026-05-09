#!/usr/bin/env node
/**
 * tests/check-live-plus-48h.test.mjs
 *   - C-D66-1 테스트 (6 케이스, 명세 정합).
 *
 * 6 케이스:
 *   1) exact +48h            → ok=true,  deltaMin=0
 *   2) +48h-15m              → ok=true,  deltaMin=-15
 *   3) +48h+15m              → ok=true,  deltaMin=15
 *   4) +48h-16m              → ok=false
 *   5) +48h+16m              → ok=false
 *   6) freeze=true at +48h   → ok=false, reason='freeze'
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import checkLivePlus48h from "../scripts/check-live-plus-48h.mjs";

const SUBMIT_KST = "2026-05-07T22:00:00+09:00";
const TARGET_KST = "2026-05-09T22:00:00+09:00"; // submit + 48h

function offsetIsoMin(submitKst, deltaMin) {
  const ms = new Date(submitKst).getTime() + 48 * 60 * 60 * 1000 + deltaMin * 60 * 1000;
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yr}-${mo}-${da}T${hh}:${mm}:${ss}+09:00`;
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

console.log("check-live-plus-48h — 6 케이스 테스트");

// case 1: exact +48h → ok=true, deltaMin=0
assertCase("case1: exact +48h ok=true deltaMin=0", () => {
  const r = checkLivePlus48h({ submitKst: SUBMIT_KST, nowKst: TARGET_KST });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, 0, "deltaMin");
});

// case 2: +48h-15m → ok=true, deltaMin=-15
assertCase("case2: +48h-15m ok=true deltaMin=-15", () => {
  const r = checkLivePlus48h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, -15),
  });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, -15, "deltaMin");
});

// case 3: +48h+15m → ok=true, deltaMin=15
assertCase("case3: +48h+15m ok=true deltaMin=15", () => {
  const r = checkLivePlus48h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, 15),
  });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, 15, "deltaMin");
});

// case 4: +48h-16m → ok=false
assertCase("case4: +48h-16m ok=false", () => {
  const r = checkLivePlus48h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, -16),
  });
  eq(r.ok, false, "ok");
});

// case 5: +48h+16m → ok=false
assertCase("case5: +48h+16m ok=false", () => {
  const r = checkLivePlus48h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, 16),
  });
  eq(r.ok, false, "ok");
});

// case 6: freeze=true at exact +48h → ok=false, reason='freeze'
assertCase("case6: freeze=true at exact +48h ok=false reason=freeze", () => {
  const r = checkLivePlus48h({
    submitKst: SUBMIT_KST,
    nowKst: TARGET_KST,
    freeze: true,
  });
  eq(r.ok, false, "ok");
  eq(r.reason, "freeze", "reason");
});

console.log("");
console.log(
  `check-live-plus-48h tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
