#!/usr/bin/env node
/**
 * check-mcp-budget.mjs
 *   C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 6 게이트 (4) chunkSize.
 *
 * Why: MCP SDK 진입 chunk(mcp-bundle*.js) 가 1.5 MB 초과 시 build 차단.
 *   168 정식 HARD GATE (shared 103 kB) 와 별개 — 본 게이트는 lazy chunk 한정.
 *
 * 동작:
 *   - .next/static/chunks/ 안 mcp-bundle 또는 mcp 관련 chunk 파일 검사
 *   - size <= 1572864 bytes (1.5 MB) → exit 0
 *   - 초과 → exit 1, 위반 파일/사이즈 stderr
 *   - 빌드 산출물 부재 시 → exit 0 (skip, "build 먼저 실행" 안내)
 *
 * 의존성 0 — node 표준만.
 */

import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const BUDGET_BYTES = 1.5 * 1024 * 1024; // 1572864
const root = resolve(process.cwd());

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listChunks(dir) {
  if (!(await exists(dir))) return [];
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listChunks(full)));
    } else if (e.isFile() && e.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

const chunkRoot = resolve(root, ".next/static/chunks");
if (!(await exists(chunkRoot))) {
  console.log("[check-mcp-budget] .next/static/chunks 부재 — build 먼저 실행 (skip).");
  process.exit(0);
}

const chunks = await listChunks(chunkRoot);
const candidates = chunks.filter((p) => /mcp[-_]?bundle|modelcontextprotocol/i.test(p));

if (candidates.length === 0) {
  console.log(
    "[check-mcp-budget] mcp-bundle chunk 미발견 — Spec 005 wiring 미사용 또는 lazy import 차단 (skip).",
  );
  process.exit(0);
}

let fail = false;
for (const file of candidates) {
  const s = await stat(file);
  const kb = (s.size / 1024).toFixed(1);
  if (s.size > BUDGET_BYTES) {
    console.error(
      `✗ ${file.replace(root + "/", "")} = ${kb} kB (1500 kB 한도 초과)`,
    );
    fail = true;
  } else {
    console.log(
      `✓ ${file.replace(root + "/", "")} = ${kb} kB (한도 ${BUDGET_BYTES / 1024} kB)`,
    );
  }
}

process.exit(fail ? 1 : 0);
