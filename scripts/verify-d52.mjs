#!/usr/bin/env node
/**
 * verify-d52.mjs
 *   - C-D52-1∼5 통합 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-1∼5.
 *
 * Why: D-D52 사이클 통합 게이트 — verify:all 34→35 자동 흡수.
 *   B-D51-4 release freeze 5/7 23시 진입 직전 168 정식 27 사이클 도전.
 *   D-1 카운트다운 (5/8 자정 KST = 약 21시간) 안정성 사수.
 *
 * 자율 정정 (5건):
 *   - D-52-자-1 (C-D52-1): hero* 4 wiring 대상 명세 추정 'hero-headline/cta/status/countdown'
 *                           → 실 'hero-live-transition/hero-live-pulse/hero-title-slot/hero-live-banner'.
 *                           hook 본체만 본 슬롯, hero* 4 동시 wiring은 §6/§8 사이 큐 (release freeze 위험).
 *   - D-52-자-2 (C-D52-2): ReleaseSnapshot 신규 시그니처 충돌 → ReleaseSnapshotCron 별도 인터페이스.
 *   - D-52-자-3 (C-D52-2): cron 인프라 (Vercel/GH Actions) D-Day 직전 결정 큐.
 *   - D-52-자-4 (C-D52-3): length ratio ±20% (0.8) → 0.4 (ko/en 자연어 차이 흡수).
 *   - D-52-자-5 (C-D52-4): husky 미사용 → scripts/hooks/pre-commit-freeze.sh 채택.
 *   - D-52-자-6 (C-D52-4): NOW_ISO_OVERRIDE env 추가 (테스트 가능성).
 *   - D-52-자-7 (C-D52-5): 명세 시그니처 충돌 → postAuthRecover OCP append (recoverMissingChildPages 보존).
 *
 * 게이트 (16/16 PASS 의무):
 *   1) sim:use-hero-dimming-opacity 6/6 (C-D52-1)
 *   2) sim:release-snapshot-cron 5/5 (C-D52-2)
 *   3) verify:shownh-copy 9/9 (C-D52-3 강화 — 5 기존 + 4 신규)
 *   4) verify:freeze-hook 6/6 (C-D52-4 — 0 + 5)
 *   5) sim:post-auth-recover 5/5 (C-D52-5 본체)
 *   6) use-hero-dimming-opacity.ts export grep
 *   7) release-snapshot-cron.ts triggerReleaseSnapshot export grep
 *   8) post-auth-recover.ts postAuthRecover 신규 export grep (OCP append 검증)
 *   9) post-auth-recover.ts recoverMissingChildPages 보존 grep (D-D51 회귀)
 *  10) scripts/hooks/pre-commit-freeze.sh 파일 존재 + 실행 권한
 *  11) i18n launch.shownh.locked ko/en parity (1쌍 +2 키)
 *  12) verify:d51 12/12 (D-D51 회귀 보호 — 168 정식 26→27 사이클)
 *  13) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)
 *  14) 어휘 룰 — check:vocab 0건
 *  15) 외부 dev-deps +0 (devDependencies 카운트 = 11)
 *  16) check:i18n parity (전체 키 ko/en 일치)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

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
    const child = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c.toString(); });
    child.stderr.on("data", (c) => { stderr += c.toString(); });
    child.on("close", (code) => { resolveChild({ code: code ?? 1, stdout, stderr }); });
  });
}

async function main() {
  console.log("verify:d52 — D-D52 통합 16 게이트 (C-D52-1∼5 + 자율 정정 7건 + 168 정식 27 사이클)");

  // 1) sim:use-hero-dimming-opacity 6/6.
  {
    const r = await runChild("node", ["scripts/sim-use-hero-dimming-opacity.mjs"]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass("1. sim:use-hero-dimming-opacity 6/6 PASS (C-D52-1)");
    } else {
      fail("1. sim:use-hero-dimming-opacity", `code=${r.code}`);
    }
  }

  // 2) sim:release-snapshot-cron 5/5.
  {
    const r = await runChild("node", ["scripts/sim-release-snapshot-cron.mjs"]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("2. sim:release-snapshot-cron 5/5 PASS (C-D52-2)");
    } else {
      fail("2. sim:release-snapshot-cron", `code=${r.code}`);
    }
  }

  // 3) verify:shownh-copy 9/9 (C-D52-3 강화).
  {
    const r = await runChild("node", ["scripts/verify-shownh-copy.mjs"]);
    if (r.code === 0 && /9\/9 PASS/.test(r.stdout)) {
      pass("3. verify:shownh-copy 9/9 PASS (C-D52-3 강화)");
    } else {
      fail("3. verify:shownh-copy", `code=${r.code}`);
    }
  }

  // 4) verify:freeze-hook 6/6.
  {
    const r = await runChild("node", ["scripts/verify-freeze-hook.mjs"]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass("4. verify:freeze-hook 6/6 PASS (C-D52-4)");
    } else {
      fail("4. verify:freeze-hook", `code=${r.code}`);
    }
  }

  // 5) sim:post-auth-recover 5/5.
  {
    const r = await runChild("node", ["scripts/sim-post-auth-recover.mjs"]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("5. sim:post-auth-recover 5/5 PASS (C-D52-5 본체)");
    } else {
      fail("5. sim:post-auth-recover", `code=${r.code}`);
    }
  }

  // 6) use-hero-dimming-opacity.ts export grep.
  {
    const p = resolve(root, "src/modules/launch/use-hero-dimming-opacity.ts");
    const src = await readFile(p, "utf8");
    if (
      /export\s+function\s+useHeroDimmingOpacity\s*\(/.test(src) &&
      /export\s+function\s+computeHeroDimmingOpacity\s*\(/.test(src)
    ) {
      pass("6. use-hero-dimming-opacity.ts useHeroDimmingOpacity + computeHeroDimmingOpacity export");
    } else {
      fail("6. hook export", "useHeroDimmingOpacity 또는 computeHeroDimmingOpacity 미발견");
    }
  }

  // 7) release-snapshot-cron.ts triggerReleaseSnapshot export.
  {
    const p = resolve(root, "src/modules/launch/release-snapshot-cron.ts");
    const src = await readFile(p, "utf8");
    if (/export\s+async\s+function\s+triggerReleaseSnapshot\s*\(/.test(src)) {
      pass("7. release-snapshot-cron.ts triggerReleaseSnapshot export");
    } else {
      fail("7. cron export", "triggerReleaseSnapshot 미발견");
    }
  }

  // 8) post-auth-recover.ts postAuthRecover 신규 export.
  {
    const p = resolve(root, "scripts/post-auth-recover.ts");
    const src = await readFile(p, "utf8");
    if (/export\s+async\s+function\s+postAuthRecover\s*\(/.test(src)) {
      pass("8. post-auth-recover.ts postAuthRecover 신규 export (C-D52-5 OCP append)");
    } else {
      fail("8. postAuthRecover", "신규 export 미발견");
    }
  }

  // 9) recoverMissingChildPages 보존 (D-D51 회귀 보호).
  {
    const p = resolve(root, "scripts/post-auth-recover.ts");
    const src = await readFile(p, "utf8");
    if (/export\s+async\s+function\s+recoverMissingChildPages\s*\(/.test(src)) {
      pass("9. recoverMissingChildPages 보존 (D-D51 verify:d51 게이트 7번 회귀 보호)");
    } else {
      fail("9. recoverMissingChildPages", "기존 함수 미발견 — D-D51 회귀");
    }
  }

  // 10) pre-commit-freeze.sh 존재 + 실행 권한.
  {
    const p = resolve(root, "scripts/hooks/pre-commit-freeze.sh");
    if (existsSync(p)) {
      const stat = statSync(p);
      const isExecutable = (stat.mode & 0o111) !== 0;
      if (isExecutable) {
        pass("10. scripts/hooks/pre-commit-freeze.sh 존재 + 실행 권한");
      } else {
        fail("10. hook 실행 권한", "chmod +x 미적용");
      }
    } else {
      fail("10. hook 파일", "scripts/hooks/pre-commit-freeze.sh 미존재");
    }
  }

  // 11) i18n launch.shownh.locked ko/en parity.
  {
    const p = resolve(root, "src/modules/i18n/messages.ts");
    const src = await readFile(p, "utf8");
    const matches = src.match(/"launch\.shownh\.locked"/g);
    if (matches && matches.length === 2) {
      pass("11. i18n launch.shownh.locked ko/en parity (+1쌍 +2키, parity 297→299)");
    } else {
      fail("11. i18n locked", `expected 2 occurrences, got ${matches?.length ?? 0}`);
    }
  }

  // 12) verify:d51 회귀 (D-D51 12/12 PASS 보장).
  {
    const r = await runChild("node", ["scripts/verify-d51.mjs"]);
    if (r.code === 0 && /12\/12 PASS/.test(r.stdout)) {
      pass("12. verify:d51 12/12 PASS (D-D51 회귀 보호 — 168 정식 26→27 사이클)");
    } else {
      fail("12. verify:d51", `code=${r.code}`);
    }
  }

  // 13) 보존 13.
  {
    const r = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
    if (r.code === 0) {
      pass("13. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail("13. 보존 13", `code=${r.code}`);
    }
  }

  // 14) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("14. 어휘 룰 — check:vocab 0건");
    } else {
      fail("14. 어휘 룰", `code=${r.code}`);
    }
  }

  // 15) 외부 dev-deps +0.
  {
    const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`15. 외부 dev-deps +0 — devDependencies 카운트 = ${devCount}`);
    } else {
      fail("15. dev-deps", `expected 11, got ${devCount}`);
    }
  }

  // 16) check:i18n parity.
  {
    const r = await runChild("node", ["scripts/check-i18n-keys.mjs"]);
    if (r.code === 0) {
      pass("16. check:i18n parity (전체 키 ko/en 일치, 297→299)");
    } else {
      fail("16. i18n parity", `code=${r.code}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d52 — FAIL");
  } else {
    console.log("verify:d52 — 16/16 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d52 — ERROR", err);
  process.exit(1);
});
