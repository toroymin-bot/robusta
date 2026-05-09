#!/usr/bin/env node
/**
 * sim-live-plus-96h.mjs
 *   - C-D69-4 (D+1 23시 §12 슬롯, 2026-05-09) — Tori spec C-D69-4 (§24.6.4 / C-D69-1 보조).
 *
 * Why: C-D69-1 check-live-plus-96h.mjs 6 케이스 dry-run 시뮬레이터.
 *   각 케이스 expected 값 hardcoded + 실 실행 결과 매칭 + 6/6 PASS 의무.
 *
 * 6 케이스 매트릭스 (§24.6.4):
 *   C1: T+96h 정확 (windowMin=15)              → inWindow=true,  deltaMs=0
 *   C2: T+96h - 14m (windowMin=15)             → inWindow=true
 *   C3: T+96h + 14m (windowMin=15)             → inWindow=true
 *   C4: T+96h - 16m (windowMin=15)             → inWindow=false
 *   C5: T+96h + 16m (windowMin=15)             → inWindow=false
 *   C6: nowIso < liveStartIso                  → throw RangeError 캐치
 *
 * 자율 정정 (D-69-자-4):
 *   출력에 totalMs 측정 (D-67/D-68 패턴 미러). 기존 출력 형식 유지 (backward-compatible).
 *
 * 출력:
 *   { total, pass, fail, totalMs, cases: [{name, expected, actual, match}] }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import { checkLivePlus96h } from "./check-live-plus-96h.mjs";

const LIVE_START_ISO = "2026-05-08T02:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function nowIsoAtOffsetMin(deltaMin) {
  const ms = new Date(LIVE_START_ISO).getTime() + 96 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS;
  return new Date(ms).toISOString();
}

function safeRun(fn) {
  try {
    return { ok: true, result: fn() };
  } catch (e) {
    return { ok: false, error: e.message, name: e.name };
  }
}

export function simLivePlus96h() {
  const start = Date.now();
  const cases = [];

  // C1: T+96h 정각.
  {
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(0), windowMin: 15 }));
    cases.push({
      name: "C1: T+96h 정확 → inWindow=true deltaMs=0",
      expected: { inWindow: true, deltaMs: 0 },
      actual: r.ok ? { inWindow: r.result.inWindow, deltaMs: r.result.deltaMs } : { error: r.error },
      match: r.ok && r.result.inWindow === true && r.result.deltaMs === 0,
    });
  }

  // C2: T+96h - 14m.
  {
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(-14), windowMin: 15 }));
    cases.push({
      name: "C2: T+96h - 14m → inWindow=true",
      expected: { inWindow: true },
      actual: r.ok ? { inWindow: r.result.inWindow, deltaMs: r.result.deltaMs } : { error: r.error },
      match: r.ok && r.result.inWindow === true,
    });
  }

  // C3: T+96h + 14m.
  {
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(14), windowMin: 15 }));
    cases.push({
      name: "C3: T+96h + 14m → inWindow=true",
      expected: { inWindow: true },
      actual: r.ok ? { inWindow: r.result.inWindow, deltaMs: r.result.deltaMs } : { error: r.error },
      match: r.ok && r.result.inWindow === true,
    });
  }

  // C4: T+96h - 16m.
  {
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(-16), windowMin: 15 }));
    cases.push({
      name: "C4: T+96h - 16m → inWindow=false",
      expected: { inWindow: false },
      actual: r.ok ? { inWindow: r.result.inWindow, deltaMs: r.result.deltaMs } : { error: r.error },
      match: r.ok && r.result.inWindow === false,
    });
  }

  // C5: T+96h + 16m.
  {
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: nowIsoAtOffsetMin(16), windowMin: 15 }));
    cases.push({
      name: "C5: T+96h + 16m → inWindow=false",
      expected: { inWindow: false },
      actual: r.ok ? { inWindow: r.result.inWindow, deltaMs: r.result.deltaMs } : { error: r.error },
      match: r.ok && r.result.inWindow === false,
    });
  }

  // C6: nowIso < liveStartIso → throw RangeError.
  {
    const before = new Date(new Date(LIVE_START_ISO).getTime() - ONE_HOUR_MS).toISOString();
    const r = safeRun(() => checkLivePlus96h({ liveStartIso: LIVE_START_ISO, nowIso: before, windowMin: 15 }));
    cases.push({
      name: "C6: nowIso < liveStartIso → throw RangeError 캐치",
      expected: { error: "nowIso must be ≥ liveStartIso" },
      actual: r.ok ? { ok: true } : { error: r.error, name: r.name },
      match: !r.ok && r.name === "RangeError" && /nowIso must be/.test(r.error || ""),
    });
  }

  const pass = cases.filter((c) => c.match).length;
  const fail = cases.length - pass;
  const totalMs = Date.now() - start;
  return { total: cases.length, pass, fail, totalMs, cases };
}

function main() {
  const result = simLivePlus96h();
  for (const c of result.cases) {
    const sym = c.match ? "✓" : "✗";
    console.log(`  ${sym} ${c.name} — actual=${JSON.stringify(c.actual)} expected=${JSON.stringify(c.expected)}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-96h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  console.log(`totalMs=${result.totalMs}`);
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
