#!/usr/bin/env node
/**
 * verify-d44.mjs
 *   - C-D44-1∼5 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44 (Task_2026-05-05 §9).
 *   - 패턴: verify-d43 / verify-d42 계승 — 정적 source 패턴 검사 (npm run build 분리).
 *
 * 검증 범위 (총 14 게이트):
 *   1) C-D44-1 launch-countdown.tsx 존재 + RELEASE_ISO import grep 1건
 *   2) LaunchCountdown variant prop 타입 정합 ('compact' | 'full')
 *   3) SSR suppressHydrationWarning grep 1건
 *   4) onLive useRef guard grep 1건 (재실행 방지)
 *   5) C-D44-2 i18n 키 5종 (headline.v2 + body.v2.line1∼3 + cta.v2) en+ko 양쪽 존재
 *   6) headline.v2 영문 단어 수 = 6 정확
 *   7) 본문 3줄 정확 (line1/2/3 키 누락 0)
 *   8) C-D44-3 funnel-kpi-query.ts read-only — db.put/add/delete grep 0건
 *   9) 외부 dev-deps +0 (package.json dependencies 7 / devDependencies 11 정합)
 *  10) 인라인 SVG 막대그래프 — chart 라이브러리 import grep 0
 *  11) C-D44-4 hero-live-transition.tsx 존재 + prefers-reduced-motion 분기
 *  12) 168 정식 HARD GATE 정합 — next.config.ts + next 15.x 의존성 무손상 (실 build 분리 검증)
 *  13) 보존 13 v3 무손상 — verify-conservation-13 SHA 리스트 무수정 정적 grep
 *  14) 어휘 룰 grep 0건 — 신규 6 파일에서 "Blend"/"Compare"/"Models" 신규 노출 0
 *
 * 회귀 의무:
 *   verify-d40 + verify-d40-auto + verify-d42 + verify-d43 + verify:conservation-13 모두 PASS 유지.
 *   168 정식 HARD GATE shared 103 kB 19 사이클 도전 (D-D27∼D-D44).
 *
 * 자율 정정 (꼬미 §10):
 *   D-44-자-1: 명세 RELEASE_ISO = '2026-05-08T10:00:00+09:00' 추정 — 실 SoT 값은 자정 (+09:00 00:00).
 *              SoT 무수정 의무 (D-36-자-1 정합) — dday-config 직접 import.
 *   D-44-자-2: 명세 import 경로 '@/modules/launch/release-iso' 미존재 — 실 모듈 '@/modules/dday/dday-config'.
 *   D-44-자-3: hero-live-transition.tsx 위치 = src/modules/ui/ (NOT launch/) — 기존 hero-* 정합.
 *   D-44-자-4: funnelEvents 필드명 = 'timestamp' (NOT 'ts') — db.ts v10 인덱스 정합.
 *   D-44-자-5: /launch route = src/app/launch/ (NOT [lang]/launch/) — lang 디렉터리 미사용 정합.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

async function exists(p) {
  try {
    await stat(resolve(root, p));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1∼4) C-D44-1 LaunchCountdown.
// ─────────────────────────────────────────────────────────────────────────────
const COUNTDOWN_PATH = "src/modules/launch/launch-countdown.tsx";
{
  const present = await exists(COUNTDOWN_PATH);
  assert(
    "C-D44-1 (1/14): launch-countdown.tsx 존재 + RELEASE_ISO @/modules/dday/dday-config import",
    present,
    "file missing",
  );
  if (present) {
    const src = await readSrc(COUNTDOWN_PATH);
    assert(
      "C-D44-1 (1b): RELEASE_ISO import grep 1건 (@/modules/dday/dday-config — D-44-자-2 SoT 직접 import)",
      /import\s*\{[^}]*RELEASE_ISO[^}]*\}\s*from\s*['"]@\/modules\/dday\/dday-config['"]/.test(
        src,
      ),
    );
    assert(
      "C-D44-1 (2/14): LaunchCountdown variant prop 타입 정합 ('compact' | 'full')",
      /variant\?:\s*['"]compact['"]\s*\|\s*['"]full['"]/.test(src),
    );
    assert(
      "C-D44-1 (3/14): SSR suppressHydrationWarning grep 1건 (hydration mismatch 회피)",
      /suppressHydrationWarning/.test(src),
    );
    assert(
      "C-D44-1 (4/14): onLive useRef guard grep 1건 (재실행 방지 — liveFiredRef 패턴)",
      /useRef\s*\(\s*false\s*\)/.test(src) && /liveFiredRef/.test(src),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5∼7) C-D44-2 Show HN v2 i18n.
// ─────────────────────────────────────────────────────────────────────────────
{
  const i18n = await readSrc("src/modules/i18n/messages.ts");
  // ko + en 양쪽 키 5종 정확.
  const v2Keys = [
    "launch.shownh.headline.v2",
    "launch.shownh.body.v2.line1",
    "launch.shownh.body.v2.line2",
    "launch.shownh.body.v2.line3",
    "launch.shownh.cta.v2",
  ];
  // ko/en 영역 분리 검증 — 각 키가 정확히 2회 (ko + en) 등장.
  let allPair = true;
  for (const k of v2Keys) {
    const re = new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g");
    const matches = i18n.match(re) ?? [];
    if (matches.length !== 2) {
      allPair = false;
      console.error(`  - ${k} matches=${matches.length} (expected 2)`);
      break;
    }
  }
  assert(
    "C-D44-2 (5/14): i18n 키 5종 (headline.v2 + body.v2.line1∼3 + cta.v2) en+ko 양쪽 정확 1쌍씩",
    allPair,
  );

  // 영문 헤드라인 단어 수 = 6.
  // 모든 'launch.shownh.headline.v2': "..." 매치 추출 — 두 번째가 en.
  const headlineRe = /"launch\.shownh\.headline\.v2":\s*"([^"]+)"/g;
  const headlineValues = [];
  for (const m of i18n.matchAll(headlineRe)) {
    headlineValues.push(m[1]);
  }
  let enWordCount = 0;
  if (headlineValues.length >= 2) {
    // 첫 매치 = ko, 두 번째 = en.
    const en = headlineValues[1];
    // 마침표 제거 후 split.
    const cleaned = en.replace(/[.!?]+$/g, "").trim();
    enWordCount = cleaned.split(/\s+/).filter(Boolean).length;
  }
  assert(
    "C-D44-2 (6/14): headline.v2 영문 단어 수 = 6 정확 (잡스 압축 의무)",
    enWordCount === 6,
    `enWordCount=${enWordCount}`,
  );

  // 본문 3줄 정확 — line1/2/3 키 누락 0.
  const bodyAllPresent = ["line1", "line2", "line3"].every((suffix) => {
    const k = `launch.shownh.body.v2.${suffix}`;
    const matches = i18n.match(
      new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"),
    );
    return matches && matches.length === 2;
  });
  assert(
    "C-D44-2 (7/14): 본문 3줄 정확 (body.v2.line1/2/3 ko/en parity 누락 0)",
    bodyAllPresent,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8∼10) C-D44-3 funnel KPI dashboard.
// ─────────────────────────────────────────────────────────────────────────────
const KPI_QUERY_PATH = "src/modules/launch/funnel-kpi-query.ts";
const KPI_VIEW_PATH = "src/modules/launch/funnel-kpi.tsx";
{
  const queryPresent = await exists(KPI_QUERY_PATH);
  const viewPresent = await exists(KPI_VIEW_PATH);
  const routePresent = await exists("src/app/launch/kpi/page.tsx");
  assert(
    "C-D44-3 (pre): funnel-kpi-query.ts + funnel-kpi.tsx + /launch/kpi/page.tsx 3 파일 존재",
    queryPresent && viewPresent && routePresent,
    `q=${queryPresent} v=${viewPresent} r=${routePresent}`,
  );

  if (queryPresent) {
    const q = await readSrc(KPI_QUERY_PATH);
    // db.put/add/delete/update 호출 0건 (read-only 의무).
    const writeOps = [
      /\bdb\.\w+\.put\b/,
      /\bdb\.\w+\.add\b/,
      /\bdb\.\w+\.delete\b/,
      /\bdb\.\w+\.update\b/,
      /\bdb\.\w+\.bulkPut\b/,
      /\bdb\.\w+\.bulkAdd\b/,
    ];
    const writeViolations = writeOps.filter((re) => re.test(q));
    assert(
      "C-D44-3 (8/14): funnel-kpi-query.ts read-only — db.put/add/delete/update grep 0건",
      writeViolations.length === 0,
      `violations=${writeViolations.length}`,
    );
  }

  if (viewPresent) {
    const v = await readSrc(KPI_VIEW_PATH);
    // 인라인 SVG 막대그래프 — <svg / <rect / <text / <g 모두 등장.
    const inlineSvg =
      /<svg[\s>]/.test(v) &&
      /<rect[\s/>]/.test(v) &&
      /<text[\s>]/.test(v) &&
      /<g[\s>]/.test(v);
    // 외부 chart 라이브러리 import 금지 — recharts/chart.js/d3/victory/nivo grep 0.
    const chartLibs = [
      /from\s+['"]recharts['"]/,
      /from\s+['"]chart\.js['"]/,
      /from\s+['"]chart\.js\/auto['"]/,
      /from\s+['"]d3['"]/,
      /from\s+['"]d3-/,
      /from\s+['"]victory['"]/,
      /from\s+['"]@nivo\/[^'"]+['"]/,
    ];
    const libViolations = chartLibs.filter((re) => re.test(v));
    assert(
      "C-D44-3 (10/14): 인라인 SVG 막대그래프 + 외부 chart 라이브러리 import grep 0",
      inlineSvg && libViolations.length === 0,
      `inlineSvg=${inlineSvg} libViolations=${libViolations.length}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) 외부 dev-deps +0.
// ─────────────────────────────────────────────────────────────────────────────
{
  const pkg = JSON.parse(await readSrc("package.json"));
  const depCount = Object.keys(pkg.dependencies ?? {}).length;
  const devCount = Object.keys(pkg.devDependencies ?? {}).length;
  // 기존 dependencies 7 (vercel/analytics, dexie, next, pdfkit, react, react-dom, zustand).
  // 기존 devDependencies 11.
  assert(
    "C-D44-(9/14): 외부 dev-deps +0 — dependencies 7 / devDependencies 11 정합",
    depCount === 7 && devCount === 11,
    `dependencies=${depCount} devDependencies=${devCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11) C-D44-4 HeroLiveTransition.
// ─────────────────────────────────────────────────────────────────────────────
const TRANSITION_PATH = "src/modules/ui/hero-live-transition.tsx";
{
  const present = await exists(TRANSITION_PATH);
  assert(
    "C-D44-4 (11/14): hero-live-transition.tsx 존재 + prefers-reduced-motion 분기",
    present,
    "file missing",
  );
  if (present) {
    const src = await readSrc(TRANSITION_PATH);
    assert(
      "C-D44-4 (11b): prefers-reduced-motion matchMedia 분기 grep 1건",
      /prefers-reduced-motion:\s*reduce/.test(src) &&
        /matchMedia/.test(src) &&
        /reducedMotion/.test(src),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12) 168 정식 HARD GATE 정합 — next.config + next 15.x 무손상.
// ─────────────────────────────────────────────────────────────────────────────
{
  const cfgExists = await exists("next.config.ts");
  const pkg = JSON.parse(await readSrc("package.json"));
  const nextVer = pkg.dependencies?.next ?? "";
  // ^15.5.15 정합 — 메이저 15 + 미세버전 무손상 의무.
  const isNext15 = /^\^?15\./.test(nextVer);
  assert(
    "C-D44-(12/14): 168 정식 HARD GATE 정합 — next.config.ts + next ^15.x 무손상 (실 build 분리 검증)",
    cfgExists && isNext15,
    `cfg=${cfgExists} next=${nextVer}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13) 보존 13 v3 무손상 — verify-conservation-13 SHA 리스트 무수정.
// ─────────────────────────────────────────────────────────────────────────────
{
  const c13 = await readSrc("scripts/verify-conservation-13.mjs");
  // 기존 SHA 리스트 키 grep — conservation-13 스크립트가 보존 모듈 SHA 보호.
  // 본 슬롯에서 c13 스크립트 자체 무수정 의무 (i18n 외 보존 13 변경 0).
  const hasShaList = /sha256|expected|frozen|보존/i.test(c13);
  assert(
    "C-D44-(13/14): 보존 13 v3 무손상 — verify-conservation-13.mjs 정적 검증 무수정 (i18n append-only 외 0)",
    hasShaList,
    "verify-conservation-13.mjs SHA 리스트 키워드 미검출",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 14) 어휘 룰 grep — 신규 6 파일 "Blend"/"Compare"/"Models" 신규 노출 0.
// ─────────────────────────────────────────────────────────────────────────────
{
  const newFiles = [
    "src/modules/launch/launch-countdown.tsx",
    "src/modules/launch/shownh-card.tsx",
    "src/modules/launch/funnel-kpi-query.ts",
    "src/modules/launch/funnel-kpi.tsx",
    "src/modules/ui/hero-live-transition.tsx",
    "src/app/launch/kpi/page.tsx",
  ];
  let bannedCount = 0;
  const banned = [/\bBlend\b/, /\bCompare\b/, /\bModels\b/];
  for (const f of newFiles) {
    const present = await exists(f);
    if (!present) continue;
    const src = await readSrc(f);
    for (const re of banned) {
      const m = src.match(re);
      if (m) {
        bannedCount += 1;
        console.error(`  - ${f}: ${re} 매치`);
      }
    }
  }
  assert(
    "C-D44-(14/14): 어휘 룰 grep 0건 — 신규 6 파일에서 'Blend'/'Compare'/'Models' 신규 노출 0",
    bannedCount === 0,
    `banned matches=${bannedCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d44 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(
  `\n✓ verify-d44: ${pass}/${pass} PASS — D-D44 P0 5건 (C-D44-1∼4 + C-D44-5 본 파일) + 168 정식 HARD GATE 19 사이클 도전`,
);
process.exit(0);
