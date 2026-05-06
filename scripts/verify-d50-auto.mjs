#!/usr/bin/env node
/**
 * verify-d50-auto.mjs
 *   - 자율 D-50-자-1 (D-2 19시 슬롯, 2026-05-06) — BYOK_DEMO_ISO 윈도우 경계 회귀 가드.
 *
 * Why: 시연(16:00 KST) 종료 후 T+3h09m 시점 자율 슬롯 — 산만 0 (코드 무수정),
 *   회귀 가드만 추가. 차후 윈도우 산식 변경 시 회귀 즉시 감지.
 *
 * Scope:
 *   - sim-byok-window-boundary.mjs 신규 (8 케이스)
 *   - byok-demo-card.tsx / byok-countdown-lozenge.tsx 코드 0 수정
 *   - package.json scripts 2건 등록 (verify:d50-auto + sim:byok-window-boundary)
 *   - verify-all.mjs 32→33 자동 흡수
 *
 * 8 gates:
 *   1) sim:byok-window-boundary 8/8 PASS — child process 호출
 *   2) byok-demo-card.tsx WINDOW_MS_BEFORE/AFTER 상수 정의 grep (산식 SoT)
 *   3) byok-countdown-lozenge.tsx T5_WINDOW_MS/T30_WINDOW_MS 상수 정의 grep
 *   4) byok-demo-card.tsx + byok-countdown-lozenge.tsx 양쪽 BYOK_DEMO_ISO SoT 직접 import
 *   5) byok-countdown-lozenge.tsx phase=hidden|done 시 return null 패턴 grep
 *   6) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS — child process)
 *   7) 어휘 룰 — check:vocab 0건 — child process 호출
 *   8) 외부 dev-deps +0 — package.json devDependencies 카운트 = 11
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
  console.log("verify:d50-auto — 자율 D-50-자-1 BYOK 윈도우 경계 회귀 가드 (8 gates)");

  const cardPath = resolve(root, "src/modules/settings/byok-demo-card.tsx");
  const lozPath = resolve(root, "src/modules/settings/byok-countdown-lozenge.tsx");

  // 1) sim:byok-window-boundary 8/8.
  {
    const r = await runChild("node", ["scripts/sim-byok-window-boundary.mjs"]);
    if (r.code === 0 && /8\/8 PASS/.test(r.stdout)) {
      pass("1. sim:byok-window-boundary 8/8 PASS (4 visible + 4 phase 경계)");
    } else {
      fail(
        "1. sim:byok-window-boundary",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-6).join(" | ")}`,
      );
    }
  }

  // 2) byok-demo-card.tsx 윈도우 상수.
  {
    const card = await readFile(cardPath, "utf8");
    const hasBefore = /const\s+WINDOW_MS_BEFORE\s*=\s*2\s*\*\s*60\s*\*\s*60_?000/.test(card);
    const hasAfter = /const\s+WINDOW_MS_AFTER\s*=\s*2\s*\*\s*60\s*\*\s*60_?000/.test(card);
    if (hasBefore && hasAfter) {
      pass("2. byok-demo-card.tsx WINDOW_MS_BEFORE/AFTER = 2h * 60m * 60_000ms 정의");
    } else {
      fail("2. card 상수", `before=${hasBefore} after=${hasAfter}`);
    }
  }

  // 3) byok-countdown-lozenge.tsx phase 상수.
  {
    const loz = await readFile(lozPath, "utf8");
    const hasT5 = /const\s+T5_WINDOW_MS\s*=\s*5\s*\*\s*60_?000/.test(loz);
    const hasT30 = /const\s+T30_WINDOW_MS\s*=\s*30\s*\*\s*60_?000/.test(loz);
    if (hasT5 && hasT30) {
      pass("3. byok-countdown-lozenge.tsx T5_WINDOW_MS=5min + T30_WINDOW_MS=30min 정의");
    } else {
      fail("3. lozenge 상수", `t5=${hasT5} t30=${hasT30}`);
    }
  }

  // 4) BYOK_DEMO_ISO SoT 직접 import (양 컴포넌트).
  {
    const card = await readFile(cardPath, "utf8");
    const loz = await readFile(lozPath, "utf8");
    const reImport = /import\s+\{\s*BYOK_DEMO_ISO\s*\}\s+from\s+["']@\/modules\/dday\/dday-config["']/;
    const cardOk = reImport.test(card);
    const lozOk = reImport.test(loz);
    if (cardOk && lozOk) {
      pass("4. 양 컴포넌트 BYOK_DEMO_ISO SoT 직접 import (@/modules/dday/dday-config)");
    } else {
      fail("4. SoT import", `card=${cardOk} lozenge=${lozOk}`);
    }
  }

  // 5) byok-countdown-lozenge phase=hidden|done return null 패턴.
  {
    const loz = await readFile(lozPath, "utf8");
    // 패턴: if (phase === "hidden" || phase === "done") return null;
    const hasGuard = /phase\s*===\s*["']hidden["']\s*\|\|\s*phase\s*===\s*["']done["']\s*\)\s*return\s+null/.test(
      loz,
    );
    if (hasGuard) {
      pass("5. byok-countdown-lozenge phase=hidden|done 분기 return null (산만 0)");
    } else {
      fail("5. lozenge guard", "phase=hidden|done return null 패턴 미발견");
    }
  }

  // 6) 보존 13.
  {
    const r = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
    if (r.code === 0) {
      pass("6. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail(
        "6. 보존 13",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-4).join(" | ")}`,
      );
    }
  }

  // 7) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("7. 어휘 룰 — check:vocab 0건");
    } else {
      fail(
        "7. 어휘 룰",
        `code=${r.code} — ${(r.stdout + r.stderr).split("\n").slice(-4).join(" | ")}`,
      );
    }
  }

  // 8) 외부 dev-deps +0.
  {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    );
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`8. 외부 dev-deps +0 — devDependencies 카운트 = ${devCount}`);
    } else {
      fail("8. dev-deps", `expected 11, got ${devCount}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d50-auto — FAIL");
  } else {
    console.log("verify:d50-auto — 8/8 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d50-auto — ERROR", err);
  process.exit(1);
});
