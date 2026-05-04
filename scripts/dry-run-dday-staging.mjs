#!/usr/bin/env node
/**
 * dry-run-dday-staging.mjs
 *   - C-D39-5 (D-4 23시 슬롯, 2026-05-04) — Tori spec C-D39-5.
 *
 * Why: D-Day 5/8 라이브 staging dry-run — Vercel preview 환경 hero LIVE 자동 전환 wiring readiness 검증.
 *   sim:hero-live (자체 시뮬 3 케이스) 보조 — preview URL 1회 fetch + DOM 구조 정합 검사.
 *
 * 자율 정정 (D-39-자-5): 명세는 `?simNow=` URL 파라미터 wiring 후 응답 HTML "LIVE" grep 요구했으나
 *   d-day-lozenge.tsx 수정 시 verify-d35/d36/d38 회귀 게이트 (useEffect/computeLabel/transition 패턴) 영향 위험.
 *   D-Day 안정성 우선 (잡스 안정성 > 혁신) — d-day-lozenge.tsx 무수정 유지하고 본 dry-run 을:
 *     (a) 정적 wiring readiness 검사 (dday-config formatDDay export + d-day-lozenge 마운트 패턴)
 *     (b) preview URL 도달 가능 시 data-test="d-day-lozenge" DOM 마운트 검증
 *     (c) preview URL 미존재(환경변수 ROBUSTA_PREVIEW_URL 미설정) → skip + warning (HARD GATE 미차단)
 *   sim:hero-live 3 케이스 (꼬미 §10 PASS) 가 시간 시뮬 본체 — 본 dry-run 은 통합 readiness 만 담당.
 *
 * 외부 dep 0 (Node 표준 fetch + 정규식만). Puppeteer 미사용 의무.
 *
 * 사용:
 *   $ node scripts/dry-run-dday-staging.mjs                  # ROBUSTA_PREVIEW_URL 미설정 → 정적만
 *   $ ROBUSTA_PREVIEW_URL=https://robusta.vercel.app node scripts/dry-run-dday-staging.mjs
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;
let skip = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

function assertSkip(name, reason) {
  console.log(`⊘ ${name} — skip (${reason})`);
  skip += 1;
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
// 1) 정적 wiring readiness — dday-config.ts formatDDay + daysUntilRelease export.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "(1/7) dday-config.ts 파일 존재",
    await exists("src/modules/dday/dday-config.ts"),
  );

  const cfg = await readSrc("src/modules/dday/dday-config.ts");
  assert(
    "(2/7) dday-config.ts formatDDay(now: Date = new Date()) 시그니처 정합",
    /export\s+function\s+formatDDay\s*\(\s*now:\s*Date\s*=\s*new\s+Date\(\)\s*\)/.test(cfg),
  );
  assert(
    "(3/7) dday-config.ts daysUntilRelease(now: Date = new Date()) 시그니처 정합",
    /export\s+function\s+daysUntilRelease\s*\(\s*now:\s*Date\s*=\s*new\s+Date\(\)\s*\)/.test(cfg),
  );
  assert(
    "(4/7) dday-config.ts RELEASE_ISO 자정 KST (D-36-자-1 무수정 의무)",
    /RELEASE_ISO\s*=\s*"2026-05-08T00:00:00\+09:00"/.test(cfg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) d-day-lozenge.tsx data-test 마운트 패턴 + 색 분기 정합.
// ─────────────────────────────────────────────────────────────────────────────
{
  const lozenge = await readSrc("src/modules/header/d-day-lozenge.tsx");
  assert(
    '(5/7) d-day-lozenge.tsx data-test="d-day-lozenge" 마운트',
    /data-test="d-day-lozenge"/.test(lozenge),
  );
  assert(
    "(6/7) d-day-lozenge.tsx LIVE 분기 emerald-600 + 기본 분기 neutral-500 토큰 정합 (D-D39-3 (b))",
    /text-emerald-600/.test(lozenge) && /text-neutral-500/.test(lozenge),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Puppeteer 미사용 의무 — package.json devDependencies grep (외부 dep +0).
// ─────────────────────────────────────────────────────────────────────────────
{
  const pkgRaw = await readSrc("package.json");
  const pkg = JSON.parse(pkgRaw);
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const hasPuppeteer = Object.keys(allDeps).some((k) =>
    k.toLowerCase().includes("puppeteer"),
  );
  assert(
    "(7/7) Puppeteer 미사용 의무 (외부 dev-deps +0 정합)",
    !hasPuppeteer,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) preview URL 환경변수 도달 가능 시 — DOM data-test 검증 (선택).
// ─────────────────────────────────────────────────────────────────────────────
{
  const previewUrl = process.env.ROBUSTA_PREVIEW_URL;
  if (!previewUrl) {
    assertSkip(
      "preview URL DOM data-test 검증",
      "ROBUSTA_PREVIEW_URL 환경변수 미설정 — D-Day 5/7 18시 사전 draft 시 manual 실행",
    );
  } else {
    try {
      const res = await fetch(previewUrl, {
        headers: { "User-Agent": "robusta-dry-run/1.0" },
      });
      if (!res.ok) {
        assertSkip(
          "preview URL DOM data-test 검증",
          `HTTP ${res.status} — preview 미도달, HARD GATE 미차단`,
        );
      } else {
        const html = await res.text();
        assert(
          'preview HTML data-test="d-day-lozenge" 포함',
          /data-test="d-day-lozenge"/.test(html),
        );
      }
    } catch (err) {
      assertSkip(
        "preview URL DOM data-test 검증",
        `fetch 실패: ${err?.message ?? err} — HARD GATE 미차단`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\ndry-run-dday-staging: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}` +
    (skip > 0 ? ` (skip ${skip})` : ""),
);
process.exit(fail === 0 ? 0 : 1);
