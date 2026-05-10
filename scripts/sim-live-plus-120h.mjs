#!/usr/bin/env node
/**
 * sim-live-plus-120h.mjs
 *   - C-D70-4 (D+2 11시 §6 슬롯, 2026-05-10) — Tori spec C-D70-4 (§1.6 / C-D70-1 보조).
 *
 * Why: C-D70-1 check-live-plus-120h.mjs 6 케이스 dry-run 시뮬레이터.
 *   각 케이스 expected 값 hardcoded + 실 실행 결과 매칭 + 6/6 PASS 의무.
 *
 * 6 케이스 매트릭스 (§1.6):
 *   C1: T+120h 정확 (windowMin=60)              → ok=true,  inWindow=true
 *   C2: T+119h 정각 (windowMin=60, lower)       → ok=true
 *   C3: T+121h 정각 (windowMin=60, upper)       → ok=true
 *   C4: T+118h59m (windowMin=60)                → ok=false (out of window)
 *   C5: T+121h01m (windowMin=60)                → ok=false (out of window)
 *   C6: pings 파일 부재                         → ok=true (skip), reasons에 'pings 파일 부재' 포함
 *
 * 자율 정정 (D-70-자-4):
 *   출력에 totalMs 측정 (D-69-자-4 패턴 미러). 기존 출력 형식 유지 (backward-compatible).
 *
 * 출력:
 *   { total, pass, fail, totalMs, cases: [{name, expected, actual, match}] }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import { checkLivePlus120h } from "./check-live-plus-120h.mjs";

const LIVE_START_ISO = "2026-05-08T00:00:00+09:00";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const NON_EXISTENT_PINGS = "data/analytics/__nonexistent_d70.jsonl";

function nowIsoAtOffsetMin(deltaMin) {
  const ms = new Date(LIVE_START_ISO).getTime() + 120 * ONE_HOUR_MS + deltaMin * ONE_MINUTE_MS;
  return new Date(ms).toISOString();
}

function safeRun(fn) {
  try {
    return { ok: true, result: fn() };
  } catch (e) {
    return { ok: false, error: e.message, name: e.name };
  }
}

export function simLivePlus120h() {
  const start = Date.now();
  const cases = [];

  // C1: T+120h 정각 (windowMin=60).
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(0),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C1: T+120h 정각 → ok=true inWindow=true",
      expected: { ok: true, inWindow: true },
      actual: r.ok ? { ok: r.result.ok, inWindow: r.result.inWindow } : { error: r.error },
      match: r.ok && r.result.ok === true && r.result.inWindow === true,
    });
  }

  // C2: T+119h 정각 (lower).
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(-60),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C2: T+119h (lower) → ok=true",
      expected: { ok: true },
      actual: r.ok ? { ok: r.result.ok, tPlusH: r.result.tPlusH } : { error: r.error },
      match: r.ok && r.result.ok === true,
    });
  }

  // C3: T+121h 정각 (upper).
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(60),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C3: T+121h (upper) → ok=true",
      expected: { ok: true },
      actual: r.ok ? { ok: r.result.ok, tPlusH: r.result.tPlusH } : { error: r.error },
      match: r.ok && r.result.ok === true,
    });
  }

  // C4: T+118h59m → ok=false.
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(-61),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C4: T+118h59m → ok=false (out of window)",
      expected: { ok: false },
      actual: r.ok ? { ok: r.result.ok, reasons: r.result.reasons } : { error: r.error },
      match: r.ok && r.result.ok === false && r.result.reasons.includes("out of window"),
    });
  }

  // C5: T+121h01m → ok=false.
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(61),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C5: T+121h01m → ok=false (out of window)",
      expected: { ok: false },
      actual: r.ok ? { ok: r.result.ok, reasons: r.result.reasons } : { error: r.error },
      match: r.ok && r.result.ok === false && r.result.reasons.includes("out of window"),
    });
  }

  // C6: pings 파일 부재 → reasons 'pings 파일 부재 — skip' 포함.
  {
    const r = safeRun(() => checkLivePlus120h({
      liveStartIso: LIVE_START_ISO,
      nowIso: nowIsoAtOffsetMin(0),
      windowMin: 60,
      pingsPath: NON_EXISTENT_PINGS,
    }));
    cases.push({
      name: "C6: pings 파일 부재 → reasons에 skip 사유 포함",
      expected: { ok: true, reasonsIncludesSkip: true },
      actual: r.ok ? { ok: r.result.ok, reasons: r.result.reasons } : { error: r.error },
      match:
        r.ok &&
        r.result.ok === true &&
        r.result.reasons.some((x) => /pings 파일 부재/.test(x)),
    });
  }

  const pass = cases.filter((c) => c.match).length;
  const fail = cases.length - pass;
  const totalMs = Date.now() - start;
  return { total: cases.length, pass, fail, totalMs, cases };
}

function main() {
  const result = simLivePlus120h();
  for (const c of result.cases) {
    const sym = c.match ? "✓" : "✗";
    console.log(`  ${sym} ${c.name} — actual=${JSON.stringify(c.actual)} expected=${JSON.stringify(c.expected)}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-120h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  console.log(`totalMs=${result.totalMs}`);
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
