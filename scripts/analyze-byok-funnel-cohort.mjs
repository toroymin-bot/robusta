#!/usr/bin/env node
/**
 * analyze-byok-funnel-cohort.mjs
 *   - C-D68-2 (D+1 19시 §10 슬롯, 2026-05-09) — Tori spec C-D68-2 (§22.5.2).
 *
 * Why: BYOK cohort 일별 retention 분석 (D+7 5/15 1주차 retention 측정 등).
 *   visitor 첫 visit 일자 기준 cohort_key 부여 + 이후 cohortDays(기본 7)일 attempt|success 활동 retained 카운트.
 *   외부 fetch 0건 / Dexie 미접근 / 정적 read-only.
 *
 * 자율 정정 큐 (D-68-자-2):
 *   환경 변수 ANALYTICS_PINGS_PATH 로 NDJSON 파일 경로 override 가능 (D-67-자-2 정합).
 *
 * 함수 시그니처 (named export, §22.5.2 본체 lock 정합):
 *   analyzeByokFunnelCohort(
 *     pings: Array<{ ts: string, kind: 'visit'|'attempt'|'success', visitorId: string }>,
 *     opts?: { tzOffset?: string, cohortDays?: number }
 *   ) -> {
 *     cohorts: Array<{ cohort_key: string, size: number, retained: number[] }>,
 *     summary: { keys: number, retained_avg: number },
 *   }
 *
 * 입출력 정의:
 *   pings 인자 미지정 시 env ANALYTICS_PINGS_PATH NDJSON 파일 로드 (한 줄 1 ping JSON).
 *   opts.tzOffset    기본 '+09:00'.
 *   opts.cohortDays  retention 측정 일수, 기본 7.
 *   cohorts[].cohort_key  'YYYY-MM-DD' (visitor 첫 visit 일자, KST 기준), 정렬 오름차순.
 *   cohorts[].size        cohort 신규 visitor 수.
 *   cohorts[].retained    길이 cohortDays 정수 배열, idx i = i일 후 attempt|success 활동 visitor 수.
 *   summary.keys          cohort_key 개수.
 *   summary.retained_avg  전 cohort 통합 retention 비율 (sum(retained_total)/(sum(size)*cohortDays)*100, 소수점 2자리).
 *
 * 엣지 케이스:
 *   1) pings 빈 배열 + 파일 부재 → cohorts=[], summary={keys:0, retained_avg:0}.
 *   2) visitorId 누락 → 무시 (집계 제외).
 *   3) 동일 visitorId 다중 visit → cohort_key는 가장 빠른 visit ts 기준.
 *   4) 잘못된 kind → 무시.
 *   5) ts 비-ISO/+09:00 → 무시.
 *   6) ts 파싱 실패 → 무시.
 *
 * 사용 (CLI):
 *   $ node scripts/analyze-byok-funnel-cohort.mjs \
 *       --pings-path=data/analytics_pings.jsonl \
 *       --cohort-days=7
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VALID_KINDS = new Set(["visit", "attempt", "success"]);
const RETAINED_KINDS = new Set(["attempt", "success"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TZ_OFFSET = "+09:00";
const DEFAULT_COHORT_DAYS = 7;

function envPingsPath() {
  const v = process.env.ANALYTICS_PINGS_PATH;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function readPingsFile(p) {
  try {
    const text = readFileSync(resolve(process.cwd(), p), "utf8");
    const out = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line.length === 0) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        console.error("analyze-byok-funnel-cohort: malformed JSON line skipped");
      }
    }
    return out;
  } catch {
    return [];
  }
}

function isIsoWithOffset(s) {
  return typeof s === "string" && /[+-]\d{2}:\d{2}$/.test(s);
}

function dayLabelKst(ms) {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function dayStartMsKst(label) {
  // label = 'YYYY-MM-DD' interpreted as KST 00:00 → return UTC ms.
  const [y, m, d] = label.split("-").map((s) => parseInt(s, 10));
  return Date.UTC(y, m - 1, d) - 9 * 60 * 60 * 1000;
}

export function analyzeByokFunnelCohort(pings, opts) {
  const o = opts || {};
  const tzOffset = o.tzOffset ?? DEFAULT_TZ_OFFSET;
  const cohortDays = o.cohortDays ?? DEFAULT_COHORT_DAYS;
  if (typeof tzOffset !== "string") {
    throw new Error("tzOffset must be string");
  }
  if (typeof cohortDays !== "number" || !Number.isFinite(cohortDays) || cohortDays <= 0) {
    throw new Error("cohortDays must be > 0");
  }

  let resolvedPings = pings;
  if (!Array.isArray(resolvedPings)) {
    const p = envPingsPath();
    resolvedPings = p ? readPingsFile(p) : [];
  }

  // visitor → { firstVisitMs, days: Set<dayLabel KST> with attempt|success }
  const visitors = new Map();

  for (const ping of resolvedPings) {
    if (!ping || typeof ping !== "object") continue;
    const { ts, kind, visitorId } = ping;
    if (typeof visitorId !== "string" || visitorId.length === 0) continue;
    if (!VALID_KINDS.has(kind)) continue;
    if (!isIsoWithOffset(ts)) continue;
    const tsMs = new Date(ts).getTime();
    if (!Number.isFinite(tsMs)) continue;

    let v = visitors.get(visitorId);
    if (!v) {
      v = { firstVisitMs: null, retainedDays: new Set() };
      visitors.set(visitorId, v);
    }
    if (kind === "visit") {
      if (v.firstVisitMs === null || tsMs < v.firstVisitMs) {
        v.firstVisitMs = tsMs;
      }
    }
    if (RETAINED_KINDS.has(kind)) {
      v.retainedDays.add(dayLabelKst(tsMs));
    }
  }

  // Group visitors by cohort_key (first visit day in KST). Visitors with no visit (only attempt/success) are skipped.
  const cohortMap = new Map();
  for (const [vid, v] of visitors) {
    if (v.firstVisitMs === null) continue;
    const cohortKey = dayLabelKst(v.firstVisitMs);
    let bucket = cohortMap.get(cohortKey);
    if (!bucket) {
      bucket = { cohort_key: cohortKey, visitors: [] };
      cohortMap.set(cohortKey, bucket);
    }
    bucket.visitors.push(v);
    void vid;
  }

  const cohortKeys = Array.from(cohortMap.keys()).sort();
  const cohorts = [];
  let totalRetained = 0;
  let totalSlots = 0;
  for (const key of cohortKeys) {
    const bucket = cohortMap.get(key);
    const size = bucket.visitors.length;
    const cohortStartMs = dayStartMsKst(key);
    const retained = new Array(cohortDays).fill(0);
    for (let i = 0; i < cohortDays; i++) {
      const dayMs = cohortStartMs + i * ONE_DAY_MS;
      const dayLabel = dayLabelKst(dayMs);
      let count = 0;
      for (const v of bucket.visitors) {
        if (v.retainedDays.has(dayLabel)) count++;
      }
      retained[i] = count;
      totalRetained += count;
    }
    totalSlots += size * cohortDays;
    cohorts.push({ cohort_key: key, size, retained });
  }

  const retainedAvgRaw = totalSlots > 0 ? (totalRetained / totalSlots) * 100 : 0;
  const retainedAvg = Math.round(retainedAvgRaw * 100) / 100;
  const summary = { keys: cohorts.length, retained_avg: retainedAvg };

  return { cohorts, summary };
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    let pings;
    if (args.pingsPath) {
      pings = readPingsFile(args.pingsPath);
    }
    const cohortDays = args.cohortDays === null
      ? undefined
      : parseInt(args.cohortDays, 10);
    const result = analyzeByokFunnelCohort(pings, { cohortDays });
    console.log(JSON.stringify({ byokFunnelCohort: result }));
    console.log(
      `analyze:byok-cohort keys=${result.summary.keys} retained_avg=${result.summary.retained_avg}%`,
    );
    process.exit(0);
  } catch (e) {
    console.error(`analyze:byok-cohort ERROR: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
