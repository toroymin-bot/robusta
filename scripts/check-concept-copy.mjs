#!/usr/bin/env node
/**
 * check-concept-copy.mjs
 *   - C-D25-5 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-5, B-59 컨셉 사수 게이트 정식.
 *
 * 목표 (Do §1.1 / §6 #8):
 *   Robusta = AI 다자간 회의실 + 통찰. Blend 식 \"AI 도구\" / \"챗봇\" 어휘 0건.
 *
 * 검사 대상:
 *   src/modules/i18n/messages.ts (사용자 노출 카피의 단일 소스)
 *   src/**\/*.tsx 안의 JSX 텍스트 노드 (정규식 1차 추출 — 폴리시 우선, 정밀 파서는 D-D26 보강)
 *
 * 화이트리스트:
 *   scripts/check-concept-copy.whitelist.json — 파일 단위 어휘 허용 목록.
 *
 * 의존성 0 — node 표준만.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(process.cwd());

// 정확 단어 경계 매칭 — 영문은 \b, 한글은 boundary 없으므로 substring + 컨텍스트 체크.
const BLEND_VOCAB_REGEX = [
  // 한글 — substring 매치. (정밀 단어 경계는 한글에선 비실용).
  { pattern: /AI\s*도구/g, label: "AI 도구" },
  { pattern: /AI\s*어시스턴트/g, label: "AI 어시스턴트" },
  { pattern: /챗봇/g, label: "챗봇" },
  // 영문 — 단어 경계 \b 사용.
  { pattern: /\bAI\s+assistants?\b/gi, label: "AI assistant" },
  { pattern: /\bAI\s+tools?\b/gi, label: "AI tool" },
  { pattern: /\bchatbots?\b/gi, label: "chatbot" },
  { pattern: /\bAI\s+chat\b/gi, label: "AI chat" },
];

async function readJson(path) {
  try {
    const txt = await readFile(path, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function listFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      await listFiles(p, exts, out);
    } else if (exts.some((ext) => e.name.endsWith(ext))) {
      out.push(p);
    }
  }
  return out;
}

function isWhitelisted(whitelist, relPath, label) {
  const allowed = whitelist?.files?.[relPath];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(label);
}

async function main() {
  const whitelist = (await readJson(
    resolve(ROOT, "scripts/check-concept-copy.whitelist.json"),
  )) ?? { files: {} };

  // 검사 대상 = i18n 카탈로그 + src/**/*.tsx 텍스트.
  const targets = [];
  targets.push(resolve(ROOT, "src/modules/i18n/messages.ts"));
  const srcTsx = await listFiles(resolve(ROOT, "src"), [".tsx"]);
  targets.push(...srcTsx);

  let totalHits = 0;
  const violations = [];

  for (const file of targets) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const relPath = relative(ROOT, file);
    for (const { pattern, label } of BLEND_VOCAB_REGEX) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (isWhitelisted(whitelist, relPath, label)) {
          continue;
        }
        // 코드 내 import path / 변수명 / 주석 일부는 정당 사용 — 단순 경험 휴리스틱.
        // 본 게이트 v0 은 매칭 모두 위반으로 간주. 거짓 양성은 화이트리스트로 등록.
        const lineNo = content.slice(0, m.index).split("\n").length;
        const lineEnd = content.indexOf("\n", m.index);
        const line = content.slice(
          content.lastIndexOf("\n", m.index) + 1,
          lineEnd === -1 ? content.length : lineEnd,
        );
        // 코드 주석 (// or *) 시작 라인은 제외 — 사용자 비노출.
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        ) {
          continue;
        }
        violations.push({
          file: relPath,
          line: lineNo,
          label,
          excerpt: trimmed.slice(0, 120),
        });
        totalHits++;
      }
    }
  }

  if (totalHits === 0) {
    console.log("✓ check-concept-copy: Blend식 어휘 0건 — Robusta 컨셉 사수 PASS");
    process.exit(0);
  }

  console.error(`✗ check-concept-copy: ${totalHits}건 위반`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.label}] ${v.excerpt}`);
  }
  console.error(
    "\n정당 사용이라면 scripts/check-concept-copy.whitelist.json `files[<path>] = [<label>...]` 등록.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("check-concept-copy: unexpected error", err);
  process.exit(2);
});
