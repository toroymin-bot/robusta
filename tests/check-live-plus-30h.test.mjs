#!/usr/bin/env node
/**
 * tests/check-live-plus-30h.test.mjs
 *   - C-D65-1 테스트 (6 케이스, 명세 정합).
 *
 * 6 케이스:
 *   1) exact +30h            → ok=true,  deltaMin=0
 *   2) +30h-15m              → ok=true,  deltaMin=-15
 *   3) +30h+15m              → ok=true,  deltaMin=15
 *   4) +30h-16m              → ok=false
 *   5) +30h+16m              → ok=false
 *   6) freeze=true at +30h   → ok=false, reason='freeze'
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import checkLivePlus30h from "../scripts/check-live-plus-30h.mjs";

const SUBMIT_KST = "2026-05-08T07:00:00+09:00";
const TARGET_KST = "2026-05-09T13:00:00+09:00"; // submit + 30h

function offsetIsoMin(submitKst, deltaMin) {
  const ms = new Date(submitKst).getTime() + 30 * 60 * 60 * 1000 + deltaMin * 60 * 1000;
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

console.log("check-live-plus-30h — 6 케이스 테스트");

// case 1: exact +30h → ok=true, deltaMin=0
assertCase("case1: exact +30h ok=true deltaMin=0", () => {
  const r = checkLivePlus30h({ submitKst: SUBMIT_KST, nowKst: TARGET_KST });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, 0, "deltaMin");
});

// case 2: +30h-15m → ok=true, deltaMin=-15
assertCase("case2: +30h-15m ok=true deltaMin=-15", () => {
  const r = checkLivePlus30h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, -15),
  });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, -15, "deltaMin");
});

// case 3: +30h+15m → ok=true, deltaMin=15
assertCase("case3: +30h+15m ok=true deltaMin=15", () => {
  const r = checkLivePlus30h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, 15),
  });
  eq(r.ok, true, "ok");
  eq(r.deltaMin, 15, "deltaMin");
});

// case 4: +30h-16m → ok=false
assertCase("case4: +30h-16m ok=false", () => {
  const r = checkLivePlus30h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, -16),
  });
  eq(r.ok, false, "ok");
});

// case 5: +30h+16m → ok=false
assertCase("case5: +30h+16m ok=false", () => {
  const r = checkLivePlus30h({
    submitKst: SUBMIT_KST,
    nowKst: offsetIsoMin(SUBMIT_KST, 16),
  });
  eq(r.ok, false, "ok");
});

// case 6: freeze=true at exact +30h → ok=false, reason='freeze'
assertCase("case6: freeze=true at exact +30h ok=false reason=freeze", () => {
  const r = checkLivePlus30h({
    submitKst: SUBMIT_KST,
    nowKst: TARGET_KST,
    freeze: true,
  });
  eq(r.ok, false, "ok");
  eq(r.reason, "freeze", "reason");
});

console.log("");
console.log(
  `check-live-plus-30h tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
