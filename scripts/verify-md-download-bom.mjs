#!/usr/bin/env node
/**
 * verify-md-download-bom.mjs
 *   - C-D46-3 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-3 (F-D46-3).
 *
 * Why: 회의록 .md 다운로드 BOM UTF-8 회귀 — 윈도우 메모장 mixed 인코딩 깨짐 방지.
 *
 * 자율 정정:
 *   - D-46-자-2: 명세 'transcript-md-export.ts' 추정 — 실 모듈 'src/modules/conversation/meeting-record.ts'
 *     (C-D43-2 정합 / 보존 13 미포함 OCP 가능).
 *
 * 게이트 (5/5 PASS 의무):
 *   1) meeting-record.ts toMarkdown 첫 문자 '﻿' (= UTF-8 0xEF 0xBB 0xBF 3바이트) grep
 *   2) fixture 'tests/fixtures/transcript-mixed-encoding.md' 첫 3바이트 = [0xEF, 0xBB, 0xBF]
 *   3) fixture 디코딩 한글 + 영문 + 이모지 mixed string 정상 (UTF-8 multibyte 정합)
 *   4) meeting-record.ts read-only (db.put/add/delete grep 0)
 *   5) Blob type "text/markdown;charset=utf-8" grep
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const modulePath = resolve(
  root,
  "src/modules/conversation/meeting-record.ts",
);
const fixturePath = resolve(
  root,
  "tests/fixtures/transcript-mixed-encoding.md",
);

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("verify:md-download-bom — meeting-record BOM 회귀");

  // 1) meeting-record.ts BOM '﻿' grep — toMarkdown 출력에 포함.
  const src = await readFile(modulePath, "utf8");
  // toMarkdown 본문 안에서 BOM 문자 (﻿) 가 들어가 있는지 검사.
  // BOM 자체는 zero-width 공백처럼 보이므로 정확한 byte 검사.
  const moduleBytes = await readFile(modulePath);
  // BOM 0xEF 0xBB 0xBF 가 파일 내 어딘가에 임베드돼 있어야 함 (toMarkdown 본문).
  let hasBomLiteral = false;
  for (let i = 0; i < moduleBytes.length - 2; i++) {
    if (
      moduleBytes[i] === 0xef &&
      moduleBytes[i + 1] === 0xbb &&
      moduleBytes[i + 2] === 0xbf
    ) {
      hasBomLiteral = true;
      break;
    }
  }
  if (hasBomLiteral) {
    pass("1. meeting-record.ts contains BOM 0xEF 0xBB 0xBF literal");
  } else {
    fail("1. BOM literal", "0xEF 0xBB 0xBF not found in meeting-record.ts");
  }

  // 2) fixture 첫 3바이트 BOM 정합.
  const fixBytes = await readFile(fixturePath);
  if (
    fixBytes[0] === 0xef &&
    fixBytes[1] === 0xbb &&
    fixBytes[2] === 0xbf
  ) {
    pass("2. fixture first 3 bytes = 0xEF 0xBB 0xBF (BOM)");
  } else {
    fail(
      "2. fixture BOM",
      `got [${fixBytes[0]?.toString(16)}, ${fixBytes[1]?.toString(16)}, ${fixBytes[2]?.toString(16)}]`,
    );
  }

  // 3) fixture 디코딩 — 한/영/이모지 mixed.
  const fixText = fixBytes.toString("utf8");
  const hasKo = /개발자|디자이너|로이|안녕/.test(fixText);
  const hasEn = /Designer|Agreed|ship/.test(fixText);
  const hasEmoji = /🎭|✓/.test(fixText);
  if (hasKo && hasEn && hasEmoji) {
    pass("3. fixture decodes ko+en+emoji mixed");
  } else {
    fail(
      "3. fixture decode",
      `ko=${hasKo} en=${hasEn} emoji=${hasEmoji}`,
    );
  }

  // 4) meeting-record.ts read-only — db.put/add/delete 0건.
  const writeOps = src.match(/\bdb\.(put|add|delete|update)\b/g);
  if (!writeOps || writeOps.length === 0) {
    pass("4. meeting-record.ts read-only (db.put/add/delete 0)");
  } else {
    fail("4. read-only", `found ${writeOps.length} write ops`);
  }

  // 5) Blob type "text/markdown;charset=utf-8" grep.
  if (src.includes('"text/markdown;charset=utf-8"')) {
    pass("5. Blob type text/markdown;charset=utf-8");
  } else {
    fail("5. Blob type", "text/markdown;charset=utf-8 not found");
  }

  if (process.exitCode === 1) {
    console.error("verify:md-download-bom — FAIL");
  } else {
    console.log("verify:md-download-bom — 5/5 PASS");
  }
}

main().catch((err) => {
  console.error("verify:md-download-bom — ERROR", err);
  process.exit(1);
});
