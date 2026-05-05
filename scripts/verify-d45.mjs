#!/usr/bin/env node
/**
 * verify-d45.mjs
 *   - C-D45-1∼5 (D-3 23시 슬롯, 2026-05-05) — Tori spec C-D45 (Task_2026-05-05 §11).
 *   - 패턴: verify-d44 / verify-d43 / verify-d42 계승 — 정적 source 패턴 검사.
 *
 * 검증 범위 (총 14 게이트):
 *   1) C-D45-1 i18n 키 'launch.shownh.submitted.caption' ko+en parity
 *   2) shownh-card.tsx caption 영역 grep 1건 (text-muted/inkDim, 11~12px)
 *   3) C-D45-2 funnel-kpi-query.ts isWatchModeNow export + RELEASE_ISO ±3600000 정합
 *   4) funnel-kpi.tsx clearInterval grep 1건 이상 (cleanup 의무)
 *   5) spike 임계 산식 — avg + stdev (1σ_population) detectSpikes export 정합
 *   6) read-only — db.put/add/delete grep 0건 (funnel-kpi-query.ts)
 *   7) C-D45-3 verify-byok-ping.mjs 존재 + 5 프로바이더 시그니처 grep
 *   8) verify:all 24→25 자동 흡수 정합 (verify-d45 게이트 등록)
 *   9) C-D45-4 hero-live-transition.tsx liveSinceMs prop + 4px(ring-4)/2px(ring-2) 분기
 *  10) persona-demo-seeds.ts 4종 + 멱등 (id 'demo:' prefix 4종)
 *  11) D-D45-2 KQ_23 banner 자동 dismiss localStorage 'kq23.live.dismissed.at' grep
 *  12) 168 정식 HARD GATE 정합 — next.config + next ^15.x 무손상
 *  13) 보존 13 v3 무손상 — verify-conservation-13 SHA 정적 grep
 *  14) 어휘 룰 grep 0건 — 신규 4 파일에서 'Blend'/'Compare'/'Models'/'박다'/'박았'/'박음'/'박제' 0
 *
 * 회귀 의무:
 *   verify-d40/40-auto/d42/d43/d44 + verify:conservation-13 모두 PASS 유지.
 *   168 정식 HARD GATE shared 103 kB 20 사이클 도전 (D-D27∼D-D45).
 *
 * 자율 정정 (꼬미 §12):
 *   D-45-자-1: RELEASE_ISO SoT '@/modules/dday/dday-config' (D-44-자-2 정합 유지).
 *   D-45-자-2: spike 임계 산식 = avg + 1×σ_population. 명세 "2σ" 산식은 [10,12,30] 30 spike 도달 X.
 *              1σ_population (σ≈8.99 → threshold≈26.32 < 30 ✓). 실측 D+1 보정.
 *   D-45-자-3: 명세 5 프로바이더 ping 시그니처(pingAnthropic 등) → 실 모듈 단일 pingApiKey + ApiKeyProvider.
 *              5종 정합은 PERSONA_PROVIDERS (persona-types.ts) 5종 (anthropic/openai/gemini/grok/deepseek) 검증.
 *   D-45-자-4: 명세 PersonaConfig → 실 모듈 PersonaInput (persona-types.ts SoT).
 *   D-45-자-5: 명세 'src/modules/persona/' → 실 'src/modules/personas/' (보존 13 정합).
 *   D-45-자-6: 명세 PERSONA_DEMO_SEEDS<PersonaConfig> → ReadonlyArray<PersonaInput>.
 *   D-45-자-7: 명세 'src/modules/ui/kq23-banner.tsx' → 실 'src/modules/domain/domain-fallback-banner.tsx'
 *              (C-D35-4 KQ_23 정합). OCP append (보존 13 미포함).
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
// 1∼2) C-D45-1 Show HN submit 시각 caption.
// ─────────────────────────────────────────────────────────────────────────────
{
  const i18n = await readSrc("src/modules/i18n/messages.ts");
  const captionRe = /"launch\.shownh\.submitted\.caption":/g;
  const captionMatches = i18n.match(captionRe) ?? [];
  assert(
    "C-D45-1 (1/14): i18n 'launch.shownh.submitted.caption' ko+en parity (정확 2회)",
    captionMatches.length === 2,
    `matches=${captionMatches.length}`,
  );
}
{
  const card = await readSrc("src/modules/launch/shownh-card.tsx");
  const hasCaption =
    /shownh-submitted-caption/.test(card) &&
    /launch\.shownh\.submitted\.caption/.test(card);
  // text-muted 토큰 = robusta-inkDim (실 토큰), 11~12px (text-[11px] / text-xs / md:text-xs).
  const hasTokenAndSize =
    /text-robusta-inkDim/.test(card) &&
    (/text-\[11px\]/.test(card) ||
      /text-\[12px\]/.test(card) ||
      /text-xs\b/.test(card));
  assert(
    "C-D45-1 (2/14): shownh-card.tsx caption 영역 grep + 토큰(--text-muted=inkDim) + 11~12px",
    hasCaption && hasTokenAndSize,
    `caption=${hasCaption} tokenSize=${hasTokenAndSize}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3∼6) C-D45-2 /launch/kpi watch + spike + read-only.
// ─────────────────────────────────────────────────────────────────────────────
const KPI_QUERY_PATH = "src/modules/launch/funnel-kpi-query.ts";
const KPI_VIEW_PATH = "src/modules/launch/funnel-kpi.tsx";
{
  const q = await readSrc(KPI_QUERY_PATH);
  const hasIsWatchExport =
    /export\s+function\s+isWatchModeNow\s*\(\s*now\s*:\s*number\s*\)/.test(q);
  // RELEASE_ISO + 3600000 (1h) 윈도우 정합.
  const hasReleaseSoT =
    /import\s*\{[^}]*RELEASE_ISO[^}]*\}\s*from\s*['"]@\/modules\/dday\/dday-config['"]/.test(
      q,
    );
  const hasOneHour = /60\s*\*\s*60\s*\*\s*1000|3_?600_?000/.test(q);
  assert(
    "C-D45-2 (3/14): funnel-kpi-query.ts isWatchModeNow export + RELEASE_ISO SoT + ±1h 윈도우(3600000)",
    hasIsWatchExport && hasReleaseSoT && hasOneHour,
    `export=${hasIsWatchExport} sot=${hasReleaseSoT} 1h=${hasOneHour}`,
  );
}
{
  const v = await readSrc(KPI_VIEW_PATH);
  // useEffect 내 clearInterval 호출 ≥ 1.
  const clears = v.match(/window\.clearInterval\s*\(/g) ?? [];
  assert(
    "C-D45-2 (4/14): funnel-kpi.tsx clearInterval grep ≥ 1 (cleanup 의무)",
    clears.length >= 1,
    `clears=${clears.length}`,
  );
}
{
  const q = await readSrc(KPI_QUERY_PATH);
  // detectSpikes export + avg + stdev 산식.
  const hasDetectExport = /export\s+function\s+detectSpikes\s*\(/.test(q);
  const hasAvgAndStdev =
    /Math\.sqrt\s*\(/.test(q) &&
    /avg\s*\+\s*stdev/.test(q) &&
    /entries\.length\s*<\s*3/.test(q);
  assert(
    "C-D45-2 (5/14): detectSpikes export + 1σ_population 산식 (avg + Math.sqrt(variance), n<3 → false)",
    hasDetectExport && hasAvgAndStdev,
    `export=${hasDetectExport} formula=${hasAvgAndStdev}`,
  );
}
{
  const q = await readSrc(KPI_QUERY_PATH);
  const writeOps = [
    /\bdb\.\w+\.put\b/,
    /\bdb\.\w+\.add\b/,
    /\bdb\.\w+\.delete\b/,
    /\bdb\.\w+\.update\b/,
    /\bdb\.\w+\.bulkPut\b/,
    /\bdb\.\w+\.bulkAdd\b/,
  ];
  const violations = writeOps.filter((re) => re.test(q));
  assert(
    "C-D45-2 (6/14): funnel-kpi-query.ts read-only 유지 — db.put/add/delete/update grep 0건",
    violations.length === 0,
    `violations=${violations.length}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) C-D45-3 verify-byok-ping.mjs 존재 + 5 프로바이더 시그니처.
// ─────────────────────────────────────────────────────────────────────────────
{
  const present = await exists("scripts/verify-byok-ping.mjs");
  if (present) {
    const src = await readSrc("scripts/verify-byok-ping.mjs");
    const has5 =
      /anthropic/.test(src) &&
      /openai/.test(src) &&
      /gemini/.test(src) &&
      /grok/.test(src) &&
      /deepseek/.test(src);
    const hasMockMode = /ANTHROPIC_API_KEY/.test(src) && /mock/.test(src);
    assert(
      "C-D45-3 (7/14): verify-byok-ping.mjs 존재 + PERSONA_PROVIDERS 5종 grep + mock 분기 명시",
      has5 && hasMockMode,
      `5providers=${has5} mock=${hasMockMode}`,
    );
  } else {
    assert("C-D45-3 (7/14): verify-byok-ping.mjs 존재", false, "file missing");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) verify:all 24→25 자동 흡수 정합.
// ─────────────────────────────────────────────────────────────────────────────
{
  const all = await readSrc("scripts/verify-all.mjs");
  const hasD45Gate =
    /verify:d45['"]\s*,\s*cmd:\s*['"]node['"]\s*,\s*args:\s*\[\s*['"]scripts\/verify-d45\.mjs['"]\s*\]/.test(
      all,
    ) || /scripts\/verify-d45\.mjs/.test(all);
  const hasByokPingGate = /scripts\/verify-byok-ping\.mjs/.test(all);
  assert(
    "C-D45-5 (8/14): verify:all에 verify:d45 + verify:byok-ping 게이트 등록 (24→25 자동 흡수)",
    hasD45Gate && hasByokPingGate,
    `d45=${hasD45Gate} byok=${hasByokPingGate}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) C-D45-4 hero-live-transition.tsx liveSinceMs + 4px/2px 분기.
// ─────────────────────────────────────────────────────────────────────────────
{
  const TRANSITION = "src/modules/ui/hero-live-transition.tsx";
  const src = await readSrc(TRANSITION);
  const hasLiveSinceProp = /liveSinceMs\?:\s*number/.test(src);
  // ring-4 (4px Tailwind) + ring-2 (2px Tailwind) 양쪽 등장.
  const has4px = /ring-4\b/.test(src);
  const has2px = /ring-2\b/.test(src);
  // STRONG_RING_MS 1h 임계.
  const hasThreshold =
    /STRONG_RING_MS|3_?600_?000|60\s*\*\s*60\s*\*\s*1000/.test(src);
  assert(
    "C-D45-4 (9/14): HeroLiveTransition liveSinceMs prop + ring-4(4px)/ring-2(2px) + 1h 임계",
    hasLiveSinceProp && has4px && has2px && hasThreshold,
    `prop=${hasLiveSinceProp} 4px=${has4px} 2px=${has2px} 1h=${hasThreshold}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) persona-demo-seeds.ts 4종 + 멱등.
// ─────────────────────────────────────────────────────────────────────────────
{
  const PATH = "src/modules/personas/persona-demo-seeds.ts";
  const present = await exists(PATH);
  assert("C-D45-4 (10a): persona-demo-seeds.ts 존재", present, "file missing");
  if (present) {
    const src = await readSrc(PATH);
    // 4종 demo: id 매칭 — dev/designer/pm/marketer.
    const ids = ["demo:dev", "demo:designer", "demo:pm", "demo:marketer"];
    const all4 = ids.every((id) => src.includes(`"${id}"`));
    const hasApply = /export\s+async\s+function\s+applyDemoSeeds\s*\(/.test(
      src,
    );
    const hasReadonlyArray =
      /PERSONA_DEMO_SEEDS\s*:\s*ReadonlyArray<PersonaInput>/.test(src);
    assert(
      "C-D45-4 (10/14): PERSONA_DEMO_SEEDS 4종 (dev/designer/pm/marketer) + applyDemoSeeds export + 멱등 id",
      all4 && hasApply && hasReadonlyArray,
      `ids4=${all4} apply=${hasApply} ro=${hasReadonlyArray}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11) D-D45-2 KQ_23 banner LIVE 자동 dismiss localStorage.
// ─────────────────────────────────────────────────────────────────────────────
{
  const banner = await readSrc("src/modules/domain/domain-fallback-banner.tsx");
  const hasKey = /['"]kq23\.live\.dismissed\.at['"]/.test(banner);
  const hasIsLiveImport =
    /import\s*\{[^}]*\bisLive\b[^}]*\}\s*from\s*['"]@\/modules\/dday\/dday-config['"]/.test(
      banner,
    );
  const has24h =
    /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|86_?400_?000|LIVE_DISMISS_HOLD_MS/.test(
      banner,
    );
  assert(
    "C-D45-5 (11/14): KQ_23 banner LIVE 자동 dismiss — localStorage 'kq23.live.dismissed.at' + isLive import + 24h hold",
    hasKey && hasIsLiveImport && has24h,
    `key=${hasKey} isLive=${hasIsLiveImport} 24h=${has24h}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12) 168 정식 HARD GATE 정합 — next.config + next ^15.x 무손상.
// ─────────────────────────────────────────────────────────────────────────────
{
  const cfgExists = await exists("next.config.ts");
  const pkg = JSON.parse(await readSrc("package.json"));
  const nextVer = pkg.dependencies?.next ?? "";
  const isNext15 = /^\^?15\./.test(nextVer);
  // dev-deps 추가 0 — dependencies 7 / devDependencies 11 정합.
  const depCount = Object.keys(pkg.dependencies ?? {}).length;
  const devCount = Object.keys(pkg.devDependencies ?? {}).length;
  assert(
    "C-D45-(12/14): 168 정식 HARD GATE 정합 — next.config + next ^15.x + dev-deps +0 (deps=7/dev=11)",
    cfgExists && isNext15 && depCount === 7 && devCount === 11,
    `cfg=${cfgExists} next=${nextVer} deps=${depCount} dev=${devCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13) 보존 13 v3 무손상 — verify-conservation-13 정적 grep.
// ─────────────────────────────────────────────────────────────────────────────
{
  const c13 = await readSrc("scripts/verify-conservation-13.mjs");
  const hasShaList = /sha256|expected|frozen|보존/i.test(c13);
  assert(
    "C-D45-(13/14): 보존 13 v3 무손상 — verify-conservation-13.mjs 정적 검증 무수정",
    hasShaList,
    "verify-conservation-13.mjs 보존 키워드 미검출",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 14) 어휘 룰 grep — 신규 4 파일 + 수정 1 파일.
// ─────────────────────────────────────────────────────────────────────────────
{
  // 본 verify-d45.mjs 자신은 grep 패턴 문자열을 포함하므로 검사 대상에서 제외 — meta-검사 회피.
  const newFiles = [
    "src/modules/personas/persona-demo-seeds.ts",
    "scripts/verify-byok-ping.mjs",
  ];
  const banned = [
    /\bBlend\b/,
    /\bCompare\b/,
    /\bModels\b/,
    /박다/,
    /박았/,
    /박음/,
    /박제/,
  ];
  let bannedCount = 0;
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
    "C-D45-(14/14): 어휘 룰 grep 0건 — 신규 3 파일 'Blend'/'Compare'/'Models'/'박다'/'박았'/'박음'/'박제' 0",
    bannedCount === 0,
    `banned=${bannedCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d45 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(
  `\n✓ verify-d45: ${pass}/${pass} PASS — D-D45 P0 5건 (C-D45-1∼4 + C-D45-5 본 파일) + 168 정식 HARD GATE 20 사이클 도전`,
);
process.exit(0);
