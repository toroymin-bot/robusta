#!/usr/bin/env node
/**
 * verify-d47.mjs
 *   - C-D47-5 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-5 (통합 게이트).
 *
 * Why: D-D47 사이클 15 항목 통합 검증 — verify:all 자동 흡수 (29→30 게이트).
 *
 * 게이트 (15 항목):
 *   1) C-D47-1 sim-byok-demo.mjs 6/6 PASS — child process 호출
 *   2) C-D47-2 ShownhScoreInput export + localStorage 'launch.shownh.score' + i18n 2키 ko+en parity
 *   3) C-D47-2 d1-report.ts readShownhScoreFromStorage + 'TBD' fallback 정합
 *   4) C-D47-3 settings sticky 헤더 grep + i18n 4키 ko+en parity (header/locked/t5/now)
 *   5) C-D47-3 LockedLozenge export + pointer-events-none + ByokCountdownLozenge export + 30s tick + clearInterval
 *   6) C-D47-3 BYOK_DEMO_ISO '2026-05-06T16:00:00+09:00' 정합 grep (SoT 모듈 import)
 *   7) C-D47-4 sim-rollback-decision.mjs 5/5 PASS — child process 호출
 *   8) C-D47-4 sim-domain-detect.mjs 4/4 PASS — child process 호출
 *   9) C-D47-4 domain-fallback-banner.tsx 5분 polling + localStorage 'kq23.domain.detected.at' + auto-stop
 *  10) D-D47-4 domain-fallback-banner.tsx prefers-reduced-motion 분기 grep + opacity 0ms + transform none
 *  11) F-D47-5 키보드 nav — DemoModeButton + D1ReportButton + ShownhScoreInput 3종 aria-label grep
 *  12) read-only 의무 — d1-report.ts db.put/add/delete grep 0
 *  13) 보존 13 v3 — verify:conservation-13 6/6 PASS — child process 호출
 *  14) 어휘 룰 — check:vocab 0건 — child process 호출
 *  15) 외부 dev-deps +0 — package.json devDeps 카운트 = 11
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(process.cwd());

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function runChild(cmd, args) {
  return new Promise((res) => {
    const c = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    c.stderr.on("data", (d) => (stderr += d.toString()));
    c.on("close", (code) => res({ code: code ?? 0, stderr }));
  });
}

async function main() {
  console.log("verify:d47 — D-D47 사이클 15 항목 통합 게이트");

  const messages = await readFile(
    resolve(root, "src/modules/i18n/messages.ts"),
    "utf8",
  );
  const shownhInput = await readFile(
    resolve(root, "src/modules/launch/shownh-score-input.tsx"),
    "utf8",
  );
  const d1Report = await readFile(
    resolve(root, "src/modules/launch/d1-report.ts"),
    "utf8",
  );
  const settingsPage = await readFile(
    resolve(root, "src/app/settings/page.tsx"),
    "utf8",
  );
  const lockedLozenge = await readFile(
    resolve(root, "src/modules/settings/locked-lozenge.tsx"),
    "utf8",
  );
  const byokLozenge = await readFile(
    resolve(root, "src/modules/settings/byok-countdown-lozenge.tsx"),
    "utf8",
  );
  const ddayConfig = await readFile(
    resolve(root, "src/modules/dday/dday-config.ts"),
    "utf8",
  );
  const banner = await readFile(
    resolve(root, "src/modules/domain/domain-fallback-banner.tsx"),
    "utf8",
  );
  const demoBtn = await readFile(
    resolve(root, "src/modules/settings/demo-mode-button.tsx"),
    "utf8",
  );
  const d1Btn = await readFile(
    resolve(root, "src/modules/settings/d1-report-button.tsx"),
    "utf8",
  );
  const pkgJson = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );

  // 1) sim:byok-demo 6/6.
  const r1 = await runChild("node", ["scripts/sim-byok-demo.mjs"]);
  if (r1.code === 0) {
    pass("1. sim:byok-demo 6/6 PASS");
  } else {
    fail("1. sim:byok-demo", `exit=${r1.code}`);
  }

  // 2) ShownhScoreInput + localStorage + i18n parity 2키.
  const hasShownhExport = /export function ShownhScoreInput/.test(shownhInput);
  const hasStorageKey = /['"]launch\.shownh\.score['"]/.test(shownhInput);
  const i18nKeys2 = [
    "settings.report.d1.score.label",
    "settings.report.d1.score.placeholder",
  ];
  let i2ok = true;
  for (const k of i18nKeys2) {
    const cnt = (messages.match(new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g")) || []).length;
    if (cnt < 2) {
      i2ok = false;
      fail("2. shownh i18n", `${k} occurrences=${cnt}`);
    }
  }
  if (hasShownhExport && hasStorageKey && i2ok) {
    pass("2. ShownhScoreInput export + 'launch.shownh.score' + i18n 2키 ko+en parity");
  } else {
    fail(
      "2. ShownhScoreInput",
      `export=${hasShownhExport} key=${hasStorageKey} i18n=${i2ok}`,
    );
  }

  // 3) d1-report readShownhScoreFromStorage + TBD fallback.
  const hasReader = /readShownhScoreFromStorage/.test(d1Report);
  const hasTbdFallback = /['"]TBD['"]/.test(d1Report);
  if (hasReader && hasTbdFallback) {
    pass("3. d1-report readShownhScoreFromStorage + 'TBD' fallback");
  } else {
    fail("3. d1-report integration", `reader=${hasReader} tbd=${hasTbdFallback}`);
  }

  // 4) settings sticky 헤더 + i18n 4키 parity.
  const hasSticky = /sticky\s+top-0\s+z-30/.test(settingsPage);
  const headerKey = /settings\.header\.title/.test(settingsPage);
  const i18nKeys4 = [
    "settings.header.title",
    "settings.copy.locked.label",
    "settings.byok.countdown.t5",
    "settings.byok.countdown.now",
  ];
  let i4ok = true;
  for (const k of i18nKeys4) {
    const cnt = (messages.match(new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g")) || []).length;
    if (cnt < 2) {
      i4ok = false;
      fail("4. settings i18n", `${k} occurrences=${cnt}`);
    }
  }
  if (hasSticky && headerKey && i4ok) {
    pass("4. settings sticky 헤더 + i18n 4키 ko+en parity (header/locked/t5/now)");
  } else {
    fail("4. settings header", `sticky=${hasSticky} key=${headerKey} i18n=${i4ok}`);
  }

  // 5) LockedLozenge + pointer-events-none + ByokCountdownLozenge + 30s tick + clearInterval.
  const hasLockedExport = /export function LockedLozenge/.test(lockedLozenge);
  const hasPointerNone = /pointer-events-none/.test(lockedLozenge);
  const hasByokExport = /export function ByokCountdownLozenge/.test(byokLozenge);
  const hasTick30 = /TICK_MS\s*=\s*30_000|setInterval\(\s*tick\s*,\s*(?:30_000|30000)\s*\)/.test(byokLozenge);
  const hasClearInterval = /clearInterval/.test(byokLozenge);
  if (
    hasLockedExport &&
    hasPointerNone &&
    hasByokExport &&
    hasTick30 &&
    hasClearInterval
  ) {
    pass("5. LockedLozenge + pointer-events-none + ByokCountdownLozenge + 30s tick + clearInterval");
  } else {
    fail(
      "5. lozenge",
      `locked=${hasLockedExport} ptr=${hasPointerNone} byok=${hasByokExport} tick=${hasTick30} clear=${hasClearInterval}`,
    );
  }

  // 6) BYOK_DEMO_ISO 정합 (SoT 모듈) + ByokCountdownLozenge import.
  const hasIsoConst = /BYOK_DEMO_ISO\s*=\s*"2026-05-06T16:00:00\+09:00"/.test(ddayConfig);
  const hasIsoImport = /BYOK_DEMO_ISO/.test(byokLozenge);
  if (hasIsoConst && hasIsoImport) {
    pass("6. BYOK_DEMO_ISO '2026-05-06T16:00:00+09:00' SoT 모듈 + import 정합");
  } else {
    fail("6. BYOK_DEMO_ISO", `const=${hasIsoConst} import=${hasIsoImport}`);
  }

  // 7) sim:rollback-decision 5/5.
  const r7 = await runChild("node", ["scripts/sim-rollback-decision.mjs"]);
  if (r7.code === 0) {
    pass("7. sim:rollback-decision 5/5 PASS");
  } else {
    fail("7. sim:rollback-decision", `exit=${r7.code}`);
  }

  // 8) sim:domain-detect 4/4.
  const r8 = await runChild("node", ["scripts/sim-domain-detect.mjs"]);
  if (r8.code === 0) {
    pass("8. sim:domain-detect 4/4 PASS");
  } else {
    fail("8. sim:domain-detect", `exit=${r8.code}`);
  }

  // 9) banner 5분 polling + localStorage + auto-stop.
  const hasPollInterval = /5\s*\*\s*60\s*\*\s*1000|300_000|300000/.test(banner);
  const hasDomainKey = /['"]kq23\.domain\.detected\.at['"]/.test(banner);
  const hasAutoStop = /domainDetected/.test(banner);
  if (hasPollInterval && hasDomainKey && hasAutoStop) {
    pass("9. banner 5분 polling + 'kq23.domain.detected.at' + auto-stop");
  } else {
    fail(
      "9. banner polling",
      `interval=${hasPollInterval} key=${hasDomainKey} stop=${hasAutoStop}`,
    );
  }

  // 10) banner prefers-reduced-motion + opacity 0ms + transform none.
  const hasReducedMotionMQ = /prefers-reduced-motion:\s*reduce/.test(banner);
  const hasOpacity0ms = /opacity\s+0ms/.test(banner);
  const hasTransformNone = /transform:\s*reducedMotion\s*\?\s*"none"/.test(banner);
  if (hasReducedMotionMQ && hasOpacity0ms && hasTransformNone) {
    pass("10. banner prefers-reduced-motion 분기 + opacity 0ms + transform none");
  } else {
    fail(
      "10. motion-reduce",
      `mq=${hasReducedMotionMQ} op=${hasOpacity0ms} tf=${hasTransformNone}`,
    );
  }

  // 11) 키보드 nav — 3종 aria-label grep.
  const aria1 = /aria-label/.test(demoBtn);
  const aria2 = /aria-label/.test(d1Btn);
  const aria3 = /aria-label/.test(shownhInput);
  if (aria1 && aria2 && aria3) {
    pass("11. 키보드 nav — DemoModeButton + D1ReportButton + ShownhScoreInput aria-label 3/3");
  } else {
    fail("11. aria-label", `demo=${aria1} d1=${aria2} shownh=${aria3}`);
  }

  // 12) read-only — d1-report.ts.
  const writeOps = d1Report.match(/\bdb\.(put|add|delete|update)\b/g);
  if (!writeOps || writeOps.length === 0) {
    pass("12. d1-report.ts read-only (db.put/add/delete 0)");
  } else {
    fail("12. read-only", `found ${writeOps.length} write ops`);
  }

  // 13) 보존 13.
  const cons = await runChild("node", [
    "scripts/verify-conservation-13.mjs",
  ]);
  if (cons.code === 0) {
    pass("13. verify:conservation-13 6/6 PASS");
  } else {
    fail("13. conservation-13", `exit=${cons.code}`);
  }

  // 14) check:vocab.
  const vocab = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
  if (vocab.code === 0) {
    pass("14. check:vocab 0건");
  } else {
    fail("14. check:vocab", `exit=${vocab.code}`);
  }

  // 15) dev-deps +0 — devDependencies 정확히 11.
  const devDepsCount = Object.keys(pkgJson.devDependencies || {}).length;
  if (devDepsCount === 11) {
    pass(`15. devDependencies count = 11`);
  } else {
    fail("15. dev-deps", `expected 11, got ${devDepsCount}`);
  }

  if (process.exitCode === 1) {
    console.error("verify:d47 — FAIL");
  } else {
    console.log("verify:d47 — 15/15 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d47 — ERROR", err);
  process.exit(1);
});
