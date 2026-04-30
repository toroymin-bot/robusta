/**
 * check-vocab.mjs
 *   - C-D19-3 (D6 07시 슬롯, 2026-05-01) — F-29 standalone 검증 스크립트.
 *   - ESLint config 없이도 어휘 룰 회귀 가드. CI/슬롯 종료 점검에서 호출.
 *
 * 동작:
 *   - 인자로 받은 경로(들)에서 정규식 /박(음|다|았|혀|혔|제)/ 매칭을 검색.
 *   - 라인별 hit 출력. 1건이라도 있으면 exit code 1.
 *   - 인자 없으면 본 슬롯 D-D19 신규 산출물 5건만 검사 (verify-d19 와 동기화).
 *
 * 예외:
 *   - 같은 주석 라인에 `@robusta-lint-ignore-bakeum` 토큰 포함 시 skip.
 *
 * 사용 예:
 *   node scripts/check-vocab.mjs                 # 신규 5건 자동 검사
 *   node scripts/check-vocab.mjs src/path/x.ts   # 특정 파일 검사
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

// 본 슬롯(D-D19) 신규/정리 대상 — 어휘 룰 0건 보장 영역.
//   lint rule(eslint-rules/no-bakeum-in-comment.js)과 본 스크립트는 자체적으로 정규식/대체어
//   안내 문자열에 어휘를 포함하므로 검증 대상에서 제외 — 의도된 사용.
const DEFAULT_TARGETS = [
  "src/views/conversation/useConversationEmptyState.ts",
  "src/components/SideSheet/SideSheet.tsx",
  "src/components/SideSheet/SideSheet.module.css",
  "src/styles/tokens.dark.css",
  "src/services/context/anthropic-llm-client.ts",
  // F-29 잔여 정리 대상 — 본 슬롯에서 0건 적용.
  "src/modules/ui/theme.ts",
  "src/modules/conversation/conversation-workspace.tsx",
  "src/modules/conversation/header-cluster.tsx",
];

const PATTERN = /박(음|다|았|혀|혔|제)/g;

const args = process.argv.slice(2);
const targets = args.length > 0 ? args : DEFAULT_TARGETS;

let totalHits = 0;
const fileHits = [];

for (const t of targets) {
  const abs = resolve(root, t);
  let text;
  try {
    text = await readFile(abs, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      // 신규 파일이 본 슬롯에서 아직 등록되지 않았을 수 있음 — skip 안내만.
      console.warn(`! skip (missing): ${t}`);
      continue;
    }
    throw err;
  }
  const lines = text.split("\n");
  let perFile = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/@robusta-lint-ignore-bakeum/.test(line)) continue;
    const matches = [...line.matchAll(PATTERN)];
    if (matches.length > 0) {
      perFile += matches.length;
      totalHits += matches.length;
      for (const m of matches) {
        console.error(
          `✗ ${t}:${i + 1} — '${m[0]}' (대체: 고정/적용/등록/정의/보존)`,
        );
        console.error(`    ${line.trim()}`);
      }
    }
  }
  if (perFile === 0) {
    console.log(`✓ ${t}`);
  } else {
    fileHits.push({ file: t, count: perFile });
  }
}

console.log(
  `\n결과: ${totalHits === 0 ? "PASS" : "FAIL"} — 총 ${totalHits}건${
    fileHits.length > 0
      ? " (" + fileHits.map((f) => `${f.file}:${f.count}`).join(", ") + ")"
      : ""
  }`,
);
process.exit(totalHits === 0 ? 0 : 1);
