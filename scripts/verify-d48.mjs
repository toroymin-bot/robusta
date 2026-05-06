#!/usr/bin/env node
/**
 * verify-d48.mjs
 *   - C-D48-5 (D-2 11시 슬롯, 2026-05-06) — Tori spec C-D48-5 (통합 게이트).
 *
 * Why: D-D48 사이클 16 항목 통합 검증 — verify:all 자동 흡수 (30→31 게이트).
 *
 * 16 gates:
 *   1) C-D48-1 sim-byok-demo-extended.mjs 8/8 PASS — child process 호출
 *   2) C-D48-2 ByokDemoCard export + localStorage 'byok.demo.card.steps' + i18n 6키 ko+en parity (12쌍)
 *   3) C-D48-2 settings page ByokDemoCard import + 사용 grep
 *   4) C-D48-2 BYOK_DEMO_ISO import from '@/modules/dday/dday-config' (D-47-자-1 SoT 정합)
 *   5) C-D48-2 표시 윈도우 ±2h 정합 grep (WINDOW_MS_BEFORE + WINDOW_MS_AFTER)
 *   6) C-D48-2 1분 tick interval + clearInterval cleanup grep
 *   7) C-D48-2 ARIA — role="region" + aria-label + aria-pressed grep
 *   8) C-D48-2 motion-reduce:transition-none grep
 *   9) C-D48-3 funnel-events.ts 4 byok_demo events grep — 'byok_demo_started/pinged/completed/failed'
 *  10) C-D48-3 demo-mode-button.tsx (started/pinged/failed) + byok-countdown-lozenge.tsx (completed) wiring grep
 *  11) C-D48-3 보존 13 api-key-ping.ts 0 수정 grep (read-only 정합)
 *  12) C-D48-4 d1-report.ts byok_demo 섹션 + i18n 4키 ko+en parity (8쌍) + 분모 0 보호 grep
 *  13) F-D48-5 verify-byok-demo-card.mjs 7/7 PASS — child process 호출 (자율 D-49-자-1: 5→7 게이트 확장)
 *  14) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS — child process)
 *  15) 어휘 룰 — check:vocab 0건 — child process 호출
 *  16) 외부 dev-deps +0 — package.json devDeps 카운트 = 11
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
  return new Promise((resolveChild) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("close", (code) => {
      resolveChild({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main() {
  console.log("verify:d48 — D-D48 사이클 16 게이트");

  const card = await readFile(
    resolve(root, "src/modules/settings/byok-demo-card.tsx"),
    "utf8",
  );
  const settingsPage = await readFile(
    resolve(root, "src/app/settings/page.tsx"),
    "utf8",
  );
  const ddayConfig = await readFile(
    resolve(root, "src/modules/dday/dday-config.ts"),
    "utf8",
  );
  const messages = await readFile(
    resolve(root, "src/modules/i18n/messages.ts"),
    "utf8",
  );
  const funnelEvents = await readFile(
    resolve(root, "src/modules/launch/funnel-events.ts"),
    "utf8",
  );
  const demoBtn = await readFile(
    resolve(root, "src/modules/settings/demo-mode-button.tsx"),
    "utf8",
  );
  const lozenge = await readFile(
    resolve(root, "src/modules/settings/byok-countdown-lozenge.tsx"),
    "utf8",
  );
  const apiKeyPing = await readFile(
    resolve(root, "src/modules/api-keys/api-key-ping.ts"),
    "utf8",
  );
  const d1Report = await readFile(
    resolve(root, "src/modules/launch/d1-report.ts"),
    "utf8",
  );
  const pkg = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );

  // 1) sim-byok-demo-extended.mjs 8/8 PASS.
  const r1 = await runChild("node", ["scripts/sim-byok-demo-extended.mjs"]);
  if (r1.code === 0 && /8\/8 PASS/.test(r1.stdout)) {
    pass("1. sim:byok-demo-extended 8/8 PASS");
  } else {
    fail(
      "1. sim:byok-demo-extended",
      `code=${r1.code} stdout tail=${r1.stdout.slice(-120)}`,
    );
  }

  // 2) ByokDemoCard export + localStorage key + i18n 6키 ko+en parity.
  const cardExport = /export\s+function\s+ByokDemoCard/.test(card);
  const cardStorage = /["']byok\.demo\.card\.steps["']/.test(card);
  const i18nStepKeys = [
    "settings.byok.demo.card.label",
    "settings.byok.demo.card.step.1",
    "settings.byok.demo.card.step.2",
    "settings.byok.demo.card.step.3",
    "settings.byok.demo.card.step.4",
    "settings.byok.demo.card.step.5",
    "settings.byok.demo.card.step.6",
  ];
  // 7키 (label + step.1∼6) — 명세 6키지만 label 포함시 7개 i18n 항목 노출. ko/en 양쪽 14쌍.
  const koHits = i18nStepKeys.filter((k) =>
    new RegExp(`"${k}":\\s*"[^"]+","?\\s*\\n[\\s\\S]{0,400}?en:|\\bko:[\\s\\S]*?"${k}":`).test(messages),
  );
  // 단순 grep (ko/en 모두 — 한 파일에 ko 블록 + en 블록).
  const koGrep = i18nStepKeys.every((k) => messages.includes(`"${k}":`));
  // ko 블록과 en 블록에 각각 있는지: split by 'en: {' boundary.
  const enBoundary = messages.indexOf("en:");
  const koPart = enBoundary > 0 ? messages.slice(0, enBoundary) : messages;
  const enPart = enBoundary > 0 ? messages.slice(enBoundary) : "";
  const koAllPresent = i18nStepKeys.every((k) => koPart.includes(`"${k}":`));
  const enAllPresent = i18nStepKeys.every((k) => enPart.includes(`"${k}":`));
  if (cardExport && cardStorage && koAllPresent && enAllPresent && koGrep) {
    pass(
      "2. ByokDemoCard export + 'byok.demo.card.steps' + i18n 6키 (label+step.1∼6) ko+en parity",
    );
  } else {
    fail(
      "2. card+i18n",
      `export=${cardExport} storage=${cardStorage} ko=${koAllPresent} en=${enAllPresent}`,
    );
  }
  void koHits;

  // 3) settings page ByokDemoCard import + 사용.
  const cardImport =
    /import\s*\{[^}]*ByokDemoCard[^}]*\}\s*from\s*["']@\/modules\/settings\/byok-demo-card["']/.test(
      settingsPage,
    );
  const cardUse = /<ByokDemoCard\s*\/?>/.test(settingsPage);
  if (cardImport && cardUse) {
    pass("3. settings page ByokDemoCard import + <ByokDemoCard /> 사용");
  } else {
    fail("3. settings page wiring", `import=${cardImport} use=${cardUse}`);
  }

  // 4) BYOK_DEMO_ISO SoT import.
  const sotInDday = /BYOK_DEMO_ISO\s*=\s*"2026-05-06T16:00:00\+09:00"/.test(
    ddayConfig,
  );
  const cardImportSot =
    /import\s*\{[^}]*BYOK_DEMO_ISO[^}]*\}\s*from\s*["']@\/modules\/dday\/dday-config["']/.test(
      card,
    );
  if (sotInDday && cardImportSot) {
    pass(
      "4. BYOK_DEMO_ISO SoT (dday-config.ts) + ByokDemoCard import (D-47-자-1 정합)",
    );
  } else {
    fail("4. SoT", `dday=${sotInDday} cardImport=${cardImportSot}`);
  }

  // 5) ±2h window 상수.
  const winBefore = /WINDOW_MS_BEFORE\s*=\s*2\s*\*\s*60\s*\*\s*60_000/.test(
    card,
  );
  const winAfter = /WINDOW_MS_AFTER\s*=\s*2\s*\*\s*60\s*\*\s*60_000/.test(card);
  if (winBefore && winAfter) {
    pass("5. ±2h 표시 윈도우 (WINDOW_MS_BEFORE + WINDOW_MS_AFTER)");
  } else {
    fail("5. ±2h window", `before=${winBefore} after=${winAfter}`);
  }

  // 6) 1분 tick + clearInterval.
  const tickMs = /TICK_MS\s*=\s*60_000/.test(card);
  const setInt = /setInterval\(\s*tick\s*,\s*TICK_MS\s*\)/.test(card);
  const clearInt = /clearInterval\(\s*id\s*\)/.test(card);
  if (tickMs && setInt && clearInt) {
    pass("6. 1분 tick + setInterval + clearInterval cleanup");
  } else {
    fail("6. tick/cleanup", `tick=${tickMs} set=${setInt} clear=${clearInt}`);
  }

  // 7) ARIA.
  const role = /role="region"/.test(card);
  const ariaLabel = /aria-label=\{/.test(card);
  const ariaPressed = /aria-pressed=\{/.test(card);
  if (role && ariaLabel && ariaPressed) {
    pass("7. ARIA region + aria-label + aria-pressed");
  } else {
    fail(
      "7. ARIA",
      `role=${role} label=${ariaLabel} pressed=${ariaPressed}`,
    );
  }

  // 8) motion-reduce.
  const motionReduce = /motion-reduce:transition-none/.test(card);
  if (motionReduce) {
    pass("8. motion-reduce:transition-none (prefers-reduced-motion)");
  } else {
    fail("8. motion-reduce", "missing motion-reduce:transition-none");
  }

  // 9) funnel-events.ts 4 byok_demo events.
  const events = [
    "byok_demo_started",
    "byok_demo_pinged",
    "byok_demo_completed",
    "byok_demo_failed",
  ];
  const evHits = events.filter((e) =>
    new RegExp(`"${e}"`).test(funnelEvents),
  );
  if (evHits.length === 4) {
    pass("9. funnel-events 4 byok_demo events (started/pinged/completed/failed)");
  } else {
    fail("9. funnel events", `expected 4, got ${evHits.length}`);
  }

  // 10) wiring — demo-button(started/pinged/failed) + lozenge(completed).
  const wStarted =
    /logFunnelEvent\(\s*["']byok_demo_started["']\s*\)/.test(demoBtn);
  const wPinged =
    /logFunnelEvent\(\s*["']byok_demo_pinged["']\s*\)/.test(demoBtn);
  const wFailed =
    /logFunnelEvent\(\s*["']byok_demo_failed["']\s*\)/.test(demoBtn);
  const wCompleted =
    /logFunnelEvent\(\s*["']byok_demo_completed["']\s*\)/.test(lozenge);
  if (wStarted && wPinged && wFailed && wCompleted) {
    pass(
      "10. wiring — demo-button(started/pinged/failed) + lozenge(completed)",
    );
  } else {
    fail(
      "10. wiring",
      `started=${wStarted} pinged=${wPinged} failed=${wFailed} completed=${wCompleted}`,
    );
  }

  // 11) 보존 13 api-key-ping read-only.
  const writeOps = apiKeyPing.match(/\bdb\.(put|add|delete|update)\b/g);
  if (!writeOps || writeOps.length === 0) {
    pass("11. api-key-ping read-only (db write 0)");
  } else {
    fail("11. api-key-ping", `writes=${writeOps.length}`);
  }

  // 12) d1-report byok_demo 섹션 + i18n 4키 + 분모 0 보호.
  const reportByokFn = /async\s+function\s+readByokDemoFunnel/.test(d1Report);
  const reportImportFunnel =
    /import\s*\{[^}]*getFunnelCounts[^}]*\}\s*from\s*["']\.\/funnel-events["']/.test(
      d1Report,
    );
  const guard = /started\s*>\s*0\s*\?/.test(d1Report);
  const writeOpsReport = d1Report.match(/\bdb\.(put|add|delete|update)\b/g);
  const reportReadOnly = !writeOpsReport || writeOpsReport.length === 0;
  const reportI18nKeys = [
    "settings.report.d1.byok.title",
    "settings.report.d1.byok.started",
    "settings.report.d1.byok.pinged",
    "settings.report.d1.byok.completed",
  ];
  const reportKoAll = reportI18nKeys.every((k) =>
    koPart.includes(`"${k}":`),
  );
  const reportEnAll = reportI18nKeys.every((k) =>
    enPart.includes(`"${k}":`),
  );
  if (
    reportByokFn &&
    reportImportFunnel &&
    guard &&
    reportReadOnly &&
    reportKoAll &&
    reportEnAll
  ) {
    pass(
      "12. d1-report readByokDemoFunnel + getFunnelCounts + 분모 0 보호 + read-only + i18n 4키 ko+en",
    );
  } else {
    fail(
      "12. d1-report byok",
      `fn=${reportByokFn} import=${reportImportFunnel} guard=${guard} ro=${reportReadOnly} ko=${reportKoAll} en=${reportEnAll}`,
    );
  }

  // 13) verify-byok-demo-card.mjs 7/7 (자율 D-49-자-1 — 5→7 게이트 확장 후 정합).
  const r13 = await runChild("node", ["scripts/verify-byok-demo-card.mjs"]);
  if (r13.code === 0 && /7\/7 PASS/.test(r13.stdout)) {
    pass("13. verify:byok-demo-card 7/7 PASS");
  } else {
    fail(
      "13. verify:byok-demo-card",
      `code=${r13.code} stdout tail=${r13.stdout.slice(-120)}`,
    );
  }

  // 14) 보존 13 v3 — verify:conservation-13.
  const r14 = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
  if (r14.code === 0) {
    pass("14. verify:conservation-13 PASS (보존 13 v3 무손상)");
  } else {
    fail(
      "14. verify:conservation-13",
      `code=${r14.code} stderr=${r14.stderr.slice(-120)}`,
    );
  }

  // 15) 어휘 룰 — check:vocab 0건.
  const r15 = await runChild("node", [
    "scripts/check-vocab.mjs",
    "--all",
  ]);
  if (r15.code === 0) {
    pass("15. check:vocab 0건 (저급어 grep 0)");
  } else {
    fail(
      "15. check:vocab",
      `code=${r15.code} stderr=${r15.stderr.slice(-120)}`,
    );
  }

  // 16) dev-deps +0 — devDeps 카운트 = 11.
  const devDepsCount = Object.keys(pkg.devDependencies ?? {}).length;
  if (devDepsCount === 11) {
    pass("16. 외부 dev-deps +0 (devDeps=11 정합)");
  } else {
    fail("16. devDeps count", `expected 11, got ${devDepsCount}`);
  }

  if ((process.exitCode ?? 0) === 0) {
    console.log("verify:d48 — 16/16 PASS");
  } else {
    console.error("verify:d48 — FAIL");
  }
}

main().catch((err) => {
  console.error("verify:d48 — ERROR", err);
  process.exit(1);
});
