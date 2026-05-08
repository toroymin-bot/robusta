#!/usr/bin/env node
/**
 * sim-live-plus-30h.mjs
 *   - C-D65-4 (D+1 07시 §4 슬롯, 2026-05-09) — Tori spec C-D65-4 (C-D65-1 보조).
 *
 * Why: C-D65-1 check-live-plus-30h.mjs 의 6 케이스 dry-run 시뮬레이터.
 *   각 케이스 expected ok 값 hardcoded + 실 실행 결과 매칭 + 6/6 PASS 의무.
 *
 * 6 케이스 매트릭스:
 *   case1: exact +30h           → expected ok=true  (deltaMin=0)
 *   case2: +30h-15m             → expected ok=true  (deltaMin=-15)
 *   case3: +30h+15m             → expected ok=true  (deltaMin=15)
 *   case4: +30h-16m             → expected ok=false (deltaMin=-16)
 *   case5: +30h+16m             → expected ok=false (deltaMin=16)
 *   case6: freeze=true at +30h  → expected ok=false (reason='freeze')
 *
 * 자율 정정 (D-65-자-4):
 *   출력에 totalMs 측정 추가 (성능 회귀 가시화). 기존 출력 형식 유지 (backward-compatible).
 *
 * 출력:
 *   { total: 6, pass: N, fail: 6-N, totalMs: number, cases: Array<{name, ok, expected, match}> }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import checkLivePlus30h from "./check-live-plus-30h.mjs";

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

function runCase(name, args, expectedOk) {
  const r = checkLivePlus30h(args);
  return { name, ok: r.ok, expected: expectedOk, match: r.ok === expectedOk, deltaMin: r.deltaMin, reason: r.reason };
}

export default function simLivePlus30h() {
  const start = Date.now();
  const cases = [];

  // case1: exact +30h → ok=true
  cases.push(
    runCase(
      "case1: exact +30h",
      { submitKst: SUBMIT_KST, nowKst: TARGET_KST },
      true,
    ),
  );

  // case2: +30h-15m → ok=true
  cases.push(
    runCase(
      "case2: +30h-15m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, -15) },
      true,
    ),
  );

  // case3: +30h+15m → ok=true
  cases.push(
    runCase(
      "case3: +30h+15m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, 15) },
      true,
    ),
  );

  // case4: +30h-16m → ok=false
  cases.push(
    runCase(
      "case4: +30h-16m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, -16) },
      false,
    ),
  );

  // case5: +30h+16m → ok=false
  cases.push(
    runCase(
      "case5: +30h+16m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, 16) },
      false,
    ),
  );

  // case6: freeze=true at exact +30h → ok=false
  cases.push(
    runCase(
      "case6: freeze=true at exact +30h",
      { submitKst: SUBMIT_KST, nowKst: TARGET_KST, freeze: true },
      false,
    ),
  );

  const pass = cases.filter((c) => c.match).length;
  const fail = cases.length - pass;
  const totalMs = Date.now() - start;
  return { total: cases.length, pass, fail, totalMs, cases };
}

function main() {
  const result = simLivePlus30h();
  for (const c of result.cases) {
    const sym = c.match ? "✓" : "✗";
    console.log(`  ${sym} ${c.name} — ok=${c.ok} expected=${c.expected} delta=${c.deltaMin}${c.reason ? ` reason=${c.reason}` : ""}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-30h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
