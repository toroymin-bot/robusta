#!/usr/bin/env node
/**
 * verify-d37.mjs
 *   - C-D37-1∼5 (D-4 15시 슬롯, 2026-05-04) — Tori spec (Task_2026-05-04 §7).
 *   - 패턴: verify-d36 계승 — 정적 source 패턴 검사. 의존성 0 (node 표준만).
 *
 * 검증 범위 (23 게이트):
 *   1) C-D37-1 (1) — Spec 014 launch checklist 문서 존재
 *   2) C-D37-2 (6) — persona_used 페이로드 확장 + persona-stats store + bumpPersonaStat
 *   3) C-D37-3 (12) — md-mini 파서 + message-bubble wiring + dangerouslySetInnerHTML 0
 *   4) C-D37-4 (4) — persona-hue palette + 결정성 + 평문 30 클래스 + 카드 적용
 *
 * + 168 정식 HARD GATE 12 사이클 — shared First Load JS 103 kB 유지 (build 시점, 본 게이트는 정적 소스만).
 *   build 결과 검증은 verify-all.mjs 통합 게이트에서 별도 측정 (현 시점 정적 게이트 23/23).
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
// 1) C-D37-1 (1) — Spec 014 launch checklist 문서 존재
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D37-1: specs/spec-014-verify-all-launch-checklist.md 존재",
    await exists("specs/spec-014-verify-all-launch-checklist.md"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D37-2 (6) — persona_used 페이로드 확장 + persona-stats store
// ─────────────────────────────────────────────────────────────────────────────
{
  const funnel = await readSrc("src/modules/funnel/funnel-events.ts");
  assert(
    "C-D37-2 (1/6): PersonaUsedEvent 타입에 messageCount 추가",
    /type:\s*"persona_used";[\s\S]*?messageCount:\s*number/.test(funnel),
  );
  assert(
    "C-D37-2 (2/6): PersonaUsedEvent 타입에 firstUsedAt + lastUsedAt 추가",
    /firstUsedAt:\s*number/.test(funnel) && /lastUsedAt:\s*number/.test(funnel),
  );

  const stats = await readSrc("src/modules/personas/persona-stats.ts");
  assert(
    "C-D37-2 (3/6): bumpPersonaStat 시그니처 export",
    /export\s+async\s+function\s+bumpPersonaStat\s*\(\s*personaId:\s*string/.test(stats),
  );
  assert(
    "C-D37-2 (4/6): bumpPersonaStat rw 트랜잭션 (다중 탭 race 안전)",
    /db\.transaction\(\s*"rw"\s*,\s*db\.personaStats/.test(stats),
  );

  const db = await readSrc("src/modules/storage/db.ts");
  assert(
    "C-D37-2 (5/6): db.ts v11 personaStats 테이블 + PK personaId",
    /this\.version\(11\)/.test(db) && /personaStats:\s*"personaId/.test(db),
  );

  const tracker = await readSrc("src/modules/personas/persona-use-tracker.ts");
  assert(
    "C-D37-2 (6/6): persona-use-tracker bumpPersonaStat 호출 + 페이로드 채움",
    /bumpPersonaStat/.test(tracker) &&
      /messageCount:\s*stat\.messageCount/.test(tracker) &&
      /firstUsedAt:\s*stat\.firstUsedAt/.test(tracker),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D37-3 (12) — md-mini 파서 + message-bubble wiring
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D37-3 (1/12): src/modules/conversation/md-mini.tsx 존재",
    await exists("src/modules/conversation/md-mini.tsx"),
  );

  const md = await readSrc("src/modules/conversation/md-mini.tsx");
  assert(
    "C-D37-3 (2/12): renderMd export 시그니처",
    /export\s+function\s+renderMd\s*\(\s*input:\s*string\s*\)/.test(md),
  );
  assert(
    "C-D37-3 (3/12): bold 정규식 (\\*\\*[^*]+?\\*\\*)",
    /BOLD_RE\s*=\s*\/\\\*\\\*\(\[\^\*\]\+\?\)\\\*\\\*\//.test(md),
  );
  assert(
    "C-D37-3 (4/12): italic 정규식",
    /ITALIC_RE\s*=\s*\/\\\*\(\[\^\*\]\+\?\)\\\*\//.test(md),
  );
  assert(
    "C-D37-3 (5/12): code 백틱 정규식",
    /CODE_RE\s*=\s*\/`\(\[\^`\]\+\)`\//.test(md),
  );
  assert(
    "C-D37-3 (6/12): URL 정규식 (https?:\\/\\/)",
    /URL_RE\s*=\s*\/\(https\?:\\\/\\\/\[\^\\s/.test(md),
  );
  assert(
    "C-D37-3 (7/12): <strong> JSX 사용",
    /<strong\s+key=/.test(md),
  );
  assert(
    "C-D37-3 (8/12): <em> JSX 사용",
    /<em\s+key=/.test(md),
  );
  assert(
    "C-D37-3 (9/12): <code> JSX + Tailwind 클래스 평문",
    /<code\s+key=/.test(md) && /bg-zinc-100/.test(md) && /text-rose-600/.test(md),
  );
  assert(
    "C-D37-3 (10/12): URL 링크 target=\"_blank\" + rel=\"noopener noreferrer\"",
    /target="_blank"/.test(md) && /rel="noopener noreferrer"/.test(md),
  );
  assert(
    "C-D37-3 (11/12): dangerouslySetInnerHTML attr 사용 0건 (XSS 안전성, 주석 제외)",
    !/dangerouslySetInnerHTML\s*=/.test(md),
  );

  const bubble = await readSrc("src/modules/conversation/message-bubble.tsx");
  assert(
    "C-D37-3 (12/12): message-bubble renderMd import + AI/done 분기 적용",
    /import\s+\{\s*renderMd\s*\}\s+from\s+"\.\/md-mini"/.test(bubble) &&
      /renderMd\(message\.content\)/.test(bubble),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D37-4 (4) — persona-hue palette + 결정성 + 평문 30 클래스 + 카드 적용
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D37-4 (1/4): src/modules/personas/persona-hue.ts 존재",
    await exists("src/modules/personas/persona-hue.ts"),
  );

  const hue = await readSrc("src/modules/personas/persona-hue.ts");
  assert(
    "C-D37-4 (2/4): personaHue 결정적 hash 알고리즘 (charCodeAt + *31)",
    /charCodeAt/.test(hue) &&
      /\*\s*31/.test(hue) &&
      /export\s+function\s+personaHue/.test(hue),
  );

  // 30 클래스 평문 grep — 10 hue × 3 token (bg/text/border).
  const palettes = [
    ["bg-emerald-50", "text-emerald-700", "border-emerald-200"],
    ["bg-sky-50", "text-sky-700", "border-sky-200"],
    ["bg-violet-50", "text-violet-700", "border-violet-200"],
    ["bg-rose-50", "text-rose-700", "border-rose-200"],
    ["bg-amber-50", "text-amber-700", "border-amber-200"],
    ["bg-teal-50", "text-teal-700", "border-teal-200"],
    ["bg-indigo-50", "text-indigo-700", "border-indigo-200"],
    ["bg-pink-50", "text-pink-700", "border-pink-200"],
    ["bg-lime-50", "text-lime-700", "border-lime-200"],
    ["bg-cyan-50", "text-cyan-700", "border-cyan-200"],
  ];
  let allPresent = true;
  let missing = [];
  for (const triple of palettes) {
    for (const cls of triple) {
      if (!hue.includes(cls)) {
        allPresent = false;
        missing.push(cls);
      }
    }
  }
  assert(
    `C-D37-4 (3/4): 30 클래스 평문 grep (10 hue × 3 token, missing=${missing.length})`,
    allPresent,
    missing.join(", "),
  );

  const card = await readSrc("src/modules/personas/persona-catalog-card.tsx");
  assert(
    "C-D37-4 (4/4): persona-catalog-card personaHue import + 적용",
    /import\s+\{\s*personaHue\s*\}\s+from\s+"\.\/persona-hue"/.test(card) &&
      /personaHue\(preset\.id\)/.test(card),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\nverify-d37: ${fail === 0 ? "PASS" : "FAIL"} ${pass} / ${pass + fail}`,
);
process.exit(fail === 0 ? 0 : 1);
