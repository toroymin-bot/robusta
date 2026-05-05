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
