#!/usr/bin/env node
/**
 * check-live-plus-72h.mjs
 *   - C-D68-1 (D+1 19시 §10 슬롯, 2026-05-09) — Tori spec C-D68-1 (§22.5.1).
 *
 * Why: LIVE +72h ±15분 윈도우 정형 lock (C-D67-1 mirror).
 *   LIVE 시작 후 72h 시점 ±windowMin 정합 검증 read-only 게이트.
 *   외부 fetch 0건 / Dexie 미접근 / 본 도구는 시점 산식만 책임.
 *
 * 자율 정정 큐 (D-68-자-1):
 *   환경 변수 LIVE_PLUS_72H_WINDOW_MIN 으로 windowMin override 가능 (디폴트 15 보존, backward-compatible).
 *
 * 함수 시그니처 (named export, §22.5.1 본체 lock 정합):
 *   checkLivePlus72h(now: Date, opts?: { startedAtIso?: string, windowMin?: number })
 *     -> { withinWindow: boolean, ageH: number, deltaMin: number, reason: string }
 *
 *     - now:                현재 시각 Date 객체.
 *     - opts.startedAtIso:  LIVE 시작 ISO+09:00 문자열, 미지정 시 process.env.LIVE_STARTED_AT 폴백.
 *     - opts.windowMin:     윈도우 ±분, 미지정 시 process.env.LIVE_PLUS_72H_WINDOW_MIN 폴백 → 미존재 시 기본 15.
 *
 * 출력 정의:
 *   withinWindow  72h 앵커 ±windowMin 범위 내 boolean.
 *   ageH          (now - startedAt) 시간 (소수점 2자리, 음수 가능).
 *   deltaMin      72h 앵커 대비 분 차이 (±부호, 정수).
 *   reason        within / before / after — 케이스 라벨.
 *
 * 엣지 케이스:
 *   1) opts.startedAtIso 미지정 + env 미존재 → throw new Error('LIVE start unknown')
 *   2) windowMin = 0 → 정확히 72.000h 만 within (deltaMin === 0 ↔ withinWindow=true)
 *   3) now < startedAt → ageH 음수 + reason 'before'
 *   4) startedAtIso 비-KST(+09:00) → throw new Error('startedAtIso must be ISO with +09:00')
 *   5) startedAtIso 파싱 실패 → throw new Error('startedAtIso invalid')
 *   6) windowMin 음수 → throw new Error('windowMin must be >= 0')
 *
 * 사용 (CLI):
 *   $ node scripts/check-live-plus-72h.mjs --started=2026-05-08T07:00:00+09:00
 *   $ LIVE_STARTED_AT=2026-05-08T07:00:00+09:00 node scripts/check-live-plus-72h.mjs
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const T_PLUS_72H_HOURS = 72;
const T_PLUS_72H_MS = T_PLUS_72H_HOURS * ONE_HOUR_MS;
const DEFAULT_WINDOW_MIN = 15;

function isKstSuffix(s) {
  if (typeof s !== "string") return false;
  return /\+09:00$/.test(s);
}

function envWindowMin() {
  const v = process.env.LIVE_PLUS_72H_WINDOW_MIN;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_WINDOW_MIN;
}

function envStartedAt() {
  const v = process.env.LIVE_STARTED_AT;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function checkLivePlus72h(now, opts) {
  const o = opts || {};
  const startedAtIso = o.startedAtIso ?? envStartedAt();
  if (typeof startedAtIso !== "string" || startedAtIso.length === 0) {
    throw new Error("LIVE start unknown");
  }
  if (!isKstSuffix(startedAtIso)) {
    throw new Error("startedAtIso must be ISO with +09:00");
  }
  const startedMs = new Date(startedAtIso).getTime();
  if (!Number.isFinite(startedMs)) {
    throw new Error("startedAtIso invalid");
  }
  const win = o.windowMin === undefined || o.windowMin === null
    ? envWindowMin()
    : o.windowMin;
  if (typeof win !== "number" || !Number.isFinite(win) || win < 0) {
    throw new Error("windowMin must be >= 0");
  }
  const nowMs = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(nowMs)) {
    throw new Error("now must be a valid Date");
  }
  const targetMs = startedMs + T_PLUS_72H_MS;
  const deltaMin = Math.round((nowMs - targetMs) / ONE_MINUTE_MS);
  const ageH = Math.round(((nowMs - startedMs) / ONE_HOUR_MS) * 100) / 100;

  let reason;
  if (nowMs < startedMs) {
    reason = "before";
  } else if (deltaMin < -win) {
    reason = "before";
  } else if (deltaMin > win) {
    reason = "after";
  } else {
    reason = "within";
  }
  const withinWindow = reason === "within";
  return { withinWindow, ageH, deltaMin, reason };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    startedAtIso: get("started"),
    windowMin: get("window-min"),
    nowIso: get("now"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const now = args.nowIso ? new Date(args.nowIso) : new Date();
    const result = checkLivePlus72h(now, {
      startedAtIso: args.startedAtIso ?? undefined,
      windowMin: args.windowMin === null ? undefined : parseInt(args.windowMin, 10),
    });
    console.log(JSON.stringify({ livePlus72h: result }));
    console.log(
      `check:live-plus-72h withinWindow=${result.withinWindow} ageH=${result.ageH} deltaMin=${result.deltaMin} reason=${result.reason}`,
    );
    process.exit(result.withinWindow ? 0 : 1);
  } catch (e) {
    console.error(`check:live-plus-72h ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
