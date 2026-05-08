#!/usr/bin/env node
/**
 * check-byok-funnel.mjs
 *   - C-D65-2 (D+1 07시 §4 슬롯, 2026-05-09) — Tori spec C-D65-2 (B-D65-3 본체).
 *
 * Why: BYOK 4단계 펀넬 KPI 검증. landing → key 등록 → 방 입장 → 첫 메시지.
 *   analytics_pings.jsonl 입력 → counts/rates 산출 → 임계 대비 ok 판정.
 *   외부 fetch 0건 / Dexie 미접근 / 본 도구는 정적 파일 read-only 만 책임.
 *
 * 자율 정정:
 *   - D-65-자-2: 환경 변수 ANALYTICS_PINGS_PATH 로 pingsPath override 가능 (디폴트 'data/analytics_pings.jsonl' 보존).
 *   - D-65-자-3: sid 익명 8자 hex 정규식 (/^[0-9a-f]{8}$/) 위반 라인 무시.
 *
 * 4 이벤트 스키마 (§15.1 stand-alone lock):
 *   landing      { ts (ISO +09:00), sid (8자 hex) }
 *   key_added    { ts, sid, provider in {claude,gemini,chatgpt,grok,deepseek} }
 *   room_entered { ts, sid, room_id (string non-empty) }
 *   msg_sent     { ts, sid, room_id, len (정수) }
 *
 * 본 4 이벤트 외 라인 = 무시.
 *
 * 함수 시그니처 (default export):
 *   checkByokFunnel({ pingsPath?, thresholds? })
 *     -> { ok, counts, rates, reason? }
 *
 *     - pingsPath:  디폴트 env ANALYTICS_PINGS_PATH 또는 'data/analytics_pings.jsonl'.
 *     - thresholds: { keyRate?: 0.30, roomRate?: 0.50, msgRate?: 0.40 } — 모두 추정.
 *
 * 엣지:
 *   1) 파일 부재 → counts 0 / ok=false / reason='no-data'
 *   2) landing=0 → keyRate=0, ok=false
 *   3) malformed JSON line → 무시 + stderr 경고, 정상 라인만 집계
 *   4) sid+event 첫 발생만 카운트 (set 기반)
 *   5) 미래 ts (now+1d 이상) → 무시
 *
 * 사용 (CLI):
 *   $ node scripts/check-byok-funnel.mjs --pings-path=data/analytics_pings.jsonl
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VALID_EVENTS = new Set(["landing", "key_added", "room_entered", "msg_sent"]);
const VALID_PROVIDERS = new Set([
  "claude",
  "gemini",
  "chatgpt",
  "grok",
  "deepseek",
]);
const SID_REGEX = /^[0-9a-f]{8}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_THRESHOLDS = { keyRate: 0.30, roomRate: 0.50, msgRate: 0.40 };
const DEFAULT_PINGS_PATH = "data/analytics_pings.jsonl";

function envPingsPath() {
  const v = process.env.ANALYTICS_PINGS_PATH;
  return typeof v === "string" && v.length > 0 ? v : DEFAULT_PINGS_PATH;
}

function readOrNull(p) {
  try {
    return readFileSync(resolve(process.cwd(), p), "utf8");
  } catch {
    return null;
  }
}

function isKstIso(s) {
  return typeof s === "string" && /\+09:00$/.test(s);
}

export default function checkByokFunnel({ pingsPath, thresholds } = {}) {
  const path = pingsPath ?? envPingsPath();
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  const text = readOrNull(path);

  const counts = { landing: 0, key: 0, room: 0, msg: 0 };
  if (text === null) {
    return {
      ok: false,
      counts,
      rates: { keyRate: 0, roomRate: 0, msgRate: 0 },
      reason: "no-data",
    };
  }

  const seen = {
    landing: new Set(),
    key: new Set(),
    room: new Set(),
    msg: new Set(),
  };
  const futureCutoffMs = Date.now() + ONE_DAY_MS;

  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      console.error("check-byok-funnel: malformed JSON line skipped");
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const { event, sid, ts } = obj;
    if (!VALID_EVENTS.has(event)) continue;
    if (typeof sid !== "string" || !SID_REGEX.test(sid)) continue;
    if (!isKstIso(ts)) continue;
    const tsMs = new Date(ts).getTime();
    if (!Number.isFinite(tsMs)) continue;
    if (tsMs > futureCutoffMs) continue;

    if (event === "landing") {
      if (!seen.landing.has(sid)) {
        seen.landing.add(sid);
        counts.landing++;
      }
    } else if (event === "key_added") {
      if (!VALID_PROVIDERS.has(obj.provider)) continue;
      if (!seen.key.has(sid)) {
        seen.key.add(sid);
        counts.key++;
      }
    } else if (event === "room_entered") {
      if (typeof obj.room_id !== "string" || obj.room_id.length === 0) continue;
      if (!seen.room.has(sid)) {
        seen.room.add(sid);
        counts.room++;
      }
    } else if (event === "msg_sent") {
      if (typeof obj.room_id !== "string" || obj.room_id.length === 0) continue;
      if (typeof obj.len !== "number" || !Number.isFinite(obj.len)) continue;
      if (!seen.msg.has(sid)) {
        seen.msg.add(sid);
        counts.msg++;
      }
    }
  }

  const keyRate = counts.landing > 0 ? counts.key / counts.landing : 0;
  const roomRate = counts.key > 0 ? counts.room / counts.key : 0;
  const msgRate = counts.room > 0 ? counts.msg / counts.room : 0;
  const rates = {
    keyRate: Math.round(keyRate * 10000) / 10000,
    roomRate: Math.round(roomRate * 10000) / 10000,
    msgRate: Math.round(msgRate * 10000) / 10000,
  };
  const ok =
    keyRate >= t.keyRate && roomRate >= t.roomRate && msgRate >= t.msgRate;

  return { ok, counts, rates };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    pingsPath: get("pings-path"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkByokFunnel({
    pingsPath: args.pingsPath ?? undefined,
  });
  console.log(JSON.stringify({ byokFunnel: result }));
  console.log(
    `check:byok-funnel ok=${result.ok} landing=${result.counts.landing} key=${result.counts.key} room=${result.counts.room} msg=${result.counts.msg} keyRate=${result.rates.keyRate} roomRate=${result.rates.roomRate} msgRate=${result.rates.msgRate}${result.reason ? ` reason=${result.reason}` : ""}`,
  );
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
