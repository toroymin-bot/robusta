#!/usr/bin/env node
/**
 * check-live-plus-144h.mjs
 *   - C-D71-1 (D+2 19시 §4 슬롯 자율 진입, 2026-05-10) — Tori spec C-D71-1 (§6.5).
 *
 * Why: LIVE +144h ±windowMin 윈도우 read-only 게이트 (D-D70 C-D70-1 +24h 패턴 1:1 미러).
 *   LIVE 시작 후 144h 시점 ±windowMin (기본 60) 정합 검증 + pingsPath 카운트.
 *   외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-71-자-1):
 *   환경 변수 LIVE_PLUS_144H_WINDOW_MIN 으로 windowMin override 가능 (디폴트 60 보존, backward-compatible).
 *
 * 함수 시그니처 (named export, §6.5 본체 lock 정합):
 *   checkLivePlus144h({ liveStartIso, nowIso, windowMin, pingsPath })
 *     -> { ok, tPlusH, inWindow, pingsTotal, reasons }
 *
 *     - liveStartIso: ISO 8601 string, default process.env.LIVE_START_ISO || '2026-05-08T00:00:00+09:00'.
 *     - nowIso:       ISO 8601 string, default new Date().toISOString().
 *     - windowMin:    int, default process.env.LIVE_PLUS_144H_WINDOW_MIN || 60.
 *     - pingsPath:    string, default process.env.ANALYTICS_PINGS_PATH || 'data/analytics/pings.jsonl'.
 *
 * 출력 정의 (§6.5):
 *   ok           boolean — inWindow=true && (pingsPath skip 시 skip 사유 포함하면서도 상위 게이트는 통과)
 *   tPlusH       number  — (now - liveStart) / 3600000 (소수점 포함)
 *   inWindow     boolean — 143 ≤ tPlusH ≤ 145 (windowMin=60 기준)
 *   pingsTotal   number  — pingsPath jsonl 라인 수 (파일 부재 시 0)
 *   reasons      string[] — ['T+ 음수' | 'out of window' | 'pings 파일 부재 — skip' | ...]
 *
 * 엣지 케이스:
 *   1) nowIso < liveStartIso → ok=false, reasons=['T+ 음수']
 *   2) pingsPath 부재         → pingsTotal=0, reasons에 'pings 파일 부재 — skip' 추가 (ok 자체는 inWindow 따름)
 *   3) tPlusH < 143 또는 tPlusH > 145 (windowMin=60) → ok=false, reasons=['out of window']
 *
 * 사용 (CLI):
 *   $ node scripts/check-live-plus-144h.mjs --live-start=2026-05-08T00:00:00+09:00
 *   $ LIVE_PLUS_144H_WINDOW_MIN=30 node scripts/check-live-plus-144h.mjs
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ONE_HOUR_MS = 60 * 60 * 1000;
const T_PLUS_144H_HOURS = 144;
const DEFAULT_LIVE_START_ISO = "2026-05-08T00:00:00+09:00";
const DEFAULT_WINDOW_MIN = 60;
const DEFAULT_PINGS_PATH = "data/analytics/pings.jsonl";

function envWindowMin() {
  const v = process.env.LIVE_PLUS_144H_WINDOW_MIN;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_WINDOW_MIN;
}

function envLiveStartIso() {
  const v = process.env.LIVE_START_ISO;
  if (typeof v === "string" && v.length > 0) return v;
  return DEFAULT_LIVE_START_ISO;
}

function envPingsPath() {
  const v = process.env.ANALYTICS_PINGS_PATH;
  if (typeof v === "string" && v.length > 0) return v;
  return DEFAULT_PINGS_PATH;
}

function countPings(pingsPath) {
  if (!existsSync(pingsPath)) {
    return { count: 0, missing: true };
  }
  let raw;
  try {
    raw = readFileSync(pingsPath, "utf8");
  } catch {
    return { count: 0, missing: true };
  }
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return { count: lines.length, missing: false };
}

export function checkLivePlus144h(opts) {
  const o = opts || {};
  const liveStartIso = typeof o.liveStartIso === "string" && o.liveStartIso.length > 0
    ? o.liveStartIso
    : envLiveStartIso();
  const nowIso = typeof o.nowIso === "string" && o.nowIso.length > 0
    ? o.nowIso
    : new Date().toISOString();
  const windowMin = o.windowMin === undefined || o.windowMin === null
    ? envWindowMin()
    : o.windowMin;
  const pingsPath = typeof o.pingsPath === "string" && o.pingsPath.length > 0
    ? o.pingsPath
    : envPingsPath();

  const reasons = [];

  if (typeof windowMin !== "number" || !Number.isFinite(windowMin) || windowMin <= 0) {
    throw new RangeError("windowMin must be > 0");
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
    return {
      ok: false,
      tPlusH: (nowMs - liveStartMs) / ONE_HOUR_MS,
      inWindow: false,
      pingsTotal: 0,
      reasons: ["T+ 음수"],
    };
  }

  const tPlusH = (nowMs - liveStartMs) / ONE_HOUR_MS;
  const windowH = windowMin / 60;
  const lower = T_PLUS_144H_HOURS - windowH;
  const upper = T_PLUS_144H_HOURS + windowH;
  const inWindow = tPlusH >= lower && tPlusH <= upper;

  if (!inWindow) {
    reasons.push("out of window");
  }

  const { count, missing } = countPings(resolve(pingsPath));
  if (missing) {
    reasons.push("pings 파일 부재 — skip");
  }

  return {
    ok: inWindow,
    tPlusH,
    inWindow,
    pingsTotal: count,
    reasons,
  };
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
    pingsPath: get("pings-path"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = checkLivePlus144h({
      liveStartIso: args.liveStartIso ?? undefined,
      nowIso: args.nowIso ?? undefined,
      windowMin: args.windowMin === null ? undefined : parseInt(args.windowMin, 10),
      pingsPath: args.pingsPath ?? undefined,
    });
    console.log(JSON.stringify({ livePlus144h: result }));
    console.log(
      `check:live-plus-144h ok=${result.ok} inWindow=${result.inWindow} tPlusH=${result.tPlusH.toFixed(2)} pingsTotal=${result.pingsTotal} reasons=${JSON.stringify(result.reasons)}`,
    );
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    console.error(`check:live-plus-144h ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
