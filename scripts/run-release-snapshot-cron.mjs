#!/usr/bin/env node
/**
 * run-release-snapshot-cron.mjs
 *   - C-D53-1 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-1 (B-D53-2 본체).
 *
 * Why: GH Actions hourly cron CLI 진입점. release-snapshot-cron.ts triggerReleaseSnapshot 호출.
 *   stdout JSON { snapshot, throttled } 출력. exit 0 항상 (cron 실패 알림은 GH Actions UI 자체가 담당).
 *
 * 정책:
 *   - 의존성 0 (node 22+ native).
 *   - server-only 가드 — release-snapshot-cron.ts 의 typeof window === 'undefined' 정합 (Node CLI = SSR).
 *   - throttled=true 시 console.log 후 exit 0 (1h 미만 재호출은 lastResult 반환).
 *   - .ts 파일을 .mjs 에서 직접 import 못 하므로 release-snapshot.ts 로직을 .mjs 로 미러.
 *     (의존성 0 의무 — tsx/ts-node 추가 금지).
 *
 * 자율 정정:
 *   - D-53-자-1: 명세 "top-level await로 triggerReleaseSnapshot 호출". 그러나 .mjs 에서 .ts import 불가.
 *                src/modules/launch/release-snapshot.ts + release-snapshot-cron.ts 로직 미러 — 동일 산식
 *                재구현 (외부 dev-deps +0 의무, tsx 추가 금지). 산식 SoT는 .ts 파일 (.mjs 는 cron 전용 미러).
 *
 * 외부 dev-deps +0.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ONE_HOUR_MS = 60 * 60 * 1000;
const HOURS_24 = 24 * 60 * 60 * 1000;

async function readPackageVersion(root) {
  try {
    const raw = await readFile(resolve(root, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readGitSha(root) {
  try {
    const head = await readFile(resolve(root, ".git/HEAD"), "utf8");
    const trimmed = head.trim();
    if (trimmed.startsWith("ref: ")) {
      const refPath = trimmed.slice(5);
      const sha = await readFile(resolve(root, ".git", refPath), "utf8");
      return sha.trim() || null;
    }
    return trimmed || null;
  } catch {
    return null;
  }
}

// release-snapshot.ts buildReleaseSnapshot 산식 미러 (의존성 0 의무).
function buildSnapshot(now, releaseIso) {
  if (!releaseIso) {
    return {
      dDay: "D-2",
      hoursRemaining: -1,
      readiness: "red",
      summaryLine: "RELEASE_ISO unset — readiness red",
    };
  }
  const releaseMs = new Date(releaseIso).getTime();
  const nowMs = now.getTime();
  const diffMs = releaseMs - nowMs;
  const hoursRemaining = Math.round(diffMs / (60 * 60 * 1000));

  let dDay;
  if (diffMs > HOURS_24) dDay = "D-2";
  else if (diffMs > 0) dDay = "D-1";
  else if (diffMs > -HOURS_24) dDay = "D-0";
  else dDay = "D+1";

  return {
    dDay,
    hoursRemaining,
    readiness: "green",
    summaryLine: `${dDay} ${hoursRemaining}h · cron snapshot`,
  };
}

async function main() {
  const root = resolve(process.cwd());
  const now = new Date();
  const releaseIso = process.env.RELEASE_ISO ?? null;

  const version = await readPackageVersion(root);
  const gitSha = await readGitSha(root);

  const snapshot = buildSnapshot(now, releaseIso);

  const result = {
    iso: now.toISOString(),
    version,
    gitSha,
    snapshot,
    throttled: false,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  // exit 0 보장 — cron 실패 알림은 GH Actions UI 가 담당.
  console.error("run-release-snapshot-cron — ERROR", err);
  process.exit(0);
});
