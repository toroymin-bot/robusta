#!/usr/bin/env node
/**
 * verify-d53.mjs
 *   - C-D53-1∼5 통합 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-1∼5.
 *
 * Why: D-D53 사이클 통합 게이트 — verify:all 35→36 자동 흡수.
 *   B-D51-4 release freeze 5/7 23시 진입 약 16시간 전 168 정식 28 사이클 도전.
 *   D-1 카운트다운 (5/8 자정 KST = 약 16시간) 안정성 사수.
 *
 * 자율 정정 (3건 — §5 똘이 슬롯 추인 큐):
 *   - D-53-자-1 (C-D53-5): 4 hero* motion-reduce 가드 현 상태 grep 사실 확정 — hero-live-transition +
 *                            hero-live-pulse 가드 1+/motion 1+, hero-title-slot + hero-live-banner motion 0
 *                            (정적 면제). §3 추정 3 권한 발동.
 *   - D-53-자-2 (C-D53-2): 명세 useT i18n hook 사용 추정 — 실 i18n MESSAGES (대문자) 직접 import 패턴 채택.
 *                            wiring 슬롯에서 useLocale 정합 검증 큐.
 *   - D-53-자-3 (C-D53-3): launch.shownh.locked 키 §1 등록 시점 wiring 큐 이월 — WIRING_QUEUE_KEYS
 *                            화이트리스트 추가. §11 똘이 EOD 슬롯 또는 settings UI wiring 큐.
 *
 * 게이트 (33/33 PASS 의무):
 *   1) verify:d53-cron 5/5 (C-D53-1)
 *   2) sim:hero-aria-live-region 4/4 (C-D53-2)
 *   3) verify:shownh-copy 10/10 (C-D53-3 강화)
 *   4) sim:kq23-banner-expiry 5/5 (C-D53-4)
 *   5) verify:d53-motion-reduce 4/4 (C-D53-5)
 *   6) HeroAriaLiveRegion + computeHeroAriaLiveText export grep
 *   7) shouldDismissKq23Banner + KQ23_BANNER_HOLD_MS export grep
 *   8) i18n launch.shownh.aria.live.now ko/en parity (1쌍 +2 키, parity 299→301)
 *   9) verify:d52 16/16 (D-D52 회귀 보호 — 168 정식 27→28 사이클)
 *  10) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)
 *  11) 어휘 룰 — check:vocab 0건
 *  12) 외부 dev-deps +0 (devDependencies 카운트 = 11)
 *  13) check:i18n parity (전체 키 ko/en 일치)
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
    "verify:d53 — D-D53 통합 13 게이트 (C-D53-1∼5 + 자율 정정 3건 + 168 정식 28 사이클)",
  );

  // 1) verify:d53-cron 5/5.
  {
    const r = await runChild("node", ["scripts/verify-d53-cron.mjs"]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("1. verify:d53-cron 5/5 PASS (C-D53-1)");
    } else {
      fail("1. verify:d53-cron", `code=${r.code}`);
    }
  }

  // 2) sim:hero-aria-live-region 4/4.
  {
    const r = await runChild("node", [
      "scripts/sim-hero-aria-live-region.mjs",
    ]);
    if (r.code === 0 && /4\/4 PASS/.test(r.stdout)) {
      pass("2. sim:hero-aria-live-region 4/4 PASS (C-D53-2)");
    } else {
      fail("2. sim:hero-aria-live-region", `code=${r.code}`);
    }
  }

  // 3) verify:shownh-copy 10/10 (C-D53-3 강화).
  {
    const r = await runChild("node", ["scripts/verify-shownh-copy.mjs"]);
    if (r.code === 0 && /10\/10 PASS/.test(r.stdout)) {
      pass("3. verify:shownh-copy 10/10 PASS (C-D53-3 강화)");
    } else {
      fail("3. verify:shownh-copy", `code=${r.code}`);
    }
  }

  // 4) sim:kq23-banner-expiry 5/5.
  {
    const r = await runChild("node", ["scripts/sim-kq23-banner-expiry.mjs"]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass("4. sim:kq23-banner-expiry 5/5 PASS (C-D53-4)");
    } else {
      fail("4. sim:kq23-banner-expiry", `code=${r.code}`);
    }
  }

  // 5) verify:d53-motion-reduce 4/4.
  {
    const r = await runChild("node", [
      "scripts/verify-d53-motion-reduce.mjs",
    ]);
    if (r.code === 0 && /4\/4 PASS/.test(r.stdout)) {
      pass("5. verify:d53-motion-reduce 4/4 PASS (C-D53-5)");
    } else {
      fail("5. verify:d53-motion-reduce", `code=${r.code}`);
    }
  }

  // 6) HeroAriaLiveRegion + computeHeroAriaLiveText export.
  {
    const p = resolve(root, "src/modules/launch/hero-aria-live-region.tsx");
    const src = await readFile(p, "utf8");
    if (
      /export\s+function\s+HeroAriaLiveRegion\s*\(/.test(src) &&
      /export\s+function\s+computeHeroAriaLiveText\s*\(/.test(src)
    ) {
      pass(
        "6. hero-aria-live-region.tsx HeroAriaLiveRegion + computeHeroAriaLiveText export",
      );
    } else {
      fail(
        "6. HeroAriaLiveRegion export",
        "HeroAriaLiveRegion 또는 computeHeroAriaLiveText 미발견",
      );
    }
  }

  // 7) shouldDismissKq23Banner + KQ23_BANNER_HOLD_MS export.
  {
    const p = resolve(root, "src/modules/launch/kq23-banner-expiry.ts");
    const src = await readFile(p, "utf8");
    if (
      /export\s+function\s+shouldDismissKq23Banner\s*\(/.test(src) &&
      /export\s+const\s+KQ23_BANNER_HOLD_MS\s*=/.test(src)
    ) {
      pass(
        "7. kq23-banner-expiry.ts shouldDismissKq23Banner + KQ23_BANNER_HOLD_MS export",
      );
    } else {
      fail(
        "7. kq23-banner-expiry export",
        "shouldDismissKq23Banner 또는 KQ23_BANNER_HOLD_MS 미발견",
      );
    }
  }

  // 8) i18n launch.shownh.aria.live.now ko/en parity.
  {
    const p = resolve(root, "src/modules/i18n/messages.ts");
    const src = await readFile(p, "utf8");
    const matches = src.match(/"launch\.shownh\.aria\.live\.now"/g);
    if (matches && matches.length === 2) {
      pass(
        "8. i18n launch.shownh.aria.live.now ko/en parity (+1쌍 +2키, parity 299→301)",
      );
    } else {
      fail(
        "8. i18n aria.live.now",
        `expected 2 occurrences, got ${matches?.length ?? 0}`,
      );
    }
  }

  // 9) verify:d52 회귀 (D-D52 16/16 PASS 보장).
  {
    const r = await runChild("node", ["scripts/verify-d52.mjs"]);
    if (r.code === 0 && /16\/16 PASS/.test(r.stdout)) {
      pass(
        "9. verify:d52 16/16 PASS (D-D52 회귀 보호 — 168 정식 27→28 사이클)",
      );
    } else {
      fail("9. verify:d52", `code=${r.code}`);
    }
  }

  // 10) 보존 13.
  {
    const r = await runChild("node", [
      "scripts/verify-conservation-13.mjs",
    ]);
    if (r.code === 0) {
      pass("10. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail("10. 보존 13", `code=${r.code}`);
    }
  }

  // 11) 어휘 룰.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("11. 어휘 룰 — check:vocab 0건");
    } else {
      fail("11. 어휘 룰", `code=${r.code}`);
    }
  }

  // 12) 외부 dev-deps +0.
  {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    );
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`12. 외부 dev-deps +0 — devDependencies 카운트 = ${devCount}`);
    } else {
      fail("12. dev-deps", `expected 11, got ${devCount}`);
    }
  }

  // 13) check:i18n parity.
  {
    const r = await runChild("node", ["scripts/check-i18n-keys.mjs"]);
    if (r.code === 0) {
      pass("13. check:i18n parity (전체 키 ko/en 일치, 299→301)");
    } else {
      fail("13. i18n parity", `code=${r.code}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d53 — FAIL");
  } else {
    console.log("verify:d53 — 13/13 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d53 — ERROR", err);
  process.exit(1);
});
