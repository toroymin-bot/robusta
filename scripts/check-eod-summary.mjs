#!/usr/bin/env node
/**
 * check-eod-summary.mjs
 *   - C-D63-2 (D-Day 21시 EOD §11, 2026-05-08) — Tori spec C-D63-2 (F-D63-1 본체 read-only).
 *
 * Why: D-Day 12 슬롯 × 14h 통합 통계 산식 검증의 SoT 자동화.
 *   외부 네트워크 호출 0 (verify:d63 G5 회귀 보호). 입력은 CLI args 기반.
 *
 * 함수 시그니처 (export):
 *   checkEodSummary({
 *     startKst, endKst, commits,
 *     verifyAllStart, verifyAllEnd,
 *     hardGateCycleStart, hardGateCycleEnd,
 *     regressTotalStart, regressTotalEnd,
 *   })
 *     -> {
 *       durationHours, commitCount,
 *       verifyAllRange, hardGateCycleRange,
 *       regressDelta, ok, issues
 *     }
 *
 * 검증 산식:
 *   - durationHours = (endKst - startKst) / 3600000ms — 14h ≤ X ≤ 24h
 *   - commitCount = commits.length (≥0)
 *   - verifyAllRange[1] >= verifyAllRange[0] 단조 증가
 *   - hardGateCycleRange[1] >= hardGateCycleRange[0] 단조 증가
 *   - regressDelta = regressTotalEnd - regressTotalStart (≥0)
 *   - commits 모두 7-char 또는 40-char 16진수
 *   - ok = 모든 위 조건 통과
 *
 * 입력 가드:
 *   - startKst / endKst Invalid Date → ok=false / issues.push('invalid timestamp')
 *
 * 사용 (CLI):
 *   $ node scripts/check-eod-summary.mjs \
 *       --start=2026-05-08T01:00:00+09:00 \
 *       --end=2026-05-08T21:00:00+09:00 \
 *       --commits=2b03769,e8dc4f0,49ca788,b5a97f5 \
 *       --verify-all-start=39 --verify-all-end=42 \
 *       --hard-gate-start=31 --hard-gate-end=34 \
 *       --regress-start=759 --regress-end=814
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const DURATION_MIN_HOURS = 14;
const DURATION_MAX_HOURS = 24;
const COMMIT_HEX_SHORT = 7;
const COMMIT_HEX_FULL = 40;

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  const num = (k) => {
    const v = get(k);
    return v === null ? null : Number(v);
  };
  const list = (k) => {
    const v = get(k);
    if (v === null) return [];
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };
  return {
    startKst: get("start"),
    endKst: get("end"),
    commits: list("commits"),
    verifyAllStart: num("verify-all-start"),
    verifyAllEnd: num("verify-all-end"),
    hardGateCycleStart: num("hard-gate-start"),
    hardGateCycleEnd: num("hard-gate-end"),
    regressTotalStart: num("regress-start"),
    regressTotalEnd: num("regress-end"),
  };
}

function isCommitHex(s) {
  if (typeof s !== "string") return false;
  if (s.length !== COMMIT_HEX_SHORT && s.length !== COMMIT_HEX_FULL) return false;
  return /^[0-9a-f]+$/.test(s);
}

/**
 * checkEodSummary — D-Day EOD 통합 통계 산식 검증 (read-only).
 */
export function checkEodSummary(input = {}) {
  const issues = [];
  const {
    startKst,
    endKst,
    commits = [],
    verifyAllStart,
    verifyAllEnd,
    hardGateCycleStart,
    hardGateCycleEnd,
    regressTotalStart,
    regressTotalEnd,
  } = input;

  // duration 산출 + 가드.
  let durationHours = 0;
  const startMs = new Date(startKst).getTime();
  const endMs = new Date(endKst).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    issues.push("invalid timestamp");
  } else if (endMs < startMs) {
    issues.push("end before start");
  } else {
    durationHours = (endMs - startMs) / ONE_HOUR_MS;
    if (durationHours < DURATION_MIN_HOURS) {
      issues.push(`durationHours ${durationHours} < ${DURATION_MIN_HOURS}`);
    }
    if (durationHours > DURATION_MAX_HOURS) {
      issues.push(`durationHours ${durationHours} > ${DURATION_MAX_HOURS}`);
    }
  }

  // commits 검증.
  const commitArr = Array.isArray(commits) ? commits : [];
  const commitCount = commitArr.length;
  for (const c of commitArr) {
    if (!isCommitHex(c)) {
      issues.push(`commit format invalid: ${c}`);
    }
  }

  // verify:all 단조 증가.
  const verifyAllRange = [
    Number.isFinite(verifyAllStart) ? verifyAllStart : 0,
    Number.isFinite(verifyAllEnd) ? verifyAllEnd : 0,
  ];
  if (verifyAllRange[1] < verifyAllRange[0]) {
    issues.push("verify:all monotone violation");
  }

  // 168 정식 HARD GATE 사이클 단조 증가.
  const hardGateCycleRange = [
    Number.isFinite(hardGateCycleStart) ? hardGateCycleStart : 0,
    Number.isFinite(hardGateCycleEnd) ? hardGateCycleEnd : 0,
  ];
  if (hardGateCycleRange[1] < hardGateCycleRange[0]) {
    issues.push("hard-gate-cycle monotone violation");
  }

  // 누적 회귀 delta (≥0 의무).
  const regressDelta =
    (Number.isFinite(regressTotalEnd) ? regressTotalEnd : 0) -
    (Number.isFinite(regressTotalStart) ? regressTotalStart : 0);
  if (regressDelta < 0) {
    issues.push(`regress delta negative: ${regressDelta}`);
  }

  return {
    durationHours,
    commitCount,
    verifyAllRange,
    hardGateCycleRange,
    regressDelta,
    ok: issues.length === 0,
    issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkEodSummary(args);
  console.log(JSON.stringify({ eodSummary: result }));
  console.log(
    `check:eod-summary ok=${result.ok} duration=${result.durationHours}h commits=${result.commitCount} verify:all=${result.verifyAllRange.join("→")} 168=${result.hardGateCycleRange.join("→")} regress+${result.regressDelta}`,
  );
  if (!result.ok) {
    console.error(`issues: ${result.issues.join(" / ")}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
