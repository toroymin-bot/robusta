#!/usr/bin/env node
/**
 * verify-d51.mjs
 *   - C-D51-3 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-3.
 *
 * Why: D-D51 사이클 통합 12 게이트 — verify:all 33→34 자동 흡수.
 *   168 정식 HARD GATE 26 사이클 도전 + B-D51-4 release freeze 직전 안정성 사수.
 *
 * 자율 정정:
 *   - D-51-자-1: release-snapshot.ts 경로 src/lib → src/modules/launch (lib 부재).
 *   - D-51-자-2: dim-hero.ts 경로 src/components/launch → src/modules/launch (디렉토리 부재).
 *   - D-51-자-3: hero.tsx wiring D+1 자율 슬롯 큐 이월 (hero.tsx 부재).
 *
 * 12 gates:
 *   1) sim:byok-window-boundary 8/8 (D-D50-자-1 회귀 보호)
 *   2) verify:release-snapshot 6/6 (C-D51-1)
 *   3) verify:d51-hero-dimming 5/5 (C-D51-2)
 *   4) sim:release-snapshot 6/6 (C-D51-4)
 *   5) dim-hero.ts 파일 존재 grep + buildHeroDimmingOpacity export
 *   6) release-snapshot.ts 파일 존재 grep + buildReleaseSnapshot export
 *   7) post-auth-recover.ts 스켈레톤 존재 + ATLASSIAN_API_TOKEN 핸들링 grep
 *   8) i18n 4 키 ko/en parity (release.snapshot.dday/regression/vercel/readiness)
 *   9) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)
 *  10) 어휘 룰 — check:vocab 0건
 *  11) 외부 dev-deps +0 (devDependencies 카운트 = 11)
 *  12) check:i18n parity (전체 키 ko/en 일치)
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
  console.log("verify:d51 — D-D51 통합 12 게이트 (release-snapshot + dim-hero + post-auth-recover + i18n + 보존)");

  // 1) sim:byok-window-boundary 8/8 (D-D50-자-1 회귀 보호).
  {
    const r = await runChild("node", ["scripts/sim-byok-window-boundary.mjs"]);
    if (r.code === 0 && /8\/8 PASS/.test(r.stdout)) {
      pass("1. sim:byok-window-boundary 8/8 PASS (D-D50-자-1 회귀 보호)");
    } else {
      fail("1. sim:byok-window-boundary", `code=${r.code}`);
    }
  }

  // 2) verify:release-snapshot 6/6.
  {
    const r = await runChild("node", ["scripts/verify-release-snapshot.mjs"]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass("2. verify:release-snapshot 6/6 PASS (C-D51-1)");
    } else {
      fail("2. verify:release-snapshot", `code=${r.code}`);
    }
  }

  // 3) verify:d51-hero-dimming 5/5.
  {
    const r = await runChild("node", ["scripts/verify-d51-hero-dimming.mjs"]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("3. verify:d51-hero-dimming 5/5 PASS (C-D51-2)");
    } else {
      fail("3. verify:d51-hero-dimming", `code=${r.code}`);
    }
  }

  // 4) sim:release-snapshot 6/6.
  {
    const r = await runChild("node", ["scripts/sim-release-snapshot.mjs"]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass("4. sim:release-snapshot 6/6 PASS (C-D51-4)");
    } else {
      fail("4. sim:release-snapshot", `code=${r.code}`);
    }
  }

  // 5) dim-hero.ts 존재 + export.
  {
    const dimPath = resolve(root, "src/modules/launch/dim-hero.ts");
    const src = await readFile(dimPath, "utf8");
    if (/export\s+function\s+buildHeroDimmingOpacity\s*\(/.test(src)) {
      pass("5. dim-hero.ts buildHeroDimmingOpacity export");
    } else {
      fail("5. dim-hero export", "미발견");
    }
  }

  // 6) release-snapshot.ts 존재 + export.
  {
    const snapPath = resolve(root, "src/modules/launch/release-snapshot.ts");
    const src = await readFile(snapPath, "utf8");
    if (/export\s+function\s+buildReleaseSnapshot\s*\(/.test(src)) {
      pass("6. release-snapshot.ts buildReleaseSnapshot export");
    } else {
      fail("6. release-snapshot export", "미발견");
    }
  }

  // 7) post-auth-recover.ts 스켈레톤 + ATLASSIAN_API_TOKEN 핸들링.
  {
    const recoverPath = resolve(root, "scripts/post-auth-recover.ts");
    const src = await readFile(recoverPath, "utf8");
    const hasExport = /export\s+async\s+function\s+recoverMissingChildPages\s*\(/.test(src);
    const hasTokenHandling = /process\.env\.ATLASSIAN_API_TOKEN/.test(src);
    const noThrow = /result\.errors\.push.*ATLASSIAN_API_TOKEN not set/.test(src);
    if (hasExport && hasTokenHandling && noThrow) {
      pass("7. post-auth-recover.ts 스켈레톤 + ATLASSIAN_API_TOKEN 핸들링 (throw X)");
    } else {
      fail("7. post-auth-recover", `export=${hasExport} token=${hasTokenHandling} noThrow=${noThrow}`);
    }
  }

  // 8) i18n 4 키 ko/en parity.
  {
    const i18nPath = resolve(root, "src/modules/i18n/messages.ts");
    const src = await readFile(i18nPath, "utf8");
    const keys = [
      "release.snapshot.dday",
      "release.snapshot.regression",
      "release.snapshot.vercel",
      "release.snapshot.readiness",
    ];
    const allKeys = keys.every((k) => {
      const re = new RegExp(`["']${k.replace(/\./g, "\\.")}["']`, "g");
      const matches = src.match(re);
      return matches && matches.length >= 2; // ko + en
    });
    if (allKeys) {
      pass("8. i18n 4 키 ko/en parity (release.snapshot.{dday|regression|vercel|readiness})");
    } else {
      fail("8. i18n 4키", "ko/en parity 미충족");
    }
  }

  // 9) 보존 13.
  {
    const r = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
    if (r.code === 0) {
      pass("9. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail("9. 보존 13", `code=${r.code}`);
    }
  }

  // 10) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("10. 어휘 룰 — check:vocab 0건");
    } else {
      fail("10. 어휘 룰", `code=${r.code}`);
    }
  }

  // 11) 외부 dev-deps +0.
  {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    );
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`11. 외부 dev-deps +0 — devDependencies 카운트 = ${devCount}`);
    } else {
      fail("11. dev-deps", `expected 11, got ${devCount}`);
    }
  }

  // 12) check:i18n parity.
  {
    const r = await runChild("node", ["scripts/check-i18n-keys.mjs"]);
    if (r.code === 0) {
      pass("12. check:i18n parity (전체 키 ko/en 일치)");
    } else {
      fail("12. i18n parity", `code=${r.code}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d51 — FAIL");
  } else {
    console.log("verify:d51 — 12/12 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d51 — ERROR", err);
  process.exit(1);
});
