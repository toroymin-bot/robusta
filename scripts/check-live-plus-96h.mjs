#!/usr/bin/env node
/**
 * check-live-plus-96h.mjs
 *   - C-D69-1 (D+1 23시 §12 슬롯, 2026-05-09) — Tori spec C-D69-1 (§24.6.1).
 *
 * Why: LIVE +96h ±15분 윈도우 read-only 게이트 (D-D68 C-D68-1 패턴 미러).
 *   LIVE 시작 후 96h 시점 ±windowMin 정합 검증. 외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-69-자-1):
 *   환경 변수 LIVE_PLUS_96H_WINDOW_MIN 으로 windowMin override 가능 (디폴트 15 보존, backward-compatible).
 *
 * 함수 시그니처 (named export, §24.6.1 본체 lock 정합):
 *   checkLivePlus96h({ liveStartIso, nowIso, windowMin = 15 })
 *     -> { phase, currentMs, windowMs, deltaMs, inWindow }
 *
 *     - liveStartIso: ISO 8601 string, default '2026-05-08T02:00:00+09:00'.
 *     - nowIso:       ISO 8601 string, default new Date().toISOString().
 *     - windowMin:    int, default process.env.LIVE_PLUS_96H_WINDOW_MIN || 15.
 *
 * 출력 정의:
 *   phase       'live' (윈도우 내) | 'pre-live' (도달 전) | 'post-window' (윈도우 이후).
 *   currentMs   (now - liveStart) ms (≥ 0).
 *   windowMs    windowMin * 60 * 1000.
 *   deltaMs     currentMs - 96h ms (음/양 가능).
 *   inWindow    |deltaMs| ≤ windowMs.
 *
 * 엣지 케이스:
 *   1) 0초 boundary (currentMs === 96h ms) → inWindow=true, deltaMs=0.
 *   2) nowIso < liveStartIso → throw RangeError('nowIso must be ≥ liveStartIso').
 *   3) windowMin <= 0 → throw RangeError('windowMin must be > 0').
 *   4) windowMin > 1440 → throw RangeError('windowMin must be ≤ 1440 (24h cap)').
 *
 * 사용 (CLI):
 *   $ node scripts/check-live-plus-96h.mjs --live-start=2026-05-08T02:00:00+09:00
 *   $ LIVE_PLUS_96H_WINDOW_MIN=30 node scripts/check-live-plus-96h.mjs
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const T_PLUS_96H_HOURS = 96;
const T_PLUS_96H_MS = T_PLUS_96H_HOURS * ONE_HOUR_MS;
const DEFAULT_LIVE_START_ISO = "2026-05-08T02:00:00+09:00";
const DEFAULT_WINDOW_MIN = 15;
const WINDOW_MIN_CAP = 1440;

function envWindowMin() {
  const v = process.env.LIVE_PLUS_96H_WINDOW_MIN;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_WINDOW_MIN;
}

export function checkLivePlus96h(opts) {
  const o = opts || {};
  const liveStartIso = typeof o.liveStartIso === "string" && o.liveStartIso.length > 0
    ? o.liveStartIso
    : DEFAULT_LIVE_START_ISO;
  const nowIso = typeof o.nowIso === "string" && o.nowIso.length > 0
    ? o.nowIso
    : new Date().toISOString();
  const windowMin = o.windowMin === undefined || o.windowMin === null
    ? envWindowMin()
    : o.windowMin;

  if (typeof windowMin !== "number" || !Number.isFinite(windowMin) || windowMin <= 0) {
    throw new RangeError("windowMin must be > 0");
  }
  if (windowMin > WINDOW_MIN_CAP) {
    throw new RangeError("windowMin must be ≤ 1440 (24h cap)");
  }

  const liveStartMs = new Date(liveStartIso).getTime();
  if (!Number.isFinite(liveStartMs)) {
    throw new RangeError("liveStartIso invalid");
  }
  const nowMs = new Date(nowIso).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("nowIso invalid");
  }
  if (nowMs < liveStartMs) {
    throw new RangeError("nowIso must be ≥ liveStartIso");
  }

  const currentMs = nowMs - liveStartMs;
  const windowMs = windowMin * ONE_MINUTE_MS;
  const deltaMs = currentMs - T_PLUS_96H_MS;

  let phase;
  let inWindow;
  if (Math.abs(deltaMs) <= windowMs) {
    phase = "live";
    inWindow = true;
  } else if (deltaMs < -windowMs) {
    phase = "pre-live";
    inWindow = false;
  } else {
    phase = "post-window";
    inWindow = false;
  }

  return { phase, currentMs, windowMs, deltaMs, inWindow };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    liveStartIso: get("live-start"),
    nowIso: get("now"),
    windowMin: get("window-min"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = checkLivePlus96h({
      liveStartIso: args.liveStartIso ?? undefined,
      nowIso: args.nowIso ?? undefined,
      windowMin: args.windowMin === null ? undefined : parseInt(args.windowMin, 10),
    });
    console.log(JSON.stringify({ livePlus96h: result }));
    console.log(
      `check:live-plus-96h phase=${result.phase} inWindow=${result.inWindow} deltaMs=${result.deltaMs}`,
    );
    process.exit(result.inWindow ? 0 : 1);
  } catch (e) {
    console.error(`check:live-plus-96h ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
