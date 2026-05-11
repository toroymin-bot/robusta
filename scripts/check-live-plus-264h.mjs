#!/usr/bin/env node
/**
 * check-live-plus-264h.mjs
 *   - C-D76-1 (D+3 15시 §8 슬롯, 2026-05-11) — Tori spec C-D76-1 (Task_2026-05-11 §5.6).
 *
 * Why: LIVE +264h(11일) read-only 게이트. T+0 epoch 2026-05-07T00:00+09:00 기준 T+264h 단조 게이트.
 *   C-D75-1 (check-live-plus-240h.mjs) +24h 1:1 미러. 외부 fetch 0건 / Dexie 미접근.
 *
 * 함수 시그니처 (named export, §5.6 본체 lock 정합):
 *   checkLivePlus264h({ now, epochT0 })
 *     → { passed, deltaMs, gateAt, reasons }
 *
 *     - now:     number ms epoch, default Date.now().
 *     - epochT0: number ms epoch, default Date.parse('2026-05-07T00:00+09:00').
 *
 * 출력 정의 (§5.6):
 *   passed   boolean — now >= gateAt 단조 1bit (게이트 통과)
 *   deltaMs  number  — now - gateAt
 *   gateAt   number  — epochT0 + 264h
 *   reasons  string[] — ['gate not reached'] when now < gateAt
 *
 * 엣지 케이스 (§5.6):
 *   1) now < gateAt              → passed=false, reasons=['gate not reached']
 *   2) now > gateAt+1h           → passed=true  (게이트 통과 단조 1bit)
 *   3) NaN epoch                 → throw RangeError
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const T_PLUS_264H_MS = 264 * ONE_HOUR_MS;
const DEFAULT_EPOCH_T0_MS = Date.parse("2026-05-07T00:00:00+09:00");

export async function checkLivePlus264h(opts) {
  const o = opts || {};
  const now = typeof o.now === "number" ? o.now : Date.now();
  const epochT0 = typeof o.epochT0 === "number" ? o.epochT0 : DEFAULT_EPOCH_T0_MS;

  if (!Number.isFinite(epochT0)) {
    throw new RangeError("epochT0 invalid (NaN)");
  }
  if (!Number.isFinite(now)) {
    throw new RangeError("now invalid (NaN)");
  }

  const gateAt = epochT0 + T_PLUS_264H_MS;
  const deltaMs = now - gateAt;
  const passed = now >= gateAt;
  const reasons = passed ? [] : ["gate not reached"];

  return { passed, deltaMs, gateAt, reasons };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    now: get("now"),
    epochT0: get("epoch-t0"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const opts = {};
    if (args.now !== null) opts.now = Date.parse(args.now);
    if (args.epochT0 !== null) opts.epochT0 = Date.parse(args.epochT0);
    const r = await checkLivePlus264h(opts);
    console.log(JSON.stringify({ livePlus264h: r }));
    console.log(
      `check:live-plus-264h passed=${r.passed} deltaMs=${r.deltaMs} gateAt=${r.gateAt} reasons=${JSON.stringify(r.reasons)}`,
    );
    process.exit(r.passed ? 0 : 1);
  } catch (e) {
    console.error(`check:live-plus-264h ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
