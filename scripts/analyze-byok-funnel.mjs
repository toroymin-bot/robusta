#!/usr/bin/env node
/**
 * analyze-byok-funnel.mjs
 *   - C-D66-2 (D+1 11시 §6 슬롯, 2026-05-09) — Tori spec C-D66-2 (F-D66-2 본체).
 *
 * Why: BYOK 펀넬 분석 단일 명령 (잡스 단순함).
 *   analytics_pings.jsonl aggregate → counts/rates/providers/durationHours JSON 출력.
 *   외부 fetch 0건 / Dexie 미접근 / 정적 파일 read-only.
 *
 * 자율 정정:
 *   - D-66-자-2: 환경 변수 ANALYTICS_PINGS_PATH 로 pingsPath override 가능 (D-65-자-2 정합).
 *   - D-65-자-3: sid 8자 hex 정규식 (/^[0-9a-f]{8}$/) 위반 라인 무시.
 *
 * 4 이벤트 스키마 (§15.1 lock):
 *   landing      { ts (ISO +09:00), sid (8자 hex) }
 *   key_added    { ts, sid, provider in {claude,gemini,chatgpt,grok,deepseek} }
 *   room_entered { ts, sid, room_id (string non-empty) }
 *   msg_sent     { ts, sid, room_id, len (정수) }
 *
 * providers 6종 lock (§18.1):
 *   claude / gemini / chatgpt / grok / deepseek / unknown
 *
 * 함수 시그니처 (default export):
 *   analyzeByokFunnel({ pingsPath?, sinceKst?, untilKst? })
 *     -> { counts, rates, providers, durationHours }
 *
 * 출력 형식:
 *   counts        = { landing, key_added, room_entered, msg_sent }
 *   rates         = { keyRate, roomRate, msgRate } (소수점 4자리)
 *   providers     = { claude, gemini, chatgpt, grok, deepseek, unknown } (key_added 분포)
 *   durationHours = sinceKst∼untilKst 시간차 (옵션 미명시 시 데이터 min/max ts 기준)
 *
 * 엣지:
 *   1) 파일 부재 → counts/rates/providers 모두 0, durationHours=0.
 *   2) sinceKst > untilKst → throw Error('sinceKst must be <= untilKst')
 *   3) sid 정규식 위반 → 라인 무시.
 *   4) event 4종 외 → 라인 무시.
 *   5) provider 5종 외 (key_added) → providers.unknown 카운트.
 *   6) JSON parse 실패 → 무시 + stderr 경고.
 *
 * 사용 (CLI):
 *   $ node scripts/analyze-byok-funnel.mjs \
 *       --pings-path=data/analytics_pings.jsonl \
 *       --since=2026-05-08T07:00:00+09:00 \
 *       --until=2026-05-09T22:00:00+09:00
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
const ONE_HOUR_MS = 60 * 60 * 1000;

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

function emptyResult() {
  return {
    counts: { landing: 0, key_added: 0, room_entered: 0, msg_sent: 0 },
    rates: { keyRate: 0, roomRate: 0, msgRate: 0 },
    providers: { claude: 0, gemini: 0, chatgpt: 0, grok: 0, deepseek: 0, unknown: 0 },
    durationHours: 0,
  };
}

export default function analyzeByokFunnel({ pingsPath, sinceKst, untilKst } = {}) {
  const path = pingsPath ?? envPingsPath();

  let sinceMs = null;
  let untilMs = null;
  if (sinceKst !== undefined && sinceKst !== null) {
    if (!isKstIso(sinceKst)) throw new Error("sinceKst must be ISO with +09:00");
    sinceMs = new Date(sinceKst).getTime();
  }
  if (untilKst !== undefined && untilKst !== null) {
    if (!isKstIso(untilKst)) throw new Error("untilKst must be ISO with +09:00");
    untilMs = new Date(untilKst).getTime();
  }
  if (sinceMs !== null && untilMs !== null && sinceMs > untilMs) {
    throw new Error("sinceKst must be <= untilKst");
  }

  const text = readOrNull(path);
  if (text === null) return emptyResult();

  const counts = { landing: 0, key_added: 0, room_entered: 0, msg_sent: 0 };
  const providers = { claude: 0, gemini: 0, chatgpt: 0, grok: 0, deepseek: 0, unknown: 0 };
  const seen = {
    landing: new Set(),
    key_added: new Set(),
    room_entered: new Set(),
    msg_sent: new Set(),
  };

  let minTsMs = Infinity;
  let maxTsMs = -Infinity;

  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      console.error("analyze-byok-funnel: malformed JSON line skipped");
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const { event, sid, ts } = obj;
    if (!VALID_EVENTS.has(event)) continue;
    if (typeof sid !== "string" || !SID_REGEX.test(sid)) continue;
    if (!isKstIso(ts)) continue;
    const tsMs = new Date(ts).getTime();
    if (!Number.isFinite(tsMs)) continue;
    if (sinceMs !== null && tsMs < sinceMs) continue;
    if (untilMs !== null && tsMs > untilMs) continue;

    if (event === "landing") {
      if (!seen.landing.has(sid)) {
        seen.landing.add(sid);
        counts.landing++;
      }
    } else if (event === "key_added") {
      if (!seen.key_added.has(sid)) {
        seen.key_added.add(sid);
        counts.key_added++;
        const prov = typeof obj.provider === "string" && VALID_PROVIDERS.has(obj.provider)
          ? obj.provider
          : "unknown";
        providers[prov]++;
      }
    } else if (event === "room_entered") {
      if (typeof obj.room_id !== "string" || obj.room_id.length === 0) continue;
      if (!seen.room_entered.has(sid)) {
        seen.room_entered.add(sid);
        counts.room_entered++;
      }
    } else if (event === "msg_sent") {
      if (typeof obj.room_id !== "string" || obj.room_id.length === 0) continue;
      if (typeof obj.len !== "number" || !Number.isFinite(obj.len)) continue;
      if (!seen.msg_sent.has(sid)) {
        seen.msg_sent.add(sid);
        counts.msg_sent++;
      }
    }
    if (tsMs < minTsMs) minTsMs = tsMs;
    if (tsMs > maxTsMs) maxTsMs = tsMs;
  }

  const keyRate = counts.landing > 0 ? counts.key_added / counts.landing : 0;
  const roomRate = counts.key_added > 0 ? counts.room_entered / counts.key_added : 0;
  const msgRate = counts.room_entered > 0 ? counts.msg_sent / counts.room_entered : 0;
  const rates = {
    keyRate: Math.round(keyRate * 10000) / 10000,
    roomRate: Math.round(roomRate * 10000) / 10000,
    msgRate: Math.round(msgRate * 10000) / 10000,
  };

  let durationHours = 0;
  if (sinceMs !== null && untilMs !== null) {
    durationHours = Math.round(((untilMs - sinceMs) / ONE_HOUR_MS) * 100) / 100;
  } else if (Number.isFinite(minTsMs) && Number.isFinite(maxTsMs) && maxTsMs >= minTsMs) {
    durationHours = Math.round(((maxTsMs - minTsMs) / ONE_HOUR_MS) * 100) / 100;
  }

  return { counts, rates, providers, durationHours };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    pingsPath: get("pings-path"),
    sinceKst: get("since"),
    untilKst: get("until"),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = analyzeByokFunnel({
      pingsPath: args.pingsPath ?? undefined,
      sinceKst: args.sinceKst ?? undefined,
      untilKst: args.untilKst ?? undefined,
    });
    console.log(JSON.stringify({ byokFunnelAnalysis: result }));
    const c = result.counts;
    const r = result.rates;
    console.log(
      `analyze:byok-funnel landing=${c.landing} key=${c.key_added} room=${c.room_entered} msg=${c.msg_sent} keyRate=${r.keyRate} roomRate=${r.roomRate} msgRate=${r.msgRate} durationHours=${result.durationHours}`,
    );
    process.exit(0);
  } catch (e) {
    console.error(`analyze:byok-funnel ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
