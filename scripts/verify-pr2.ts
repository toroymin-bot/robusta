/**
 * verify-pr2.ts — D-7 추정 5/6/8 실호출 검증.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/verify-pr2.ts
 *
 * 키가 없으면 skip 모드로 PASS 출력 후 종료.
 * (PR2 self-check 34/34는 키 없이 통과해야 한다.)
 */

const KEY = process.env["ANTHROPIC_API_KEY"]?.trim();

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

interface AnthropicEvent {
  type: string;
  delta?: { type?: string; text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

async function callOnce(model: string, signal?: AbortSignal): Promise<{
  status: number;
  events: AnthropicEvent[];
}> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": KEY!,
      "anthropic-version": VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      stream: true,
      messages: [{ role: "user", content: "Say 'hi' in 3 words." }],
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    return { status: res.status, events: [] };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: AnthropicEvent[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cursor = 0;
    // eslint-disable-next-line no-constant-condition
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
          events.push(JSON.parse(payload) as AnthropicEvent);
        } catch {
          // ignore parse errors
        }
      }
    }
    buffer = buffer.slice(cursor);
  }
  return { status: res.status, events };
}

async function main(): Promise<void> {
  if (!KEY) {
    process.stdout.write(
      "[verify-pr2] ANTHROPIC_API_KEY not set — skipping live checks (self-check 34/34 has full coverage).\n",
    );
    process.stdout.write("[추정 5] SKIP (live)\n[추정 6] SKIP (live)\n[추정 7] SKIP (UI 시연)\n[추정 8] SKIP (live)\n");
    return;
  }

  // 추정 5/8: sonnet-4-6 실호출 + 이벤트 타입 모두 확인
  process.stdout.write("[verify-pr2] live: claude-sonnet-4-6 …\n");
  const sonnet = await callOnce("claude-sonnet-4-6");
  const types = new Set(sonnet.events.map((e) => e.type));
  const sonnetOk =
    sonnet.status === 200 &&
    types.has("message_start") &&
    types.has("content_block_delta") &&
    types.has("message_delta") &&
    types.has("message_stop");
  process.stdout.write(
    `[추정 5] message_start ${types.has("message_start") ? "✓" : "✗"} / content_block_delta ${types.has("content_block_delta") ? "✓" : "✗"} / message_delta ${types.has("message_delta") ? "✓" : "✗"} / message_stop ${types.has("message_stop") ? "✓" : "✗"} → ${sonnetOk ? "PASS" : "FAIL"} (status=${sonnet.status})\n`,
  );

  // 추정 6: AbortController 100ms 후 abort
  const controller = new AbortController();
  const aborted = new Promise<boolean>((resolve) => {
    callOnce("claude-sonnet-4-6", controller.signal).then(
      () => resolve(false),
      (err) => resolve(err instanceof Error && err.name === "AbortError"),
    );
    setTimeout(() => controller.abort(), 100);
  });
  const ok6 = await aborted;
  process.stdout.write(`[추정 6] AbortError caught → ${ok6 ? "PASS" : "FAIL"}\n`);

  // 추정 7: skip (input-bar UI 시연)
  process.stdout.write("[추정 7] (런타임 X — input-bar 시연으로 검증)\n");

  // 추정 8: opus-4-7
  process.stdout.write("[verify-pr2] live: claude-opus-4-7 …\n");
  const opus = await callOnce("claude-opus-4-7");
  const opusOk = opus.status === 200;
  process.stdout.write(
    `[추정 8] sonnet-4-6 ${sonnet.status === 200 ? "200 OK ✓" : `status=${sonnet.status} ✗`} / opus-4-7 ${opusOk ? "200 OK ✓" : `status=${opus.status} ✗`} → ${sonnetOk && opusOk ? "PASS" : "FAIL"}\n`,
  );

  if (!opusOk) {
    process.stdout.write(
      `[verify-pr2] opus-4-7 가 ${opus.status} 반환 — \"claude-3-5-sonnet-latest\" 폴백 권장. 똘이에게 모델 ID 정정 요청 필요.\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(
    `[verify-pr2] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
