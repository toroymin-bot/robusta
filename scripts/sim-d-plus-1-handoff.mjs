#!/usr/bin/env node
/**
 * sim-d-plus-1-handoff.mjs
 *   - C-D64-4 (D+1 03시 §2 슬롯, 2026-05-09) — Tori spec C-D64-4 (C-D64-1 보조).
 *
 * Why: C-D64-1 check-d-plus-1-handoff.mjs 의 6 케이스 매트릭스 dry-run 시뮬레이터.
 *   각 케이스 expected ok 값 hardcoded + 실 실행 결과 매칭 + 100% 일치 의무.
 *
 * 케이스 매트릭스 (6건):
 *   case1: 정각 (09:00:00 KST) + report 3줄 + KQ_24/25 응답 + show-hn 4-row → ok=true / offsetMinutes=0
 *   case2: +14분 → ok=true
 *   case3: +16분 → ok=false / withinWindow=false
 *   case4: report 2줄 → reportOk=false / ok=false
 *   case5: KQ_24 응답 누락 → kqAllResolved=false / ok=false
 *   case6: show-hn-data 헤더 부재 → showHnOk=false / ok=false
 *
 * 사용 (CLI):
 *   $ node scripts/sim-d-plus-1-handoff.mjs              # all 6 cases
 *   $ node scripts/sim-d-plus-1-handoff.mjs --matrix=case3
 *   $ node scripts/sim-d-plus-1-handoff.mjs --verbose
 *
 * 외부 dev-deps +0 (node 표준만). fetch 0건. 임시 파일은 os.tmpdir() 에서만 생성.
 */

import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDPlus1Handoff } from "./check-d-plus-1-handoff.mjs";

const SLOT_KST = "2026-05-09T09:00:00+09:00";

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    matrix: get("matrix") ?? "all",
    verbose: argv.includes("--verbose"),
  };
}

function setupCase(name, opts) {
  const dir = mkdtempSync(join(tmpdir(), "d-plus-1-handoff-sim-"));
  // Report 3줄 (또는 2줄, opts에 따라).
  const reportLines = opts.reportLines ?? [
    "Line 1 — D+1 09:00 KST handoff 시점 verify:all PASS",
    "Line 2 — Roy shownhScore 입력 + KQ_24/25 응답 docs lock",
    "Line 3 — Show HN T+35h 4-row 데이터 정합 PASS",
  ];
  const reportPath = join(dir, "report.md");
  writeFileSync(reportPath, reportLines.join("\n"), "utf8");

  // KQ 응답 alt path (kqResolveDir 옵션 사용).
  const kqDir = join(dir, "kq");
  mkdirSync(kqDir, { recursive: true });
  const kqYyyymmdd = "20260509";
  if (opts.kqInBody === "include") {
    writeFileSync(
      join(kqDir, `KQ_24-RESPONSE-${kqYyyymmdd}.md`),
      "## KQ_24\n\nRoy 응답: 자동 trigger 결손 분석.\n",
      "utf8",
    );
    writeFileSync(
      join(kqDir, `KQ_25-RESPONSE-${kqYyyymmdd}.md`),
      "## KQ_25\n\nRoy 응답: §12 미확인 사실 확정.\n",
      "utf8",
    );
  } else if (opts.kqInBody === "missing-24") {
    writeFileSync(
      join(kqDir, `KQ_25-RESPONSE-${kqYyyymmdd}.md`),
      "## KQ_25\n\nRoy 응답: §12 미확인 사실 확정.\n",
      "utf8",
    );
  }

  // Show HN data.
  const showHnPath = join(dir, "show-hn.md");
  const showHnGood = [
    "# Show HN T+35h",
    "",
    "| score | comments | position | capture_ts |",
    "| --- | --- | --- | --- |",
    "| 142 | 28 | 11 | 2026-05-09T09:00:00+09:00 |",
    "",
  ].join("\n");
  const showHnHeaderMissing = [
    "# Show HN T+35h",
    "",
    "| value1 | value2 | value3 | value4 |",
    "| 142 | 28 | 11 | 2026-05-09T09:00:00+09:00 |",
    "",
  ].join("\n");
  writeFileSync(
    showHnPath,
    opts.showHnHeaderMissing ? showHnHeaderMissing : showHnGood,
    "utf8",
  );

  return { dir, reportPath, showHnPath, kqDir };
}

