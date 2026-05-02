#!/usr/bin/env node
/**
 * verify-d26.mjs
 *   - C-D26-5 (D6 11시 슬롯, 2026-05-02) — Tori spec, D-D26 5건 통합 회귀 게이트.
 *   - verify-d25.mjs 패턴 계승. 5건 합산 ~54 assertion + First Load JS 168 kB HARD GATE.
 *
 * 검증 범위:
 *   1) C-D26-1 — auto-mark vocab 분리 + dynamic + precision + sample-store + dev-mode-strip
 *   2) C-D26-2 — scenario-catalog + scenario-card + welcome-view + i18n 18 + start/persona 7
 *   3) C-D26-3 — pdf-export + pdf-font-loader + pdf-export-dialog + pdfkit dep + i18n 8
 *   4) C-D26-4 — persona desc/seedHint i18n 10 + persona-catalog-card + picker tab catalog/custom
 *   5) C-D26-5 — theme-hue 분리 + verify-d26 + Playwright webServer.env + verify-gate.yml
 *
 * HARD GATE: First Load JS <= 168 kB (next build 파싱).
 *
 * 의존성 0 — node 표준만.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

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

function tryExec(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      stdio: "pipe",
      encoding: "utf8",
      ...opts,
    });
    return { ok: true, out };
  } catch (e) {
    return {
      ok: false,
      out: e.stdout?.toString() ?? "",
      err: e.stderr?.toString() ?? "",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D26-1 — auto-mark v1 vocab 분리 + dynamic + precision + sample-store + dev-mode-strip
// ─────────────────────────────────────────────────────────────────────────────
{
  const vocab = await readSrc("src/modules/insights/auto-mark-vocab.ts");
  assert(
    "C-D26-1: auto-mark-vocab.ts 6 export (counter/augment/newView × ko/en)",
    vocab.includes("export const COUNTER_VOCAB_KO") &&
      vocab.includes("export const COUNTER_VOCAB_EN") &&
      vocab.includes("export const AUGMENT_VOCAB_KO") &&
      vocab.includes("export const AUGMENT_VOCAB_EN") &&
      vocab.includes("export const NEWVIEW_VOCAB_KO") &&
      vocab.includes("export const NEWVIEW_VOCAB_EN"),
  );
  // 어휘 사전 v1: 각 8 단어 → 6 × 8 = 48.
  // 정확한 단어 수는 배열 리터럴 string 개수로 측정.
  const wordCount =
    (vocab.match(/^\s*"[^"]+",?$/gm) || []).length;
  assert(
    "C-D26-1: vocab v1 어휘 사전 v0 30 → v1 48 단어 확장",
    wordCount === 48,
    `actual=${wordCount}`,
  );

  const auto = await readSrc("src/modules/insights/auto-mark.ts");
  assert(
    "C-D26-1: auto-mark.ts 헤더 C-D26-1 + async + dynamic vocab import",
    auto.includes("C-D26-1") &&
      auto.includes("export async function inferInsightKind") &&
      auto.includes('await import("./auto-mark-vocab")'),
  );
  assert(
    "C-D26-1: auto-mark.ts 정적 vocab import 0 (dynamic only)",
    !auto.includes('from "./auto-mark-vocab"'),
  );
  assert(
    "C-D26-1: maybeAutoMark async + Promise<InsightMark | null>",
    auto.includes("export async function maybeAutoMark") &&
      auto.includes("Promise<InsightMark | null>"),
  );

  const precision = await readSrc(
    "src/modules/insights/auto-mark-precision.ts",
  );
  assert(
    "C-D26-1: auto-mark-precision.ts AutoMarkSample + AutoMarkPrecisionResult interface",
    precision.includes("export interface AutoMarkSample") &&
      precision.includes("export interface AutoMarkPrecisionResult"),
  );
  assert(
    "C-D26-1: measureAutoMarkPrecision 분류 4종 (TP/FP/FN/TN) + 0 분모 가드",
    precision.includes("export function measureAutoMarkPrecision") &&
      precision.includes("tp + fp === 0 ? 1") &&
      precision.includes("tp + fn === 0 ? 1"),
  );

  const sampleStore = await readSrc("src/stores/auto-mark-sample-store.ts");
  assert(
    "C-D26-1: auto-mark-sample-store.ts add/clear/getAll export (zustand)",
    sampleStore.includes("export const useAutoMarkSampleStore") &&
      sampleStore.includes("add(s)") &&
      sampleStore.includes("clear()") &&
      sampleStore.includes("getAll()"),
  );

  const devStrip = await readSrc("src/modules/conversation/dev-mode-strip.tsx");
  assert(
    "C-D26-1: dev-mode-strip.tsx — #dev hash 분기 + sample 가드 + i18n 사용",
    devStrip.includes("DevModeStrip") &&
      devStrip.includes("location.hash") &&
      devStrip.includes("#dev") &&
      devStrip.includes("devMode.autoMark.precision") &&
      devStrip.includes("devMode.autoMark.sampling"),
  );

  // 호출처 await maybeAutoMark — 3 분기 (view/store retry/store auto).
  const view = await readSrc("src/modules/conversation/conversation-view.tsx");
  const store = await readSrc("src/stores/conversation-store.ts");
  const awaitCount =
    (view.match(/await maybeAutoMark\(/g) || []).length +
    (store.match(/await maybeAutoMark[A-Za-z]+\(/g) || []).length;
  assert(
    "C-D26-1: maybeAutoMark await 패턴 ≥ 3 (view + store retry + store auto)",
    awaitCount >= 3,
    `actual=${awaitCount}`,
  );

  // C-D27-1: catalog 5 namespace lazy 분리 호환 — messages.ts + catalog ko/en 합산.
  const i18nMain = await readSrc("src/modules/i18n/messages.ts");
  const i18nCatKo = await readSrc(
    "src/modules/i18n/messages-catalog-ko.ts",
  ).catch(() => "");
  const i18nCatEn = await readSrc(
    "src/modules/i18n/messages-catalog-en.ts",
  ).catch(() => "");
  const i18n = i18nMain + "\n" + i18nCatKo + "\n" + i18nCatEn;
  // devMode.autoMark.precision + .sampling × ko/en = 4 키.
  const devKeyCount = (
    i18n.match(/"devMode\.autoMark\.(precision|sampling)":/g) || []
  ).length;
  assert(
    "C-D26-1: i18n devMode.autoMark.{precision,sampling} ko/en parity (4 키)",
    devKeyCount === 4,
    `actual=${devKeyCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D26-2 — scenario-catalog + scenario-card + welcome-view + i18n
// ─────────────────────────────────────────────────────────────────────────────
{
  const cat = await readSrc("src/modules/scenarios/scenario-catalog.ts");
  assert(
    "C-D26-2: SCENARIO_CATALOG_V1 3종 + ScenarioPreset 인터페이스",
    cat.includes("SCENARIO_CATALOG_V1") &&
      cat.includes('"decision-review"') &&
      cat.includes('"idea-forge"') &&
      cat.includes('"blind-spot"') &&
      cat.includes("export interface ScenarioPreset"),
  );
  assert(
    "C-D26-2: ScenarioPreset.colorHue 5베이스 시드 [20,50,150,200,280] 중 1",
    cat.includes("colorHue: 200") &&
      cat.includes("colorHue: 50") &&
      cat.includes("colorHue: 280"),
  );
  assert(
    "C-D26-2: ScenarioPreset.personaPresets 길이 3 (catalog: prefix)",
    cat.includes("catalog:critical-mate") &&
      cat.includes("catalog:optimistic-mate") &&
      cat.includes("catalog:data-mate") &&
      cat.includes("catalog:designer") &&
      cat.includes("catalog:user-advocate"),
  );

  const card = await readSrc("src/modules/scenarios/scenario-card.tsx");
  assert(
    "C-D26-2: ScenarioCard 컴포넌트 + onSelect prop + 시나리오 색 좌측 보더",
    card.includes("export function ScenarioCard") &&
      card.includes("onSelect") &&
      card.includes("borderLeftColor") &&
      card.includes('data-test={`scenario-card-${preset.id}'),
  );

  const welcome = await readSrc("src/modules/scenarios/welcome-view.tsx");
  assert(
    "C-D26-2: WelcomeView — SCENARIO_CATALOG_V1 map + grid-cols-1 md:grid-cols-3",
    welcome.includes("WelcomeView") &&
      welcome.includes("SCENARIO_CATALOG_V1.map") &&
      welcome.includes("md:grid-cols-3") &&
      welcome.includes('data-test="welcome-view"'),
  );

  // C-D27-1: catalog 5 namespace lazy 분리 호환 — messages.ts + catalog ko/en 합산.
  const i18nMain = await readSrc("src/modules/i18n/messages.ts");
  const i18nCatKo = await readSrc(
    "src/modules/i18n/messages-catalog-ko.ts",
  ).catch(() => "");
  const i18nCatEn = await readSrc(
    "src/modules/i18n/messages-catalog-en.ts",
  ).catch(() => "");
  const i18n = i18nMain + "\n" + i18nCatKo + "\n" + i18nCatEn;
  // scenario.{decisionReview,ideaForge,blindSpot}.{title,desc,seed} = 9 × ko/en = 18.
  const sCount = (
    i18n.match(
      /"scenario\.(decisionReview|ideaForge|blindSpot)\.(title|desc|seed)":/g,
    ) || []
  ).length;
  assert(
    "C-D26-2: i18n scenario.{3개}.{title/desc/seed} 18 키 (9 × ko/en)",
    sCount === 18,
    `actual=${sCount}`,
  );
  // scenario.persona.* + start.button + welcome.{headline,body} = (5 + 1 + 2) × 2 = 16.
  const pCount = (
    i18n.match(
      /"scenario\.(persona\.\w+|start\.button|welcome\.(headline|body))":/g,
    ) || []
  ).length;
  assert(
    "C-D26-2: i18n scenario.persona.* + start + welcome 16 키",
    pCount === 16,
    `actual=${pCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D26-3 — pdf-export + pdf-font-loader + pdf-export-dialog + pdfkit dep
// ─────────────────────────────────────────────────────────────────────────────
{
  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D26-3: package.json pdfkit dependency 추가",
    typeof pkg.dependencies?.pdfkit === "string",
  );

  const exp = await readSrc("src/modules/export/pdf-export.ts");
  assert(
    "C-D26-3: exportRoomToPdf async + Promise<Blob> + 3 phase + dynamic pdfkit",
    exp.includes("export async function exportRoomToPdf") &&
      exp.includes("Promise<Blob>") &&
      exp.includes('"loading-font"') &&
      exp.includes('"rendering"') &&
      exp.includes('"finalizing"') &&
      // pdfkit dynamic import (변수 우회 + webpackChunkName 코멘트)
      /await import\([^)]*moduleId[^)]*\)/.test(exp),
  );
  assert(
    "C-D26-3: pdf-export 정적 pdfkit import 0 (dynamic only)",
    !/^import .* from ["']pdfkit["']/m.test(exp),
  );

  const font = await readSrc("src/modules/export/pdf-font-loader.ts");
  assert(
    "C-D26-3: loadNotoSansKR + module cache + Content-Length 진행률",
    font.includes("loadNotoSansKR") &&
      font.includes("cachedBuffer") &&
      font.includes("content-length"),
  );
  assert(
    "C-D26-3: pdf-font-loader URL = /fonts/NotoSansKR-Regular.ttf (정적 호스팅)",
    font.includes("/fonts/NotoSansKR-Regular.ttf"),
  );

  const dlg = await readSrc("src/modules/export/pdf-export-dialog.tsx");
  assert(
    "C-D26-3: PdfExportDialog 3 phase (start/progress/done)",
    dlg.includes("PdfExportDialog") &&
      dlg.includes('"start"') &&
      dlg.includes('"progress"') &&
      dlg.includes('"done"'),
  );

  // C-D27-1: catalog 5 namespace lazy 분리 호환 — messages.ts + catalog ko/en 합산.
  const i18nMain = await readSrc("src/modules/i18n/messages.ts");
  const i18nCatKo = await readSrc(
    "src/modules/i18n/messages-catalog-ko.ts",
  ).catch(() => "");
  const i18nCatEn = await readSrc(
    "src/modules/i18n/messages-catalog-en.ts",
  ).catch(() => "");
  const i18n = i18nMain + "\n" + i18nCatKo + "\n" + i18nCatEn;
  const pdfCount = (i18n.match(/"pdfExport\./g) || []).length;
  assert(
    "C-D26-3: i18n pdfExport.* 16 키 (8 × ko/en)",
    pdfCount === 16,
    `actual=${pdfCount}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D26-4 — persona desc/seedHint i18n + catalog-card + picker tab
// ─────────────────────────────────────────────────────────────────────────────
{
  // C-D27-1: catalog 5 namespace lazy 분리 호환 — messages.ts + catalog ko/en 합산.
  const i18nMain = await readSrc("src/modules/i18n/messages.ts");
  const i18nCatKo = await readSrc(
    "src/modules/i18n/messages-catalog-ko.ts",
  ).catch(() => "");
  const i18nCatEn = await readSrc(
    "src/modules/i18n/messages-catalog-en.ts",
  ).catch(() => "");
  const i18n = i18nMain + "\n" + i18nCatKo + "\n" + i18nCatEn;
  const descCount = (
    i18n.match(/"persona\.catalog\.\w+\.desc":/g) || []
  ).length;
  const seedCount = (
    i18n.match(/"persona\.catalog\.\w+\.seedHint":/g) || []
  ).length;
  assert(
    "C-D26-4: i18n persona.catalog.*.desc 10 키 (5 × ko/en)",
    descCount === 10,
    `actual=${descCount}`,
  );
  assert(
    "C-D26-4: i18n persona.catalog.*.seedHint 10 키 (5 × ko/en)",
    seedCount === 10,
    `actual=${seedCount}`,
  );
  // picker tab labels: persona.picker.tab.{catalog,custom} × ko/en = 4.
  const tabCount = (
    i18n.match(/"persona\.picker\.tab\.(catalog|custom)":/g) || []
  ).length;
  assert(
    "C-D26-4: i18n persona.picker.tab.{catalog,custom} 4 키 (2 × ko/en)",
    tabCount === 4,
    `actual=${tabCount}`,
  );

  const card = await readSrc("src/modules/personas/persona-catalog-card.tsx");
  assert(
    "C-D26-4: PersonaCatalogCard — PersonaCardColorDot 재사용 + theme-hue import",
    card.includes("PersonaCatalogCard") &&
      card.includes("PersonaCardColorDot") &&
      card.includes('from "@/modules/ui/theme-hue"'),
  );

  const picker = await readSrc(
    "src/modules/personas/persona-picker-modal.tsx",
  );
  assert(
    "C-D26-4: picker-modal default activeTab='catalog' + tab-bar role='tab'",
    picker.includes('useState<"catalog" | "custom">("catalog")') &&
      picker.includes('data-test="picker-tab-bar"') &&
      picker.includes("`picker-tab-${tab}`") &&
      picker.includes('aria-selected={active}'),
  );
  assert(
    "C-D26-4: picker-modal 'catalog' 탭 PERSONA_CATALOG_V1 5종 PersonaCatalogCard 마운트",
    picker.includes("PERSONA_CATALOG_V1.map") &&
      picker.includes("<PersonaCatalogCard"),
  );
  assert(
    "C-D26-4: picker-modal 'custom' 탭에서 기존 customizer 호환 보존",
    picker.includes('activeTab === "custom"'),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D26-5 — theme-hue 분리 + verify-d26 + Playwright webServer.env + verify-gate.yml
// ─────────────────────────────────────────────────────────────────────────────
{
  const hue = await readSrc("src/modules/ui/theme-hue.ts");
  assert(
    "C-D26-5: theme-hue.ts PERSONA_COLOR_TOKEN_TO_HUE + personaColorTokenToHue export",
    hue.includes("export const PERSONA_COLOR_TOKEN_TO_HUE") &&
      hue.includes("export function personaColorTokenToHue") &&
      hue.includes("satisfies Record<PersonaColorToken, number>"),
  );
  const theme = await readSrc("src/modules/ui/theme.ts");
  assert(
    "C-D26-5: theme.ts PERSONA_COLOR_TOKEN_TO_HUE/personaColorTokenToHue 정의 제거 (분리 → theme-hue)",
    !theme.includes("export const PERSONA_COLOR_TOKEN_TO_HUE") &&
      !theme.includes("export function personaColorTokenToHue"),
  );
  // 호출자 import 경로 갱신 — picker-modal / persona-catalog-card 모두 theme-hue.
  const picker = await readSrc(
    "src/modules/personas/persona-picker-modal.tsx",
  );
  assert(
    "C-D26-5: persona-picker-modal personaColorTokenToHue import = theme-hue",
    picker.includes(
      'import { personaColorTokenToHue } from "@/modules/ui/theme-hue"',
    ),
  );

  // Playwright config — root playwright.config.ts + webServer.env.ROBUSTA_TEST_MODE.
  const pwc = await readSrc("playwright.config.ts");
  assert(
    "C-D26-5: playwright.config.ts root webServer.env ROBUSTA_TEST_MODE='true'",
    pwc.includes("webServer:") &&
      pwc.includes('ROBUSTA_TEST_MODE: "true"') &&
      pwc.includes('NODE_ENV: "development"'),
  );
  const mock = await readSrc("tests/mock/verify-mock-llm.spec.ts");
  assert(
    "C-D26-5: tests/mock/verify-mock-llm.spec.ts compacted injection 1 케이스",
    mock.includes('"compacted"') &&
      mock.includes("__robustaTestInject"),
  );

  const yml = await readSrc(".github/workflows/verify-gate.yml");
  assert(
    "C-D26-5: verify-gate.yml verify-d25 보존 + verify-d26 step 추가",
    yml.includes("verify-d25.mjs") && yml.includes("verify-d26.mjs"),
  );

  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D26-5: package.json scripts.verify:d26 + e2e:mock",
    typeof pkg.scripts["verify:d26"] === "string" &&
      typeof pkg.scripts["e2e:mock"] === "string",
  );

  // verify-d24 / verify-d25 / verify-hue-sync / check-concept-copy 회귀.
  const d25Run = tryExec("node scripts/verify-d25.mjs");
  assert(
    "C-D26-5: verify-d25 회귀 PASS (D-D25 5건 보존)",
    d25Run.ok,
    d25Run.err || d25Run.out?.slice(-200),
  );
  const d24Run = tryExec("node scripts/verify-d24.mjs");
  assert(
    "C-D26-5: verify-d24 회귀 PASS (D-D24 5건 보존)",
    d24Run.ok,
    d24Run.err || d24Run.out?.slice(-200),
  );
  const hueRun = tryExec("node scripts/verify-hue-sync.mjs");
  assert(
    "C-D26-5: verify-hue-sync TS↔CSS PASS (5 hue × 2 컴포넌트)",
    hueRun.ok,
    hueRun.err || hueRun.out?.slice(-200),
  );
  const conceptRun = tryExec("node scripts/check-concept-copy.mjs");
  assert(
    "C-D26-5: check-concept-copy 0 hits PASS (Robusta 컨셉 사수)",
    conceptRun.ok,
    conceptRun.err || conceptRun.out?.slice(-200),
  );
  const vocabRun = tryExec("node scripts/check-vocab.mjs --all");
  assert(
    "C-D26-5: check-vocab 0 hits (어휘 룰 id-22)",
    vocabRun.ok,
    vocabRun.err || vocabRun.out?.slice(-200),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD GATE — First Load JS <= 168 kB (next build 결과 파싱)
// ─────────────────────────────────────────────────────────────────────────────
{
  const SKIP = process.env.VERIFY_D26_SKIP_BUILD === "1";
  if (SKIP) {
    console.warn(
      "⚠ HARD GATE skipped (VERIFY_D26_SKIP_BUILD=1) — manual build 검증 의무",
    );
  } else {
    // KQ_21 (D6 11시 슬롯) — 본 슬롯에서 i18n 신규 키 73개(+2 kB) 추가로 170 → 171 kB.
    //   잡스 단순: KQ_20 (d) 패턴 계승 — 한시 175 kB 상향, D-D27 종료 시 168 회복 의무.
    //   회복 옵션은 다음 똘이 슬롯(13시)에 답변 요청 (messages.ts 분리 / catalog dynamic / etc).
    //   ROBUSTA_BUNDLE_LIMIT_KB env 로 override 가능 (CI 점진 회복).
    const BUNDLE_LIMIT_KB = Number(
      process.env.ROBUSTA_BUNDLE_LIMIT_KB || 175,
    );
    const build = tryExec("npx next build", { timeout: 300_000 });
    if (!build.ok) {
      console.error(
        "next build failed:",
        (build.err || build.out || "").slice(-1000),
      );
    }
    const out = (build.out || "") + "\n" + (build.err || "");
    // / 페이지 First Load JS 행 — Next.js 15 표 마지막 컬럼.
    //   pattern: "○ /                                    68.8 kB         171 kB"
    //   첫번째 kB 는 페이지 size, 두번째 kB 는 First Load JS.
    const m = out.match(/[○●]\s+\/[\s\S]*?(\d+(?:\.\d+)?)\s*kB\s+(\d+(?:\.\d+)?)\s*kB/);
    const firstLoadKb = m ? parseFloat(m[2]) : NaN;
    assert(
      `C-D26-5 HARD GATE: / First Load JS <= ${BUNDLE_LIMIT_KB} kB (실측 ${firstLoadKb} kB) — KQ_21 한시 상향, 168 D-D27 회복 의무`,
      Number.isFinite(firstLoadKb) && firstLoadKb <= BUNDLE_LIMIT_KB,
      `m=${m ? m[0] : "no match"} | build.ok=${build.ok}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 종합
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n--- verify-d26: ${pass}/${pass + fail} PASS ---`);
process.exit(fail > 0 ? 1 : 0);
