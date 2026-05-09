#!/usr/bin/env node
/**
 * sim-live-plus-48h.mjs
 *   - C-D66-4 (D+1 11시 §6 슬롯, 2026-05-09) — Tori spec C-D66-4 (C-D66-1 보조).
 *
 * Why: C-D66-1 check-live-plus-48h.mjs 의 6 케이스 dry-run 시뮬레이터.
 *   각 케이스 expected ok 값 hardcoded + 실 실행 결과 매칭 + 6/6 PASS 의무.
 *
 * 6 케이스 매트릭스:
 *   case1: exact +48h           → expected ok=true  (deltaMin=0)
 *   case2: +48h-15m             → expected ok=true  (deltaMin=-15)
 *   case3: +48h+15m             → expected ok=true  (deltaMin=15)
 *   case4: +48h-16m             → expected ok=false (deltaMin=-16)
 *   case5: +48h+16m             → expected ok=false (deltaMin=16)
 *   case6: freeze=true at +48h  → expected ok=false (reason='freeze')
 *
 * 자율 정정 (D-66-자-4):
 *   출력에 totalMs 측정 (D-65-자-4 패턴 미러). 기존 출력 형식 유지 (backward-compatible).
 *
 * 출력:
 *   { total: 6, pass: N, fail: 6-N, totalMs: number, cases: Array<{name, ok, expected, match}> }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import checkLivePlus48h from "./check-live-plus-48h.mjs";

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

function runCase(name, args, expectedOk) {
  const r = checkLivePlus48h(args);
  return { name, ok: r.ok, expected: expectedOk, match: r.ok === expectedOk, deltaMin: r.deltaMin, reason: r.reason };
}

export default function simLivePlus48h() {
  const start = Date.now();
  const cases = [];

  // case1: exact +48h → ok=true
  cases.push(
    runCase(
      "case1: exact +48h",
      { submitKst: SUBMIT_KST, nowKst: TARGET_KST },
      true,
    ),
  );

  // case2: +48h-15m → ok=true
  cases.push(
    runCase(
      "case2: +48h-15m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, -15) },
      true,
    ),
  );

  // case3: +48h+15m → ok=true
  cases.push(
    runCase(
      "case3: +48h+15m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, 15) },
      true,
    ),
  );

  // case4: +48h-16m → ok=false
  cases.push(
    runCase(
      "case4: +48h-16m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, -16) },
      false,
    ),
  );

  // case5: +48h+16m → ok=false
  cases.push(
    runCase(
      "case5: +48h+16m",
      { submitKst: SUBMIT_KST, nowKst: offsetIsoMin(SUBMIT_KST, 16) },
      false,
    ),
  );

  // case6: freeze=true at exact +48h → ok=false
  cases.push(
    runCase(
      "case6: freeze=true at exact +48h",
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
  const result = simLivePlus48h();
  for (const c of result.cases) {
    const sym = c.match ? "✓" : "✗";
    console.log(`  ${sym} ${c.name} — ok=${c.ok} expected=${c.expected} delta=${c.deltaMin}${c.reason ? ` reason=${c.reason}` : ""}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-48h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
