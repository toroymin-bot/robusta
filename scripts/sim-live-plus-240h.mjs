#!/usr/bin/env node
/**
 * sim-live-plus-240h.mjs
 *   - C-D75-4 (D+3 07시 §4 슬롯, 2026-05-11) — Tori spec C-D75-4 (Task_2026-05-11 §3.6).
 *
 * Why: C-D75-1 check-live-plus-240h.mjs dry-run 시뮬레이터. C-D74-4 +24h 1:1 미러.
 *   3 시나리오: gate-pre / gate-pass / gate-post-24h. 실제 LIVE 영향 0.
 *
 * 출력:
 *   { total, pass, fail, totalMs, results: [{ scenario, passed, deltaMs, gateAt, reasons }] }
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건.
 */

import { checkLivePlus240h } from "./check-live-plus-240h.mjs";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EPOCH_T0_MS = Date.parse("2026-05-07T00:00:00+09:00");
const GATE_AT_MS = EPOCH_T0_MS + 240 * ONE_HOUR_MS;
const DEFAULT_SCENARIOS = ["gate-pre", "gate-pass", "gate-post-24h"];

function scenarioNow(name) {
  switch (name) {
    case "gate-pre":
      return GATE_AT_MS - ONE_HOUR_MS; // T+239h
    case "gate-pass":
      return GATE_AT_MS; // T+240h 정각
    case "gate-post-24h":
      return GATE_AT_MS + 24 * ONE_HOUR_MS; // T+264h
    default:
      throw new RangeError(`unknown scenario: ${name}`);
  }
}

function expectedPassed(name) {
  return name !== "gate-pre";
}

export async function simLivePlus240h(opts) {
  const o = opts || {};
  const scenarios = Array.isArray(o.scenarios) && o.scenarios.length > 0
    ? o.scenarios
    : DEFAULT_SCENARIOS;
  const epochT0 = typeof o.epochT0 === "number" && Number.isFinite(o.epochT0)
    ? o.epochT0
    : EPOCH_T0_MS;

  const start = Date.now();
  const results = [];

  for (const name of scenarios) {
    const now = scenarioNow(name);
    const r = await checkLivePlus240h({ now, epochT0 });
    const exp = expectedPassed(name);
    results.push({
      scenario: name,
      passed: r.passed,
      deltaMs: r.deltaMs,
      gateAt: r.gateAt,
      reasons: r.reasons,
      match: r.passed === exp,
      expected: { passed: exp },
    });
  }

  const pass = results.filter((r) => r.match).length;
  const fail = results.length - pass;
  const totalMs = Date.now() - start;

  return { total: results.length, pass, fail, totalMs, results };
}

async function main() {
  const result = await simLivePlus240h();
  for (const r of result.results) {
    const sym = r.match ? "✓" : "✗";
    console.log(`  ${sym} ${r.scenario} — passed=${r.passed} expected=${r.expected.passed} deltaMs=${r.deltaMs}`);
  }
  console.log("");
  console.log(
    `sim:live-plus-240h — ${result.pass}/${result.total} ${result.fail === 0 ? "PASS" : "FAIL"} (${result.totalMs} ms)`,
  );
  console.log(`totalMs=${result.totalMs}`);
  process.exit(result.fail === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
