#!/usr/bin/env node
/**
 * verify-d49.mjs
 *   - 자율 D-49-자-1 (D-2 15시 슬롯, 2026-05-06) — byok-demo-card v2 통합 게이트.
 *
 * Why: 자율 슬롯 단일 작업 — byok-demo-card 시각적 progress bar + 리셋 버튼 (재시연 마찰 0).
 *   verify:all 자동 흡수 (31→32 게이트).
 *
 * Scope:
 *   - byok-demo-card.tsx OCP append (logFunnelEvent import + reset() + progress bar JSX + reset 버튼 JSX)
 *   - i18n messages.ts append 2키 × ko/en parity (4쌍)
 *   - funnel-events.ts FUNNEL_EVENTS append 1건 (byok_demo_card_reset)
 *   - verify-byok-demo-card.mjs 5→7 게이트
 *
 * 7 gates:
 *   1) verify:byok-demo-card 7/7 PASS — child process 호출 (progress bar + reset 회귀 통합)
 *   2) funnel-events.ts FUNNEL_EVENTS 'byok_demo_card_reset' append grep
 *   3) i18n messages.ts ko/en parity 2키 — settings.byok.demo.card.{progress.label,reset.label} (4쌍 grep)
 *   4) byok-demo-card.tsx logFunnelEvent import 1건 + reset() 함수 정의 grep
 *   5) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS — child process)
 *   6) 어휘 룰 — check:vocab 0건 — child process 호출
 *   7) 외부 dev-deps +0 — package.json devDependencies 카운트 = 11
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
  console.log("verify:d49 — 자율 D-49-자-1 byok-demo-card v2 (7 gates)");

  // 1) verify:byok-demo-card 7/7.
  {
    const r = await runChild("node", ["scripts/verify-byok-demo-card.mjs"]);
    if (r.code === 0 && /7\/7 PASS/.test(r.stdout)) {
      pass("1. verify:byok-demo-card 7/7 PASS (progress bar + reset 회귀)");
    } else {
      fail(
        "1. verify:byok-demo-card",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-6).join(" | ")}`,
      );
    }
  }

  // 2) funnel-events.ts append.
  {
    const fe = await readFile(
      resolve(root, "src/modules/launch/funnel-events.ts"),
      "utf8",
    );
    const hasReset = /"byok_demo_card_reset"/.test(fe);
    if (hasReset) {
      pass("2. funnel-events.ts 'byok_demo_card_reset' append grep");
    } else {
      fail("2. funnel-events.ts append", "byok_demo_card_reset 미발견");
    }
  }

  // 3) i18n parity 2키 (4쌍).
  {
    const msg = await readFile(
      resolve(root, "src/modules/i18n/messages.ts"),
      "utf8",
    );
    const keys = [
      "settings.byok.demo.card.progress.label",
      "settings.byok.demo.card.reset.label",
    ];
    const occurrences = keys.map(
      (k) => (msg.match(new RegExp(`"${k.replace(/\./g, "\\.")}"`, "g")) ?? []).length,
    );
    // 각 키는 ko/en 양 블록 → 정확히 2회.
    if (occurrences.every((n) => n === 2)) {
      pass(
        `3. i18n ko/en parity 2키 (각 2회 = 4쌍) — ${keys.join(", ")}`,
      );
    } else {
      fail(
        "3. i18n parity",
        `expected each=2, got ${keys.map((k, i) => `${k}:${occurrences[i]}`).join(" / ")}`,
      );
    }
  }

  // 4) byok-demo-card.tsx wiring.
  {
    const card = await readFile(
      resolve(root, "src/modules/settings/byok-demo-card.tsx"),
      "utf8",
    );
    const hasImport =
      /import\s+\{\s*logFunnelEvent\s*\}\s+from\s+["']@\/modules\/launch\/funnel-events["']/.test(
        card,
      );
    const hasResetFn = /function\s+reset\s*\(\s*\)\s*\{/.test(card);
    if (hasImport && hasResetFn) {
      pass(
        "4. byok-demo-card.tsx — logFunnelEvent import + reset() 함수 정의",
      );
    } else {
      fail(
        "4. byok-demo-card wiring",
        `import=${hasImport} reset=${hasResetFn}`,
      );
    }
  }

  // 5) 보존 13.
  {
    const r = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
    if (r.code === 0) {
      pass("5. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail(
        "5. 보존 13",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-4).join(" | ")}`,
      );
    }
  }

  // 6) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("6. 어휘 룰 — check:vocab 0건");
    } else {
      fail(
        "6. 어휘 룰",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-4).join(" | ")}`,
      );
    }
  }

  // 7) 외부 dev-deps +0.
  {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    );
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`7. 외부 dev-deps +0 — devDependencies 카운트 = ${devCount}`);
    } else {
      fail(
        "7. dev-deps",
        `expected 11, got ${devCount}`,
      );
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d49 — FAIL");
  } else {
    console.log("verify:d49 — 7/7 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d49 — ERROR", err);
  process.exit(1);
});
