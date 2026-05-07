#!/usr/bin/env node
/**
 * verify-all.mjs
 *   - D-Day(2026-05-08) 사전/사후 통합 검증 게이트 — 한 명령으로 모든 회귀 + 정적 게이트 일괄 실행.
 *   - 의존성 0 (node 표준만). dev-deps 추가 0.
 *
 * 실행 게이트 (순차):
 *   1) check:vocab        — 어휘 룰 (저급어 0건)
 *   2) check:i18n         — i18n parity ko/en
 *   3) check:mcp:budget   — Spec 005 MCP chunkSize ≤ 18 kB (호출자 부재 시 skip-pass)
 *   4) verify:conservation-13 — 보존 13 v3 (conversation-store.ts SHA 무변동)
 *   5) verify:d27 ~ verify:d37 — 사이클별 회귀 게이트 11건 (C-D37-5: 15 게이트)
 *
 * 종료 코드:
 *   - 모두 PASS → exit 0
 *   - 1건이라도 FAIL → exit 1
 *
 * 사용:
 *   $ npm run verify:all
 *   $ node scripts/verify-all.mjs
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const gates = [
  { id: "check:vocab", cmd: "node", args: ["scripts/check-vocab.mjs", "--all"] },
  { id: "check:i18n", cmd: "node", args: ["scripts/check-i18n-keys.mjs"] },
  { id: "check:mcp:budget", cmd: "node", args: ["scripts/check-mcp-budget.mjs"] },
  { id: "verify:conservation-13", cmd: "node", args: ["scripts/verify-conservation-13.mjs"] },
  { id: "verify:d27", cmd: "node", args: ["scripts/verify-d27.mjs"] },
  { id: "verify:d28", cmd: "node", args: ["scripts/verify-d28.mjs"] },
  { id: "verify:d29", cmd: "node", args: ["scripts/verify-d29.mjs"] },
  { id: "verify:d30", cmd: "node", args: ["scripts/verify-d30.mjs"] },
  { id: "verify:d31", cmd: "node", args: ["scripts/verify-d31.mjs"] },
  { id: "verify:d32", cmd: "node", args: ["scripts/verify-d32.mjs"] },
  { id: "verify:d33", cmd: "node", args: ["scripts/verify-d33.mjs"] },
  { id: "verify:d34", cmd: "node", args: ["scripts/verify-d34.mjs"] },
  { id: "verify:d35", cmd: "node", args: ["scripts/verify-d35.mjs"] },
  { id: "verify:d36", cmd: "node", args: ["scripts/verify-d36.mjs"] },
  { id: "verify:d37", cmd: "node", args: ["scripts/verify-d37.mjs"] },
  { id: "verify:d38", cmd: "node", args: ["scripts/verify-d38.mjs"] },
  { id: "verify:d39", cmd: "node", args: ["scripts/verify-d39.mjs"] },
  { id: "verify:d40", cmd: "node", args: ["scripts/verify-d40.mjs"] },
  { id: "verify:d40-auto", cmd: "node", args: ["scripts/verify-d40-auto.mjs"] },
  { id: "verify:d42", cmd: "node", args: ["scripts/verify-d42.mjs"] },
  { id: "verify:d43", cmd: "node", args: ["scripts/verify-d43.mjs"] },
  { id: "verify:d44", cmd: "node", args: ["scripts/verify-d44.mjs"] },
  { id: "verify:d45", cmd: "node", args: ["scripts/verify-d45.mjs"] },
  // C-D46-2/3/5 (D-2 03시, 2026-05-06) — verify:all 26→29 자동 흡수.
  // sim:kq23-dismiss는 verify:d46 안에서 호출 (별도 sim:* 카테고리, verify:all 직접 미흡수).
  { id: "verify:shownh-copy", cmd: "node", args: ["scripts/verify-shownh-copy.mjs"] },
  { id: "verify:md-download-bom", cmd: "node", args: ["scripts/verify-md-download-bom.mjs"] },
  { id: "verify:d46", cmd: "node", args: ["scripts/verify-d46.mjs"] },
  { id: "verify:byok-ping", cmd: "node", args: ["scripts/verify-byok-ping.mjs"] },
  // C-D47-1/3/4/5 (D-2 07시, 2026-05-06) — verify:all 29→30 자동 흡수 (verify:d47).
  // sim:byok-demo / sim:rollback-decision / sim:domain-detect는 verify:d47 안에서 호출.
  { id: "verify:d47", cmd: "node", args: ["scripts/verify-d47.mjs"] },
  // C-D48-1∼5 (D-2 11시, 2026-05-06) — verify:all 30→31 자동 흡수 (verify:d48).
  // sim:byok-demo-extended / verify:byok-demo-card는 verify:d48 안에서 호출 (별도 흡수 미필요).
  { id: "verify:d48", cmd: "node", args: ["scripts/verify-d48.mjs"] },
  // 자율 D-49-자-1 (D-2 15시, 2026-05-06) — verify:all 31→32 자동 흡수 (verify:d49).
  // verify:byok-demo-card 5→7 게이트 확장 — verify:d49 내부 호출, 별도 흡수 미필요.
  { id: "verify:d49", cmd: "node", args: ["scripts/verify-d49.mjs"] },
  // 자율 D-50-자-1 (D-2 19시, 2026-05-06) — verify:all 32→33 자동 흡수 (verify:d50-auto).
  // sim:byok-window-boundary는 verify:d50-auto 내부 호출 (별도 흡수 미필요).
  // BYOK 시연(16:00 KST) 종료 후 T+3h09m 시점 — 윈도우 경계 회귀 가드만 추가, 코드 0 수정.
  { id: "verify:d50-auto", cmd: "node", args: ["scripts/verify-d50-auto.mjs"] },
  // C-D51-1∼5 (D-2 23시, 2026-05-06) — verify:all 33→34 자동 흡수 (verify:d51).
  // verify:release-snapshot / verify:d51-hero-dimming / sim:release-snapshot은 verify:d51 내부 호출.
  // B-D51-4 release freeze 5/7 23시 진입 직전 마지막 사이클 — 168 정식 26 사이클 도전.
  { id: "verify:d51", cmd: "node", args: ["scripts/verify-d51.mjs"] },
  // C-D52-1∼5 (D-1 03시, 2026-05-07) — verify:all 34→35 자동 흡수 (verify:d52).
  // sim:use-hero-dimming-opacity / sim:release-snapshot-cron / verify:freeze-hook /
  //   sim:post-auth-recover는 verify:d52 내부 호출 (별도 흡수 미필요).
  // 168 정식 HARD GATE 27 사이클 도전 — D-1 19시간 카운트다운 안정성 사수.
  { id: "verify:d52", cmd: "node", args: ["scripts/verify-d52.mjs"] },
  // C-D53-1∼5 (D-1 07시, 2026-05-07) — verify:all 35→36 자동 흡수 (verify:d53).
  // verify:d53-cron / sim:hero-aria-live-region / sim:kq23-banner-expiry / verify:d53-motion-reduce
  //   는 verify:d53 내부 호출 (별도 흡수 미필요).
  // 168 정식 HARD GATE 28 사이클 도전 — release freeze 5/7 23시 진입 약 16h 전.
  // src/ 변경 최소 — hero-aria-live-region.tsx + kq23-banner-expiry.ts 헬퍼 2건만.
  //   나머지 4 명세 .github/workflows/ + scripts/ + i18n (release freeze 정합 최우선).
  { id: "verify:d53", cmd: "node", args: ["scripts/verify-d53.mjs"] },
  // A-D54-자-1 (D-1 11시, 2026-05-07) — Komi 자율 (§5 명세 미수신).
  //   hero-aria-live-slot 신규 wiring 본체 (C-D52-1 / C-D53-2 D+1 큐 회복) — sibling 마운트만.
  //   hero* 4 (transition/pulse/title-slot/live-banner) 직접 변경 0 — release freeze 정합 최우선.
  //   sim:hero-aria-live-slot은 verify:d54 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 29 사이클 도전 — release freeze 5/7 23시 진입 약 11h 30m 전.
  { id: "verify:d54", cmd: "node", args: ["scripts/verify-d54.mjs"] },
  // C-D55-1∼5 (D-1 13시 슬롯 §7 똘이 명세, 2026-05-07) — verify:all 37→38 자동 흡수 (verify:d55).
  //   sim:show-hn-submit은 verify:d55 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 30 사이클 도전 — release freeze 5/7 23시 진입 약 9h 30m 전.
  //   show-hn-submit-config.ts (URL/title/body 1.0 final lock, length ratio 0.4 SoT) +
  //   manual-run-button-glow.css (D-D55-3 wiring, hero* 4 직접 변경 0) — release freeze 정합 최우선.
  { id: "verify:d55", cmd: "node", args: ["scripts/verify-d55.mjs"] },
  // C-D56-1∼5 (D-1 19시 슬롯 §9 똘이 명세, 2026-05-07) — verify:all 38→39 자동 흡수 (verify:d56).
  //   sim:show-hn-submit (case 6 OCP append) + sim:release-freeze (4 케이스) 는 verify:d56 내부 호출.
  //   168 정식 HARD GATE 31 사이클 도전 — release freeze 5/7 23시 진입 약 4h 전.
  //   release-freeze-cutoff.ts SoT 단일 (RELEASE_FREEZE_CUTOFF_KST + LIVE_MONITOR_START_KST +
  //   LIVE_MONITOR_DURATION_MIN + SUBMIT_DEADLINE_KST D-56-자-2 신규 통합) — D-1 정책 락 4건 흡수.
  { id: "verify:d56", cmd: "node", args: ["scripts/verify-d56.mjs"] },
  // C-D58-1∼5 (D-Day 03시 슬롯 §2 처리 큐, 2026-05-08) — verify:all 39→40 자동 흡수 (verify:d58).
  //   sim:funnel-day1 + check:live-phase 는 verify:d58 내부 호출 (별도 흡수 미필요).
  //   168 정식 HARD GATE 32 사이클 도전 — D-Day live phase 진입 +3h 시점.
  //   docs/D-DAY-LIVE-MONITOR.md + docs/D-PLUS-1-RETRO-TEMPLATE.md 신규 SoP 2건 +
  //   scripts/check-live-phase.mjs (SoT 1:1 미러) + scripts/sim-funnel-events-day1.mjs +
  //   scripts/verify-d58.mjs 모두 신규 — 기존 파일 수정 0건 (L-D58-1 변경 0 락 정합).
  { id: "verify:d58", cmd: "node", args: ["scripts/verify-d58.mjs"] },
  { id: "sim:hero-live", cmd: "node", args: ["scripts/sim-hero-live-transition.mjs"] },
  { id: "dry-run:dday-staging", cmd: "node", args: ["scripts/dry-run-dday-staging.mjs"] },
];

function runGate(gate) {
  return new Promise((resolveGate) => {
    const start = Date.now();
    const child = spawn(gate.cmd, gate.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      const ms = Date.now() - start;
      resolveGate({ id: gate.id, code: code ?? 1, ms, stdout, stderr });
    });
  });
}

const results = [];
for (const gate of gates) {
  const r = await runGate(gate);
  results.push(r);
  const status = r.code === 0 ? "✓ PASS" : "✗ FAIL";
  const tail = r.stdout.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  console.log(`${status} ${gate.id} (${r.ms} ms) — ${tail.slice(0, 120)}`);
  if (r.code !== 0) {
    console.error(`  stderr: ${r.stderr.slice(0, 400)}`);
  }
}

const failed = results.filter((r) => r.code !== 0);
const totalMs = results.reduce((acc, r) => acc + r.ms, 0);

console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${results.length} · PASS: ${results.length - failed.length} · FAIL: ${failed.length} · 총 시간: ${totalMs} ms`);
console.log("────────────────────────────────────────────────");

if (failed.length > 0) {
  console.error(`\n실패 게이트 ${failed.length}건:`);
  for (const f of failed) {
    console.error(`  - ${f.id} (exit ${f.code})`);
  }
  process.exit(1);
}

console.log("\n✓ verify-all: 모든 게이트 PASS");
process.exit(0);
