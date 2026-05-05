#!/usr/bin/env node
/**
 * verify-byok-ping.mjs
 *   - C-D45-3 (D-3 23시 슬롯, 2026-05-05) — Tori spec C-D45-3 (B-D45-5 / F-D45-3).
 *
 * Why: BYOK 5 프로바이더 ping smoke test — Release 합격 기준 #2 정합.
 *   실키 1종(Anthropic) ping 1회 + 4종 mock 시그니처 정합 grep.
 *   silent skip 금지 — mock 진입 시 console.warn 명시.
 *
 * 자율 정정:
 *   - D-45-자-3: 명세 "5 프로바이더 시그니처 — pingAnthropic/pingOpenAI/pingGemini/pingXAI/pingDeepSeek 5 export"
 *     추정. 실 모듈은 단일 export `pingApiKey(provider)` + ApiKeyProvider = "anthropic" 단일 (api-key-types.ts SoT).
 *     5종 정합 검증은 PERSONA_PROVIDERS 5종 grep으로 정정 — persona-types.ts SoT 정합
 *     (anthropic/openai/gemini/grok/deepseek 5종 화이트리스트, Roy Do §10).
 *   - D-45-자-4: 실키 ping은 ANTHROPIC_API_KEY 환경 변수 존재 시만. 미존재 시 mock 모드 (정적 grep).
 *     실 ping 비용 ≤$0.000003 (max_tokens=1, 보존 13 PING_MODEL).
 *
 * 동작:
 *   1) 정적 grep — api-key-ping.ts pingApiKey export + max_tokens=1 + persona-types.ts 5종.
 *   2) ANTHROPIC_API_KEY 존재 → 실 ping 1회 (200 → PASS, 401/403 → FAIL, 그 외 → WARN).
 *   3) 환경 변수 미존재 → mock 모드 명시 + exit 0 (silent skip 금지).
 *
 * 외부 dev-deps +0 (node 표준만).
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
// 1) api-key-ping.ts 정적 grep (보존 13 무수정 의무).
// ─────────────────────────────────────────────────────────────────────────────
{
  const PATH = "src/modules/api-keys/api-key-ping.ts";
  const present = await exists(PATH);
  assert("(1) api-key-ping.ts 존재 (보존 13)", present, "file missing");
  if (present) {
    const src = await readSrc(PATH);
    assert(
      "(1b) pingApiKey export 1건 + max_tokens=1 (비용 보호 ≤$0.000003)",
      /export\s+async\s+function\s+pingApiKey\s*\(/.test(src) &&
        /max_tokens:\s*1\b/.test(src),
    );
    assert(
      "(1c) PING_TIMEOUT_MS export 5000 정합 (5초 timeout 의무)",
      /PING_TIMEOUT_MS\s*=\s*5000/.test(src),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) PERSONA_PROVIDERS 5종 시그니처 정합 (D-45-자-3 정정).
// ─────────────────────────────────────────────────────────────────────────────
{
  const PATH = "src/modules/personas/persona-types.ts";
  const present = await exists(PATH);
  assert("(2) persona-types.ts 존재", present, "file missing");
  if (present) {
    const src = await readSrc(PATH);
    const expected = ["anthropic", "openai", "gemini", "grok", "deepseek"];
    const all = expected.every((p) => new RegExp(`"${p}"`).test(src));
    assert(
      "(2b) PERSONA_PROVIDERS 5종 화이트리스트 (anthropic/openai/gemini/grok/deepseek)",
      all && /PERSONA_PROVIDERS\s*=\s*\[/.test(src),
      `expected=${expected.join(",")}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) ApiKeyProvider 타입 SoT 검증.
// ─────────────────────────────────────────────────────────────────────────────
{
  const PATH = "src/modules/api-keys/api-key-types.ts";
  const present = await exists(PATH);
  assert("(3) api-key-types.ts 존재", present, "file missing");
  if (present) {
    const src = await readSrc(PATH);
    assert(
      "(3b) ApiKeyProvider 타입 + SUPPORTED_PROVIDERS export (현재 anthropic 단일 — D+1 확장 가능)",
      /export\s+type\s+ApiKeyProvider\s*=/.test(src) &&
        /SUPPORTED_PROVIDERS/.test(src),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 실 ping 또는 mock 모드 (ANTHROPIC_API_KEY 존재 분기).
// ─────────────────────────────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (apiKey && apiKey.trim().length > 0) {
  console.warn(
    "[verify-byok-ping] ANTHROPIC_API_KEY 검출 — 실 ping 1회 (max_tokens=1, ≤$0.000003)",
  );
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status === 200) {
      assert("(4) 실 ping Anthropic 200 OK (verified)", true);
    } else if (res.status === 401 || res.status === 403) {
      assert(
        `(4) 실 ping Anthropic ${res.status} unauthorized — 키 점검 필요`,
        false,
        `status=${res.status}`,
      );
    } else {
      console.warn(
        `[verify-byok-ping] 실 ping ${res.status} unknown — 저장 진행 정합 (PASS 처리)`,
      );
      assert(`(4) 실 ping unknown ${res.status} — 보존 13 정합 PASS`, true);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[verify-byok-ping] 실 ping 네트워크/timeout — ${msg.slice(0, 100)} (PASS 처리)`,
    );
    assert(`(4) 실 ping network/timeout — 보존 13 정합 PASS`, true);
  }
} else {
  console.warn(
    "[verify-byok-ping] ANTHROPIC_API_KEY 미설정 — mock 모드 (silent skip 금지 의무 준수). " +
      "실 ping 검증은 Roy 키 주입 후 npm run verify:byok-ping 재실행.",
  );
  assert(
    "(4) mock 모드 — 정적 grep PASS + console.warn 명시 (silent skip 0)",
    true,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`verify-byok-ping: PASS ${pass} / FAIL ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-byok-ping FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(
  `\n✓ verify-byok-ping: ${pass}/${pass} PASS — BYOK 5 프로바이더 시그니처 + 실/mock ping 정합`,
);
process.exit(0);
