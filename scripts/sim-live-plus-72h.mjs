#!/usr/bin/env node
/**
 * sim-live-plus-72h.mjs
 *   - C-D68-4 (D+1 19시 §10 슬롯, 2026-05-09) — Tori spec C-D68-4 (§22.5.4 / C-D68-1 보조).
 *
 * Why: C-D68-1 check-live-plus-72h.mjs 6 케이스 dry-run 시뮬레이터.
 *   각 케이스 expected 값 hardcoded + 실 실행 결과 매칭 + 6/6 PASS 의무.
 *
 * 6 케이스 매트릭스 (§22.5.4):
 *   C1: within window  (72h 정각, windowMin=15)              → withinWindow=true,  reason=within
 *   C2: before window  (71h 30분, windowMin=15)              → withinWindow=false, reason=before
 *   C3: after window   (72h 30분, windowMin=15)              → withinWindow=false, reason=after
 *   C4: env override   (LIVE_PLUS_72H_WINDOW_MIN=30, +25min) → withinWindow=true
 *   C5: startedAt env 폴백 (LIVE_STARTED_AT 폴백)            → withinWindow=true
 *   C6: unknown       (opts/env 모두 미지정)                  → throw('LIVE start unknown') 캐치
 *
 * 자율 정정 (D-68-자-4):
 *   출력에 totalMs 측정 (D-67-자-4 패턴 미러). 기존 출력 형식 유지 (backward-compatible).
 *
 * 출력:
 *   { total, pass, fail, totalMs, cases: [{name, expected, actual, match, reason?}] }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import { checkLivePlus72h } from "./check-live-plus-72h.mjs";

const STARTED_KST = "2026-05-08T07:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function nowAtOffsetMin(deltaMin) {
  return new Date(new Date(STARTED_KST).getTime() + 72 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS);
}

function safeRun(fn) {
  try {
    return { ok: true, result: fn() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function simLivePlus72h() {
  const start = Date.now();
  const cases = [];

  // C1: within window — 72h 정각.
  {
    const r = safeRun(() => checkLivePlus72h(nowAtOffsetMin(0), { startedAtIso: STARTED_KST, windowMin: 15 }));
    cases.push({
      name: "C1: within window(72h 정각)",
      expected: { withinWindow: true, reason: "within" },
      actual: r.ok ? { withinWindow: r.result.withinWindow, reason: r.result.reason } : { error: r.error },
      match: r.ok && r.result.withinWindow === true && r.result.reason === "within",
    });
  }

  // C2: before window — 72h-30m.
  {
    const r = safeRun(() => checkLivePlus72h(nowAtOffsetMin(-30), { startedAtIso: STARTED_KST, windowMin: 15 }));
    cases.push({
      name: "C2: before window(71h 30분)",
      expected: { withinWindow: false, reason: "before" },
      actual: r.ok ? { withinWindow: r.result.withinWindow, reason: r.result.reason } : { error: r.error },
      match: r.ok && r.result.withinWindow === false && r.result.reason === "before",
    });
  }

  // C3: after window — 72h+30m.
  {
    const r = safeRun(() => checkLivePlus72h(nowAtOffsetMin(30), { startedAtIso: STARTED_KST, windowMin: 15 }));
    cases.push({
      name: "C3: after window(72h 30분)",
      expected: { withinWindow: false, reason: "after" },
      actual: r.ok ? { withinWindow: r.result.withinWindow, reason: r.result.reason } : { error: r.error },
      match: r.ok && r.result.withinWindow === false && r.result.reason === "after",
    });
  }

  // C4: env override — LIVE_PLUS_72H_WINDOW_MIN=30, +25m → within.
  {
    const prev = process.env.LIVE_PLUS_72H_WINDOW_MIN;
    process.env.LIVE_PLUS_72H_WINDOW_MIN = "30";
    let r;
    try {
      r = safeRun(() => checkLivePlus72h(nowAtOffsetMin(25), { startedAtIso: STARTED_KST }));
    } finally {
      if (prev === undefined) delete process.env.LIVE_PLUS_72H_WINDOW_MIN;
      else process.env.LIVE_PLUS_72H_WINDOW_MIN = prev;
    }
    cases.push({
      name: "C4: env override LIVE_PLUS_72H_WINDOW_MIN=30 → +25m within",
      expected: { withinWindow: true },
      actual: r.ok ? { withinWindow: r.result.withinWindow, reason: r.result.reason } : { error: r.error },
      match: r.ok && r.result.withinWindow === true,
    });
  }

  // C5: startedAt env 폴백 — LIVE_STARTED_AT 사용.
  {
    const prev = process.env.LIVE_STARTED_AT;
    process.env.LIVE_STARTED_AT = STARTED_KST;
    let r;
    try {
      r = safeRun(() => checkLivePlus72h(nowAtOffsetMin(0), { windowMin: 15 }));
    } finally {
      if (prev === undefined) delete process.env.LIVE_STARTED_AT;
      else process.env.LIVE_STARTED_AT = prev;
    }
    cases.push({
      name: "C5: startedAt env 폴백 → within",
      expected: { withinWindow: true },
      actual: r.ok ? { withinWindow: r.result.withinWindow, reason: r.result.reason } : { error: r.error },
      match: r.ok && r.result.withinWindow === true,
    });
  }

  // C6: unknown — opts/env 모두 미지정 → throw 캐치.
  {
    const prev = process.env.LIVE_STARTED_AT;
    delete process.env.LIVE_STARTED_AT;
    let r;
    try {
      r = safeRun(() => checkLivePlus72h(new Date()));
    } finally {
      if (prev !== undefined) process.env.LIVE_STARTED_AT = prev;
    }
    cases.push({
      name: "C6: unknown → throw('LIVE start unknown') 캐치",
      expected: { error: "LIVE start unknown" },
      actual: r.ok ? { withinWindow: r.result.withinWindow } : { error: r.error },
      match: !r.ok && /LIVE start unknown/.test(r.error || ""),
    });
  }

  const pass = cases.filter((c) => c.match).length;
  const fail = cases.length - pass;
  const totalMs = Date.now() - start;
  return { total: cases.length, pass, fail, totalMs, cases };
}

function main() {
  const result = simLivePlus72h();
  for (const c of result.cases) {
    const sym = c.match ? "✓" : "✗";
    console.log(`  ${sym} ${c.name} — actual=${JSON.stringify(c.actual)} expected=${JSON.stringify(c.expected)}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-72h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