const CASES = [
  {
    id: "case1",
    desc: "정각 + report 3줄 + KQ 응답 + show-hn 4-row",
    nowOffsetMinutes: 0,
    setup: { kqInBody: "include" },
    kqList: "24,25",
    expected: { ok: true, withinWindow: true, reportOk: true, kqAllResolved: true, showHnOk: true },
  },
  {
    id: "case2",
    desc: "+14분",
    nowOffsetMinutes: 14,
    setup: { kqInBody: "include" },
    kqList: "24,25",
    expected: { ok: true, withinWindow: true, reportOk: true, kqAllResolved: true, showHnOk: true },
  },
  {
    id: "case3",
    desc: "+16분 (윈도우 밖)",
    nowOffsetMinutes: 16,
    setup: { kqInBody: "include" },
    kqList: "24,25",
    expected: { ok: false, withinWindow: false, reportOk: true, kqAllResolved: true, showHnOk: true },
  },
  {
    id: "case4",
    desc: "report 2줄 (3줄 의무 위반)",
    nowOffsetMinutes: 0,
    setup: {
      kqInBody: "include",
      reportLines: [
        "Line 1 — handoff 보고 라인 1",
        "Line 2 — handoff 보고 라인 2",
      ],
    },
    kqList: "24,25",
    expected: { ok: false, withinWindow: true, reportOk: false, kqAllResolved: true, showHnOk: true },
  },
  {
    id: "case5",
    desc: "KQ_24 응답 누락",
    nowOffsetMinutes: 0,
    setup: { kqInBody: "missing-24" },
    kqList: "24,25",
    expected: { ok: false, withinWindow: true, reportOk: true, kqAllResolved: false, showHnOk: true },
  },
  {
    id: "case6",
    desc: "show-hn-data 헤더 부재",
    nowOffsetMinutes: 0,
    setup: { kqInBody: "include", showHnHeaderMissing: true },
    kqList: "24,25",
    expected: { ok: false, withinWindow: true, reportOk: true, kqAllResolved: true, showHnOk: false },
  },
];

function runCase(c, verbose) {
  const ctx = setupCase(c.id, c.setup);
  try {
    const slotMs = new Date(SLOT_KST).getTime();
    const nowMs = slotMs + c.nowOffsetMinutes * 60 * 1000;
    const now = new Date(nowMs).toISOString();
    const result = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: c.kqList,
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now,
    });
    const matched =
      result.ok === c.expected.ok &&
      result.withinWindow === c.expected.withinWindow &&
      result.reportOk === c.expected.reportOk &&
      result.kqAllResolved === c.expected.kqAllResolved &&
      result.showHnOk === c.expected.showHnOk;
    if (verbose) {
      console.log(`  [${c.id}] expected=${JSON.stringify(c.expected)}`);
      console.log(`  [${c.id}] actual  =${JSON.stringify({
        ok: result.ok,
        withinWindow: result.withinWindow,
        reportOk: result.reportOk,
        kqAllResolved: result.kqAllResolved,
        showHnOk: result.showHnOk,
      })}`);
    }
    return { id: c.id, desc: c.desc, matched, result, expected: c.expected };
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = args.matrix === "all"
    ? CASES
    : CASES.filter((c) => c.id === args.matrix);
  if (cases.length === 0) {
    console.error(`unknown matrix: ${args.matrix}`);
    process.exit(1);
  }
  const results = cases.map((c) => runCase(c, args.verbose));
  const passCount = results.filter((r) => r.matched).length;
  for (const r of results) {
    const status = r.matched ? "✓ PASS" : "✗ FAIL";
    console.log(`${status} sim:d-plus-1-handoff ${r.id} — ${r.desc}`);
  }
  const summary = {
    total: results.length,
    passed: passCount,
    failed: results.length - passCount,
    cases: results.map((r) => ({ id: r.id, matched: r.matched })),
  };
  console.log(JSON.stringify({ simDPlus1Handoff: summary }));
  console.log(
    `sim:d-plus-1-handoff ${passCount}/${results.length} ${passCount === results.length ? "PASS" : "FAIL"}`,
  );
  process.exit(passCount === results.length ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
