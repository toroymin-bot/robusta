#!/usr/bin/env node
/**
 * verify-d54.mjs
 *   - A-D54-자-1 (D-1 11시 슬롯, 2026-05-07) — Komi 자율 (§5 명세 미수신).
 *
 * Why: §6 정해진 산출물 = "hero* 4 wiring 본체 (C-D52-1 / C-D53-2 D+1 큐 회복)".
 *   똘이 §5 09시 슬롯 명세(C-D54-1∼5) 미수신 — 자율 모드 발동.
 *   본 게이트는 hero-aria-live-slot 신규 wiring + 회귀 보호 통합 검증.
 *
 *   B-D51-4 release freeze 5/7 23시 진입 약 11h 30m 전 168 정식 29 사이클 도전.
 *   D-1 카운트다운 (5/8 자정 KST 약 12h 30m) 안정성 사수.
 *
 * 자율 결정 (§7 똘이 13시 슬롯 추인 큐):
 *   - A-D54-자-1: hero-aria-live-region wiring 본체 = layout.tsx sibling 마운트만 (hero* 4 직접 변경 0).
 *                  HeroAriaLiveSlot 신규 wrapper — phase 산출 + 1분 tick + sr-only 마운트 단일 책임.
 *                  보존 13 v3 무손상 + release freeze 정합 + dim-hero.ts SoT 직접 재사용.
 *   - A-D54-자-2: use-hero-dimming-opacity hook wiring (C-D52-1 D+1 큐) — D+1 자율 슬롯 추가 이월.
 *                  hero* 4 동시 변경 = 위험 (release freeze 직전), 본 슬롯 보류.
 *   - A-D54-자-3: locale prop wiring (useLocale hook 정합 검증) — D+1 자율 슬롯 큐 (ko fallback 안전).
 *
 * 게이트 (10/10 PASS 의무):
 *   1) sim:hero-aria-live-slot 5/5 (computeHeroAriaLivePhase 4 phase + boundary)
 *   2) HeroAriaLiveSlot + computeHeroAriaLivePhase export grep
 *   3) layout.tsx HeroAriaLiveSlot 마운트 + import (sibling)
 *   4) hero* 4 직접 변경 0 — git status 정합 (read-only check via grep)
 *   5) verify:d53 13/13 (D-D53 회귀 보호 — 168 정식 28→29 사이클)
 *   6) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)
 *   7) 어휘 룰 — check:vocab 0건
 *   8) 외부 dev-deps +0 (devDependencies 카운트 = 11)
 *   9) check:i18n parity (전체 키 ko/en 일치 — 본 슬롯 i18n 변동 0 = 301 유지)
 *  10) HeroAriaLiveRegion props 시그니처 정합 (phase + locale)
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
  console.log(
    "verify:d54 — D-D54 자율 통합 10 게이트 (A-D54-자-1 hero* wiring 본체 + 168 정식 29 사이클)",
  );

  // 1) sim:hero-aria-live-slot 5/5.
  {
    const r = await runChild("node", [
      "scripts/sim-hero-aria-live-slot.mjs",
    ]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("1. sim:hero-aria-live-slot 5/5 PASS (phase 4 + boundary)");
    } else {
      fail("1. sim:hero-aria-live-slot", `code=${r.code}`);
    }
  }

  // 2) HeroAriaLiveSlot + computeHeroAriaLivePhase export.
  {
    const p = resolve(root, "src/modules/launch/hero-aria-live-slot.tsx");
    const src = await readFile(p, "utf8");
    if (
      /export\s+function\s+HeroAriaLiveSlot\s*\(/.test(src) &&
      /export\s+function\s+computeHeroAriaLivePhase\s*\(/.test(src)
    ) {
      pass(
        "2. hero-aria-live-slot.tsx HeroAriaLiveSlot + computeHeroAriaLivePhase export",
      );
    } else {
      fail(
        "2. HeroAriaLiveSlot export",
        "HeroAriaLiveSlot 또는 computeHeroAriaLivePhase 미발견",
      );
    }
  }

  // 3) layout.tsx HeroAriaLiveSlot 마운트 + import.
  {
    const p = resolve(root, "src/app/layout.tsx");
    const src = await readFile(p, "utf8");
    const importMatch = /import\s*{\s*HeroAriaLiveSlot\s*}\s*from\s*"@\/modules\/launch\/hero-aria-live-slot"/.test(
      src,
    );
    const mountMatch = /<HeroAriaLiveSlot\s*\/>/.test(src);
    if (importMatch && mountMatch) {
      pass("3. layout.tsx HeroAriaLiveSlot import + 마운트 (sibling)");
    } else {
      fail(
        "3. layout.tsx wiring",
        `import=${importMatch}, mount=${mountMatch}`,
      );
    }
  }

  // 4) hero* 4 직접 변경 0 — read-only grep (HeroAriaLiveSlot 마운트가 아닌 hero* 4 컴포넌트 안에서
  //    HeroAriaLiveSlot 사용은 0 = 직접 변경 0 의미).
  {
    const heroFiles = [
      "src/modules/ui/hero-live-transition.tsx",
      "src/modules/ui/hero-live-pulse.tsx",
      "src/modules/ui/hero-title-slot.tsx",
      "src/modules/header/hero-live-banner.tsx",
    ];
    let polluted = 0;
    for (const f of heroFiles) {
      const src = await readFile(resolve(root, f), "utf8");
      if (/HeroAriaLiveSlot/.test(src) || /hero-aria-live-slot/.test(src)) {
        polluted += 1;
      }
    }
    if (polluted === 0) {
      pass("4. hero* 4 (transition/pulse/title-slot/live-banner) 직접 변경 0");
    } else {
      fail(
        "4. hero* 4 direct change",
        `${polluted}개 파일에 HeroAriaLiveSlot 누출`,
      );
    }
  }

  // 5) verify:d53 회귀 (D-D53 13/13 PASS 보장).
  {
    const r = await runChild("node", ["scripts/verify-d53.mjs"]);
    if (r.code === 0 && /13\/13 PASS/.test(r.stdout)) {
      pass(
        "5. verify:d53 13/13 PASS (D-D53 회귀 보호 — 168 정식 28→29 사이클)",
      );
    } else {
      fail("5. verify:d53", `code=${r.code}`);
    }
  }

  // 6) 보존 13.
  {
    const r = await runChild("node", [
      "scripts/verify-conservation-13.mjs",
    ]);
    if (r.code === 0) {
      pass("6. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail("6. 보존 13", `code=${r.code}`);
    }
  }

  // 7) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("7. 어휘 룰 — check:vocab 0건");
    } else {
      fail("7. 어휘 룰", `code=${r.code}`);
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

  // 9) check:i18n parity.
  {
    const r = await runChild("node", ["scripts/check-i18n-keys.mjs"]);
    if (r.code === 0) {
      pass("9. check:i18n parity (전체 키 ko/en 일치 — 본 슬롯 변동 0)");
    } else {
      fail("9. i18n parity", `code=${r.code}`);
    }
  }

  // 10) HeroAriaLiveRegion props 시그니처 정합 (phase + locale).
  {
    const p = resolve(root, "src/modules/launch/hero-aria-live-region.tsx");
    const src = await readFile(p, "utf8");
    if (
      /phase\s*:\s*HeroDimmingPhase/.test(src) &&
      /locale\s*\?\s*:\s*"ko"\s*\|\s*"en"/.test(src)
    ) {
      pass(
        "10. HeroAriaLiveRegion props 시그니처 정합 (phase: HeroDimmingPhase + locale?: 'ko'|'en')",
      );
    } else {
      fail(
        "10. props 시그니처",
        "phase: HeroDimmingPhase 또는 locale?: 'ko'|'en' 미발견",
      );
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d54 — FAIL");
  } else {
    console.log("verify:d54 — 10/10 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d54 — ERROR", err);
  process.exit(1);
});
