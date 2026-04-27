/**
 * verify-d4.ts — D5 (D-10.1, 2026-04-28) 라이브 검증.
 *   추정 17 (1500자 systemPrompt 비용/성능), 추정 20 (SSE message_delta usage),
 *   F-D4-1 (BYOK ping 200/401/network)을 사실로 박는다.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/verify-d4.ts
 *
 * 키가 없으면 skip 모드 (exit 0). 본 슬롯(2026-04-27 23:00)은 KEY 미설정 → skip 출력.
 *
 * 검증 항목:
 *   §1 1500자 systemPrompt + 짧은 user 호출 → 응답시간 측정 (≤8초) + 토큰 사용량 표시 (추정 17)
 *   §2 SSE 마지막 message_delta usage.input_tokens / usage.output_tokens 존재 (추정 20)
 *   §3 BYOK ping: 유효 키 200 (verified) (F-D4-1 본체)
 *
 * 비용: §1·§2 1회 호출 (max_tokens=400) ≈ $0.005, §3 ping 1회 (max_tokens=1) ≈ $0.000003.
 *       합계 ≤ $0.01. 자체 판단 OK 범위(Do §공통.8).
 */

export {};

import { pingApiKey } from "../src/modules/api-keys/api-key-ping";

const KEY = process.env["ANTHROPIC_API_KEY"]?.trim();
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const PROBE_MODEL = "claude-3-5-sonnet-latest";
/** §1 systemPrompt 1500자 페이로드 — 추정 17 검증용. */
const SYSTEM_PROMPT_1500 = (() => {
  // 의미 있는 한국어 + 영어 혼합 텍스트로 1500자 채움 (UTF-8 길이 검증은 별도).
  const seed =
    "당신은 Robusta 서비스의 AI 참여자입니다. 인간 1명과 다른 AI와 함께 자연스럽게 대화하세요. " +
    "답변은 짧고 직설적으로, 추측이 필요한 경우 '추정'이라고 명시합니다. " +
    "다른 참여자의 메시지는 [이름] 본문 형식으로 전달됩니다. 당신의 답변에는 [이름] 접두를 붙이지 않습니다. " +
    "You are an AI participant in Robusta. Stay concise. Mark guesses as '추정'. ";
  let out = "";
  while (out.length < 1500) out += seed;
  return out.slice(0, 1500);
})();

interface RowResult {
  label: string;
  result: "PASS" | "FAIL" | "SKIP";
  detail: string;
}

const rows: RowResult[] = [];

function record(label: string, result: RowResult["result"], detail: string): void {
  rows.push({ label, result, detail });
  process.stdout.write(`[${result}] ${label} — ${detail}\n`);
}

interface SseEvent {
  type: string;
  delta?: { type?: string; text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface CallResult {
  status: number;
  events: SseEvent[];
  fullText: string;
  elapsedMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

async function callOnce(opts: {
  system?: string;
  user: string;
  maxTokens: number;
}): Promise<CallResult> {
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": KEY!,
      "anthropic-version": VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: PROBE_MODEL,
      max_tokens: opts.maxTokens,
      stream: true,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!res.ok || !res.body) {
    return {
      status: res.status,
      events: [],
      fullText: "",
      elapsedMs: Date.now() - t0,
    };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: SseEvent[] = [];
  let fullText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cursor = 0;
    while (true) {
      const idx = buffer.indexOf("\n\n", cursor);
      if (idx === -1) break;
      const frame = buffer.slice(cursor, idx);
      cursor = idx + 2;
      for (const rawLine of frame.split("\n")) {
        const line = rawLine.replace(/\r$/, "");
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trimStart();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as SseEvent;
          events.push(evt);
          if (
            evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta?.text === "string"
          ) {
            fullText += evt.delta.text;
          }
          if (evt.type === "message_start" && evt.usage?.input_tokens != null) {
            inputTokens = evt.usage.input_tokens;
          }
          if (evt.type === "message_delta" && evt.usage?.output_tokens != null) {
            outputTokens = evt.usage.output_tokens;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    buffer = buffer.slice(cursor);
  }
  return {
    status: res.status,
    events,
    fullText,
    elapsedMs: Date.now() - t0,
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
  };
}

function toMarkdownTable(): string {
  const lines: string[] = [];
  lines.push("\n| 검증 항목 | 결과 | 비고 |");
  lines.push("| --- | --- | --- |");
  for (const row of rows) {
    const detail = row.detail.replace(/\|/g, "\\|").slice(0, 200);
    lines.push(`| ${row.label} | ${row.result} | ${detail} |`);
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  if (!KEY) {
    process.stdout.write(
      "[verify-d4] ANTHROPIC_API_KEY not set — skipping live checks.\n",
    );
    record("§1 추정 17 (1500자 systemPrompt 응답시간/토큰)", "SKIP", "API key 미설정");
    record("§2 추정 20 (SSE message_delta usage)", "SKIP", "API key 미설정");
    record("§3 F-D4-1 (BYOK ping 200)", "SKIP", "API key 미설정");
    process.stdout.write("\nverify-d4: SKIP MODE — 다음 슬롯에 키 설정 후 재실행.\n");
    process.stdout.write(toMarkdownTable());
    return;
  }

  // §1 1500자 systemPrompt + 짧은 user — 응답시간 + 토큰 (추정 17)
  process.stdout.write("[verify-d4] live: 1500자 systemPrompt 호출 (추정 17) …\n");
  const out1 = await callOnce({
    system: SYSTEM_PROMPT_1500,
    user: "한 문장으로 자기 소개해.",
    maxTokens: 200,
  });
  if (out1.status === 200 && out1.elapsedMs <= 8000) {
    record(
      "§1 추정 17",
      "PASS",
      `응답시간 ${out1.elapsedMs}ms ≤ 8000ms · in=${out1.inputTokens ?? "?"} out=${out1.outputTokens ?? "?"} · 첫50="${out1.fullText.slice(0, 50)}"`,
    );
  } else {
    record(
      "§1 추정 17",
      "FAIL",
      `status=${out1.status} elapsed=${out1.elapsedMs}ms in=${out1.inputTokens} out=${out1.outputTokens}`,
    );
  }

  // §2 추정 20: §1 응답에 message_delta usage가 있는지
  const sawDeltaUsage = out1.events.some(
    (e) => e.type === "message_delta" && e.usage?.output_tokens != null,
  );
  if (out1.status === 200 && sawDeltaUsage) {
    record(
      "§2 추정 20",
      "PASS",
      `message_delta.usage.output_tokens=${out1.outputTokens} ✓`,
    );
  } else {
    record(
      "§2 추정 20",
      "FAIL",
      `sawDeltaUsage=${sawDeltaUsage} status=${out1.status}`,
    );
  }

  // §3 F-D4-1: BYOK ping 검증 (실제 모듈 사용)
  process.stdout.write("[verify-d4] live: BYOK ping (F-D4-1) …\n");
  const ping = await pingApiKey({ provider: "anthropic", key: KEY });
  if (ping.status === "verified") {
    record("§3 F-D4-1 ping(200)", "PASS", `verified · httpStatus=${ping.httpStatus}`);
  } else {
    record(
      "§3 F-D4-1 ping(200)",
      "FAIL",
      `status=${ping.status} httpStatus=${ping.httpStatus} reason=${ping.reason}`,
    );
  }

  process.stdout.write("\n" + toMarkdownTable());
}

main().catch((err) => {
  process.stderr.write(
    `[verify-d4] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
