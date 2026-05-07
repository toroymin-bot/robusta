#!/usr/bin/env node
/**
 * verify-d55.mjs
 *   - C-D55-2 (D-1 13시 슬롯, 2026-05-07) — Tori spec C-D55-2 (D-D55 회귀 게이트).
 *
 * Why: Show HN submit 22:00 KST 정각 정합 + ManualRunButton 글로우 + hero* 4 직접 변경 0 + i18n 301 락.
 *   168 정식 HARD GATE 30 사이클 도전 — release freeze 5/7 23시 진입 약 9h 30m 전.
 *
 * 자율 정정 (D-55-자):
 *   - D-55-자-1: ManualRunButton 위치 'src/modules/launch/manual-run-button.tsx' 추정 →
 *                실 'src/modules/schedule/manual-run-button.tsx'. CSS는 launch 모듈 유지.
 *   - D-55-자-2: ManualRunButton phase prop 부재 — A-D54-자-2 패턴 정합 본체 변경 0 + CSS+globals.css OCP append만.
 *                wiring D+1 자율 슬롯 큐 (release freeze T-9.5h 위험 회피).
 *
 * 14 게이트 (14/14 PASS 의무):
 *   1) src/modules/launch/show-hn-submit-config.ts 존재
 *   2) releaseBaseUrl https:// 프로토콜 정합
 *   3) titleKo / titleEn 80자 이하 락
 *   4) bodyKo / bodyEn 800자 이하 락
 *   5) length ratio 0.4 이하 락 (titleKo / titleEn)
 *   6) i18n parity (전체 키 ko/en 일치 — 본 슬롯 변동 0)
 *   7) manual-run-button-glow.css 존재 + [data-phase="live"] selector + prefers-reduced-motion
 *   8) ManualRunButton 외 hero* 4 (transition/pulse/title-slot/live-banner) grep 0
 *   9) sim:show-hn-submit 5/5 PASS 호출
 *  10) dim-hero.ts buildHeroDimmingOpacity SoT 직접 재사용 정합 (산식 중복 0 grep)
 *  11) layout.tsx OCP append 정합 (HeroAriaLiveSlot §6 마운트 회귀 보호)
 *  12) external dev-deps +0 (devDependencies count = 11)
 *  13) 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)
 *  14) vocab rule 0건 (check:vocab --all)
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
    "verify:d55 — D-D55 14 게이트 (Show HN submit 22:00 KST + ManualRunButton 글로우 + 168 정식 30 사이클)",
  );

  // show-hn-submit-config.ts 본체 1회 읽기 (재사용).
  const configPath = "src/modules/launch/show-hn-submit-config.ts";
  let configSrc = "";
  let configExists = false;
  try {
    configSrc = await readFile(resolve(root, configPath), "utf8");
    configExists = true;
  } catch {
    configExists = false;
  }

  // 1) show-hn-submit-config.ts 존재.
  if (configExists) {
    pass("1. show-hn-submit-config.ts 존재");
  } else {
    fail("1. config 파일", `${configPath} 부재`);
  }

  // 데이터 추출 헬퍼 — 단순 정규식.
  function extractStringConst(name) {
    // const NAME = "...";  또는  const NAME = \n  "...";
    const re = new RegExp(
      `const\\s+${name}\\s*=\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)";`,
    );
    const m = configSrc.match(re);
    return m ? m[1] : null;
  }
  function extractJoinedArray(name) {
    // const NAME = [ "...", "...", ... ].join("\n\n");
    const re = new RegExp(
      `const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\.join\\("\\\\n\\\\n"\\);`,
    );
    const m = configSrc.match(re);
    if (!m) return null;
    const arrSrc = m[1];
    const items = [];
    const itemRe = /"((?:[^"\\]|\\.)*)"/g;
    let mm;
    while ((mm = itemRe.exec(arrSrc)) !== null) {
      items.push(mm[1]);
    }
    return items.join("\n\n");
  }

  const titleKo = configExists ? extractStringConst("TITLE_KO") : null;
  const titleEn = configExists ? extractStringConst("TITLE_EN") : null;
  const bodyKo = configExists ? extractJoinedArray("BODY_KO") : null;
  const bodyEn = configExists ? extractJoinedArray("BODY_EN") : null;

  // 2) releaseBaseUrl https:// 정합.
  {
    if (!configExists) {
      fail("2. releaseBaseUrl", "config 파일 부재");
    } else {
      const baseMatch = configSrc.match(/releaseBaseUrl:\s*"([^"]+)"/);
      const fallbackMatch = configSrc.match(
        /releaseFallbackUrl:\s*"([^"]+)"/,
      );
      const baseOk =
        baseMatch && /^https:\/\/robusta\.ai4min\.com/.test(baseMatch[1]);
      const fallbackOk =
        fallbackMatch &&
        /^https:\/\/[^/]+\.vercel\.app/.test(fallbackMatch[1]);
      if (baseOk && fallbackOk) {
        pass(
          `2. releaseBaseUrl https:// 정합 (base=${baseMatch[1]}, fallback=${fallbackMatch[1]})`,
        );
      } else {
        fail(
          "2. URL",
          `base=${baseMatch?.[1] ?? "?"}, fallback=${fallbackMatch?.[1] ?? "?"}`,
        );
      }
    }
  }

  // 3) title ≤ 80 chars.
  {
    if (!configExists || titleKo === null || titleEn === null) {
      fail("3. title length", "TITLE_KO/TITLE_EN 미발견");
    } else if (titleKo.length <= 80 && titleEn.length <= 80) {
      pass(
        `3. title ≤ 80 chars (titleKo=${titleKo.length}, titleEn=${titleEn.length})`,
      );
    } else {
      fail(
        "3. title length",
        `titleKo=${titleKo.length}, titleEn=${titleEn.length}`,
      );
    }
  }

  // 4) body ≤ 800 chars.
  {
    if (!configExists || bodyKo === null || bodyEn === null) {
      fail("4. body length", "BODY_KO/BODY_EN 미발견");
    } else if (bodyKo.length <= 800 && bodyEn.length <= 800) {
      pass(
        `4. body ≤ 800 chars (bodyKo=${bodyKo.length}, bodyEn=${bodyEn.length})`,
      );
    } else {
      fail(
        "4. body length",
        `bodyKo=${bodyKo.length}, bodyEn=${bodyEn.length}`,
      );
    }
  }

  // 5) length ratio ≤ 0.4 (titleKo / titleEn).
  {
    if (titleKo && titleEn) {
      const maxLen = Math.max(titleKo.length, titleEn.length);
      const ratio = Math.abs(titleKo.length - titleEn.length) / maxLen;
      if (ratio <= 0.4) {
        pass(`5. length ratio ≤ 0.4 (ratio=${ratio.toFixed(3)})`);
      } else {
        fail("5. length ratio", `ratio=${ratio.toFixed(3)} > 0.4`);
      }
    } else {
      fail("5. length ratio", "title 미발견");
    }
  }

  // 6) i18n parity (전체 키 ko/en 일치).
  {
    const r = await runChild("node", ["scripts/check-i18n-keys.mjs"]);
    if (r.code === 0) {
      pass("6. check:i18n parity (전체 키 ko/en 일치 — 본 슬롯 변동 0)");
    } else {
      fail("6. i18n parity", `code=${r.code}`);
    }
  }

  // 7) manual-run-button-glow.css 존재 + selector + prefers-reduced-motion.
  {
    const p = resolve(root, "src/modules/launch/manual-run-button-glow.css");
    let cssExists = false;
    let cssSrc = "";
    try {
      cssSrc = await readFile(p, "utf8");
      cssExists = true;
    } catch {
      cssExists = false;
    }
    const selectorOk = /\.manual-run-button\[data-phase="live"\]/.test(cssSrc);
    const reducedMotionOk = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(
      cssSrc,
    );
    if (cssExists && selectorOk && reducedMotionOk) {
      pass(
        "7. manual-run-button-glow.css 존재 + [data-phase=\"live\"] + prefers-reduced-motion 가드",
      );
    } else {
      fail(
        "7. CSS 파일",
        `exists=${cssExists}, selector=${selectorOk}, reducedMotion=${reducedMotionOk}`,
      );
    }
  }

  // 8) ManualRunButton 외 hero* 4 grep 0.
  {
    const heroFiles = [
      "src/modules/ui/hero-live-transition.tsx",
      "src/modules/ui/hero-live-pulse.tsx",
      "src/modules/ui/hero-title-slot.tsx",
      "src/modules/header/hero-live-banner.tsx",
    ];
    let polluted = 0;
    for (const f of heroFiles) {
      try {
        const src = await readFile(resolve(root, f), "utf8");
        if (
          /manual-run-button-glow/.test(src) ||
          /show-hn-submit-config/.test(src)
        ) {
          polluted += 1;
        }
      } catch {
        // 파일 부재 시 skip-pass.
      }
    }
    if (polluted === 0) {
      pass(
        "8. hero* 4 (transition/pulse/title-slot/live-banner) 직접 변경 0",
      );
    } else {
      fail(
        "8. hero* 4 direct change",
        `${polluted}개 파일에 본 슬롯 산출물 누출`,
      );
    }
  }

  // 9) sim:show-hn-submit 5/5 PASS — D-56-자-3 자율 정정: case 6 (T-30m warning) OCP append 흡수.
  //    D-53-자-4 정규식 확장 패턴 정합 — 5 → 6 케이스 확장 회귀 보호.
  {
    const r = await runChild("node", ["scripts/sim-show-hn-submit.mjs"]);
    if (r.code === 0 && /(5|6)\/(5|6) PASS/.test(r.stdout)) {
      pass("9. sim:show-hn-submit (5|6)/(5|6) PASS (URL/title/body/ratio/protocol [+T-30m])");
    } else {
      fail("9. sim:show-hn-submit", `code=${r.code}`);
    }
  }

  // 10) dim-hero.ts buildHeroDimmingOpacity SoT 직접 재사용 정합.
  //     산식 중복 = 다른 .ts 파일에서 'function buildHeroDimmingOpacity' 정의 0.
  {
    const dimHeroPath = "src/modules/launch/dim-hero.ts";
    let definitionFound = 0;
    const candidates = [
      "src/modules/launch/show-hn-submit-config.ts",
      "src/modules/launch/hero-aria-live-slot.tsx",
      "src/modules/launch/hero-aria-live-region.tsx",
      "src/modules/launch/use-hero-dimming-opacity.ts",
    ];
    // dim-hero.ts 자체에 1개 정의 있어야 함.
    const dimSrc = await readFile(resolve(root, dimHeroPath), "utf8");
    if (/export\s+function\s+buildHeroDimmingOpacity\s*\(/.test(dimSrc)) {
      definitionFound += 1;
    }
    // 다른 파일에 중복 정의 있으면 fail.
    let dupCount = 0;
    for (const f of candidates) {
      try {
        const src = await readFile(resolve(root, f), "utf8");
        if (/function\s+buildHeroDimmingOpacity\s*\(/.test(src)) {
          dupCount += 1;
        }
      } catch {
        // skip
      }
    }
    if (definitionFound === 1 && dupCount === 0) {
      pass(
        "10. dim-hero.ts buildHeroDimmingOpacity SoT 직접 재사용 (산식 중복 0)",
      );
    } else {
      fail(
        "10. SoT 산식",
        `dimHero defs=${definitionFound}, duplicates=${dupCount}`,
      );
    }
  }

  // 11) layout.tsx OCP append 정합 — HeroAriaLiveSlot §6 마운트 회귀 보호.
  {
    const layoutPath = "src/app/layout.tsx";
    const src = await readFile(resolve(root, layoutPath), "utf8");
    const importOk = /import\s*{\s*HeroAriaLiveSlot\s*}\s*from\s*"@\/modules\/launch\/hero-aria-live-slot"/.test(
      src,
    );
    const mountOk = /<HeroAriaLiveSlot\s*\/>/.test(src);
    if (importOk && mountOk) {
      pass(
        "11. layout.tsx OCP append 정합 (HeroAriaLiveSlot §6 회귀 보호)",
      );
    } else {
      fail(
        "11. layout.tsx",
        `import=${importOk}, mount=${mountOk}`,
      );
    }
  }

  // 12) external dev-deps +0 (devDependencies count = 11).
  {
    const pkg = JSON.parse(
      await readFile(resolve(root, "package.json"), "utf8"),
    );
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    if (devCount === 11) {
      pass(`12. external dev-deps +0 — devDependencies = ${devCount}`);
    } else {
      fail("12. dev-deps", `expected 11, got ${devCount}`);
    }
  }

  // 13) 보존 13 v3 무손상.
  {
    const r = await runChild("node", ["scripts/verify-conservation-13.mjs"]);
    if (r.code === 0) {
      pass("13. 보존 13 v3 무손상 (verify:conservation-13 6/6 PASS)");
    } else {
      fail("13. 보존 13", `code=${r.code}`);
    }
  }

  // 14) vocab rule 0건.
  {
    const r = await runChild("node", ["scripts/check-vocab.mjs", "--all"]);
    if (r.code === 0) {
      pass("14. vocab rule 0건 (check:vocab --all)");
    } else {
      fail("14. vocab", `code=${r.code}`);
    }
  }

  if (process.exitCode === 1) {
    console.error("verify:d55 — FAIL");
  } else {
    console.log("verify:d55 — 14/14 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d55 — ERROR", err);
  process.exit(1);
});
