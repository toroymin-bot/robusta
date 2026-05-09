#!/usr/bin/env node
/**
 * analyze-byok-funnel-cohort-retention.mjs
 *   - C-D69-2 ⭐ (D+1 23시 §12 슬롯, 2026-05-09) — Tori spec C-D69-2 (§24.6.2).
 *
 * Why: cohort 일별 retention curve(D1/D7/D14/D30) + BYOK→첫 다자 대화 time-to-value(p50) 분석.
 *   F-D69-1 정합 / B-D69-2 정책 본체 정합. 외부 fetch 0건 / Dexie 미접근 / 정적 read-only.
 *
 * 자율 정정 큐 (D-69-자-2):
 *   환경 변수 ANALYTICS_PINGS_PATH 로 NDJSON 파일 경로 override 가능 (D-67/D-68 미러).
 *
 * 함수 시그니처 (named export, §24.6.2 본체 lock 정합):
 *   analyzeByokFunnelCohortRetention({
 *     pingsPath?: string,
 *     cohortDays?: number[],
 *   }) -> Promise<{ cohorts: Array<{ day0, n, d1, d7, d14, d30, ttv_ms_p50 }> }>
 *
 * 입출력 정의:
 *   pingsPath  default process.env.ANALYTICS_PINGS_PATH || './logs/analytics.jsonl'.
 *   cohortDays default [1, 7, 14, 30].
 *   각 cohort:
 *     day0           cohort 첫 byok_activated KST 일자 ('YYYY-MM-DD').
 *     n              cohort 내 byok_activated user 수.
 *     d1∼d30         cohort 내 user 중 day0 + N일에 first_chat ping이 있는 비율 (소수 4자리).
 *                    n < 5 시 모두 null (표본 부족 lock).
 *     ttv_ms_p50     byok_activated → 첫 first_chat 시간차 ms 50th percentile (n < 5 시 null).
 *
 * 입력 ping 스키마: { ts_iso, user_id, event: 'byok_activated' | 'first_chat' }
 *
 * 엣지 케이스:
 *   1) pingsPath 미존재 → throw ENOENT (Node fs 표준 에러 그대로 전파).
 *   2) 빈 파일 → { cohorts: [] }.
 *   3) JSONL 1줄 파싱 실패 → skip + warn.
 *   4) cohort n < 5 → d_N + ttv_ms_p50 모두 null.
 *   5) byok_activated 없는 user 의 first_chat → skip (cohort 미할당).
 *
 * 사용 (CLI):
 *   $ node scripts/analyze-byok-funnel-cohort-retention.mjs --pings-path=data/analytics.jsonl
 *   $ ANALYTICS_PINGS_PATH=data/a.jsonl node scripts/analyze-byok-funnel-cohort-retention.mjs
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_COHORT_DAYS = [1, 7, 14, 30];
const DEFAULT_PINGS_PATH = "./logs/analytics.jsonl";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const COHORT_MIN_N = 5;

function envPingsPath() {
  const v = process.env.ANALYTICS_PINGS_PATH;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function readPingsFile(p) {
  const text = readFileSync(resolve(process.cwd(), p), "utf8");
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      console.error("analyze-byok-funnel-cohort-retention: malformed JSON line skipped");
    }
  }
  return out;
}

function dayLabelKst(ms) {
  const d = new Date(ms + KST_OFFSET_MS);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function dayStartMsKst(label) {
  const [y, m, d] = label.split("-").map((s) => parseInt(s, 10));
  return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

function isIsoWithOffset(s) {
  return typeof s === "string" && /[+-]\d{2}:\d{2}$/.test(s);
}

function percentileP50(sorted) {
  if (sorted.length === 0) return null;
  const mid = Math.floor((sorted.length - 1) / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid] + sorted[mid + 1]) / 2);
}

export async function analyzeByokFunnelCohortRetention(opts) {
  const o = opts || {};
  const cohortDays = Array.isArray(o.cohortDays) && o.cohortDays.length > 0
    ? o.cohortDays
    : DEFAULT_COHORT_DAYS;
  const pingsPath = typeof o.pingsPath === "string" && o.pingsPath.length > 0
    ? o.pingsPath
    : (envPingsPath() ?? DEFAULT_PINGS_PATH);

  const pings = readPingsFile(pingsPath);
  if (pings.length === 0) {
    return { cohorts: [] };
  }

  // user → { byokAtMs, firstChatMs, chatDays: Set<dayLabel KST> }
  const users = new Map();

  for (const ping of pings) {
    if (!ping || typeof ping !== "object") continue;
    const { ts_iso, user_id, event } = ping;
    if (typeof user_id !== "string" || user_id.length === 0) continue;
    if (!isIsoWithOffset(ts_iso)) continue;
    const tsMs = new Date(ts_iso).getTime();
    if (!Number.isFinite(tsMs)) continue;

    let u = users.get(user_id);
    if (!u) {
      u = { byokAtMs: null, firstChatMs: null, chatDays: new Set() };
      users.set(user_id, u);
    }
    if (event === "byok_activated") {
      if (u.byokAtMs === null || tsMs < u.byokAtMs) {
        u.byokAtMs = tsMs;
      }
    } else if (event === "first_chat") {
      if (u.firstChatMs === null || tsMs < u.firstChatMs) {
        u.firstChatMs = tsMs;
      }
      u.chatDays.add(dayLabelKst(tsMs));
    }
  }

  // Group users into cohorts by their byok_activated day0 (KST). Skip users without byok_activated.
  const cohortMap = new Map();
  for (const [uid, u] of users) {
    if (u.byokAtMs === null) continue;
    const day0 = dayLabelKst(u.byokAtMs);
    let bucket = cohortMap.get(day0);
    if (!bucket) {
      bucket = { day0, users: [] };
      cohortMap.set(day0, bucket);
    }
    bucket.users.push(u);
    void uid;
  }

  const sortedKeys = Array.from(cohortMap.keys()).sort();
  const cohorts = [];
  for (const day0 of sortedKeys) {
    const bucket = cohortMap.get(day0);
    const n = bucket.users.length;
    const cohort = { day0, n };
    if (n < COHORT_MIN_N) {
      for (const N of cohortDays) cohort[`d${N}`] = null;
      cohort.ttv_ms_p50 = null;
      cohorts.push(cohort);
      continue;
    }
    const cohortStartMs = dayStartMsKst(day0);
    for (const N of cohortDays) {
      const targetLabel = dayLabelKst(cohortStartMs + N * ONE_DAY_MS);
      let active = 0;
      for (const u of bucket.users) {
        if (u.chatDays.has(targetLabel)) active++;
      }
      cohort[`d${N}`] = Math.round((active / n) * 10000) / 10000;
    }
    const ttvList = bucket.users
      .filter((u) => u.firstChatMs !== null && u.byokAtMs !== null)
      .map((u) => u.firstChatMs - u.byokAtMs)
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);
    cohort.ttv_ms_p50 = percentileP50(ttvList);
    cohorts.push(cohort);
  }

  return { cohorts };
}

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    pingsPath: get("pings-path"),
    cohortDays: get("cohort-days"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const cohortDays = args.cohortDays
      ? args.cohortDays.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
      : undefined;
    const result = await analyzeByokFunnelCohortRetention({
      pingsPath: args.pingsPath ?? undefined,
      cohortDays,
    });
    console.log(JSON.stringify({ byokFunnelCohortRetention: result }));
    console.log(`analyze:byok-cohort-retention cohorts=${result.cohorts.length}`);
    process.exit(0);
  } catch (e) {
    console.error(`analyze:byok-cohort-retention ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
