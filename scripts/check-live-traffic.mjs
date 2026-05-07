#!/usr/bin/env node
/**
 * check-live-traffic.mjs
 *   - C-D59-2 (D-Day 07시 슬롯, 2026-05-08) — Tori spec C-D59-2 (B-D59-1 짝).
 *
 * Why: D-Day live phase 진입 +5h 정각 시점 (2026-05-08 05:00 KST) 정합 검증 read-only.
 *   Dexie 미접근 — SoP 정합 + 산식 sync 검증만. 실 누적 검증은 D+1 deferral (F-D56-1).
 *
 *   3 정합 (모두 PASS 의무):
 *     1) baseline=360 정합 (sim-funnel-events-day1.mjs SoT 단일 출력)
 *     2) window=5h 정합 (since/until KST diff ms == 5 * 3600 * 1000)
 *     3) phase=live 정합 (check-live-phase.mjs --expect=live exit 0)
 *
 * 자율 정정 (D-58-자-2 락 정합):
 *   .mjs ↔ .ts import 불가 — D-53-자-1 'CLI .mjs ↔ .ts 산식 미러 SoT' 락 정합.
 *   tsx dev-deps 추가 금지 (L-D59-2 단조 증가 + dev-deps +0 락 의무).
 *
 * 함수 시그니처:
 *   checkLiveTraffic({ since, until, baseline }) -> { ok, sinceKST, untilKST, windowH, baselineRows, phaseExpect, phaseActual, note }
 *
 * 사용:
 *   $ node scripts/check-live-traffic.mjs --since=2026-05-08T00:00:00+09:00 --until=2026-05-08T05:00:00+09:00 --baseline=360
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ONE_HOUR_MS = 60 * 60 * 1000;
const WINDOW_HOURS = 5;
const EXPECTED_BASELINE = 360;
const PHASE_EXPECT = "live";

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    since: get("since"),
    until: get("until"),
    baseline: get("baseline"),
  };
}

/**
 * checkLiveTraffic — 3 정합 검증.
 * 입력 가드:
 *   - since/until 누락 또는 Invalid Date → throw RangeError
 *   - baseline 미지정 또는 NaN → throw RangeError
 *   - since > until → throw RangeError
 */
export function checkLiveTraffic({ since, until, baseline } = {}) {
  if (!since || !until) {
    throw new RangeError("missing --since or --until");
  }
  const sinceMs = new Date(since).getTime();
  const untilMs = new Date(until).getTime();
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs)) {
    throw new RangeError("invalid since/until");
  }
  if (sinceMs > untilMs) {
    throw new RangeError("since > until (시간 역전)");
  }
  const baselineNum = Number(baseline);
  if (!Number.isFinite(baselineNum)) {
    throw new RangeError("invalid --baseline");
  }

  // 1) window=5h 정합
  const windowMs = untilMs - sinceMs;
  const windowH = windowMs / ONE_HOUR_MS;
  const windowOk = Math.abs(windowMs - WINDOW_HOURS * ONE_HOUR_MS) < 1;

  // 2) baseline=360 정합
  const baselineOk = baselineNum === EXPECTED_BASELINE;

  // 3) phase=live 정합 — check-live-phase.mjs --expect=live
  const root = resolve(process.cwd());
  const r = spawnSync(
    "node",
    ["scripts/check-live-phase.mjs", `--expect=${PHASE_EXPECT}`],
    { cwd: root, encoding: "utf8" },
  );
  let phaseActual = "unknown";
  try {
    const firstLine = r.stdout.split("\n").filter(Boolean)[0] ?? "";
    const parsed = JSON.parse(firstLine);
    phaseActual = parsed.phase ?? "unknown";
  } catch {
    phaseActual = "unknown";
  }
  const phaseOk = r.status === 0 && phaseActual === PHASE_EXPECT;

  const ok = windowOk && baselineOk && phaseOk;
  const note = ok
    ? `live +${windowH}h 정합 PASS (baseline=${baselineNum}, phase=${phaseActual})`
    : `FAIL — windowOk=${windowOk} baselineOk=${baselineOk} phaseOk=${phaseOk}`;

  return {
    ok,
    sinceKST: since,
    untilKST: until,
    windowH,
    baselineRows: baselineNum,
    phaseExpect: PHASE_EXPECT,
    phaseActual,
    note,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  try {
    result = checkLiveTraffic(args);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  console.log(JSON.stringify({ liveTraffic: result }));
  console.log(
    `check:live-traffic ok=${result.ok} windowH=${result.windowH}`,
  );
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
