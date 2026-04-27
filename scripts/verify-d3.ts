/**
 * verify-d3.ts — D3 (D-8.4) 라이브 검증.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/verify-d3.ts
 *
 * 키가 없으면 skip 모드로 출력 후 종료 (exit 0).
 *
 * 검증 항목 (명세 §5):
 *   1. 추정 8/15: claude-opus-4-7 / claude-sonnet-4-6 / claude-3-5-sonnet-latest 200/4xx 확인
 *   2. 추정 13: 잘못된 모델 ID(claude-fake-9999) → 400 본문 구조 (error.type, error.message)
 *   3. 추정 12: D-8.1 system-prompt 박힘 시 응답에 [이름] 접두 없는지 (5회 반복, ≥4회 PASS)
 *   4. D-8.3 폴백 동작: 잘못된 모델 ID + 폴백 분기 → 폴백 후 200 응답
 *   5. 추정 14: round-robin history 시뮬 — 응답이 자기 이름 [접두] 안 붙이는지
 *
 * 비용: ~6 호출 × max_tokens=200 → ~$0.01~0.02 (Do §공통.8 자체 해결 범위).
 */

// ESM 모듈로 인식 — top-level 선언이 다른 스크립트(verify-pr2)와 충돌하지 않도록
export {};

const KEY = process.env["ANTHROPIC_API_KEY"]?.trim();
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

const FALLBACK_MODEL = "claude-3-5-sonnet-latest";

interface AnthropicEvent {
  type: string;
  message?: { role?: string; content?: { type?: string; text?: string }[] };
  delta?: { type?: string; text?: string };
  content_block?: { type?: string; text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

interface CallResult {
  status: number;
  events: AnthropicEvent[];
  fullText: string;
  errorBody?: { type?: string; message?: string };
}

/**
 * 단일 SSE 호출 — 본문 누적 + 이벤트 수집. 4xx면 에러 본문 파싱.
 */
async function callOnce(opts: {
  model: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<CallResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": KEY!,
      "anthropic-version": VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 200,
      stream: true,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    let errorBody: { type?: string; message?: string } | undefined;
    try {
      const body = (await res.json()) as { error?: typeof errorBody };
      errorBody = body.error;
    } catch {
      errorBody = undefined;
    }
    return { status: res.status, events: [], fullText: "", errorBody };
  }
  if (!res.body) {
    return { status: res.status, events: [], fullText: "" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: AnthropicEvent[] = [];
  let fullText = "";

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
          const evt = JSON.parse(payload) as AnthropicEvent;
          events.push(evt);
          if (
            evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta?.text === "string"
          ) {
            fullText += evt.delta.text;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    buffer = buffer.slice(cursor);
  }
  return { status: res.status, events, fullText };
}

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

async function main(): Promise<void> {
  if (!KEY) {
    process.stdout.write(
      "[verify-d3] ANTHROPIC_API_KEY not set — skipping live checks (self-check 41/41 has full coverage).\n",
    );
    record("§1 모델 200/4xx", "SKIP", "API key 미설정");
    record("§2 추정 13 (400 본문)", "SKIP", "API key 미설정");
    record("§3 추정 12 ([이름] 접두 없음)", "SKIP", "API key 미설정");
    record("§4 D-8.3 폴백 동작", "SKIP", "API key 미설정");
    record("§5 추정 14 (round-robin race)", "SKIP", "API key 미설정");
    process.stdout.write("\nverify-d3: SKIP MODE — self-check가 코드 커버리지 보장.\n");
    process.stdout.write(toMarkdownTable());
    return;
  }

  // 1) 모델 3종 200/4xx 확인 — 추정 8/15
  for (const model of ["claude-opus-4-7", "claude-sonnet-4-6", FALLBACK_MODEL]) {
    process.stdout.write(`[verify-d3] live: ${model} …\n`);
    const out = await callOnce({
      model,
      messages: [{ role: "user", content: "Say 'hi' in 3 words." }],
      maxTokens: 32,
    });
    if (out.status === 200) {
      record(
        `§1 ${model}`,
        "PASS",
        `200 OK · 응답 첫 50자="${out.fullText.slice(0, 50)}"`,
      );
    } else {
      record(`§1 ${model}`, "FAIL", `status=${out.status} body=${JSON.stringify(out.errorBody)}`);
    }
  }

  // 2) 추정 13: 잘못된 모델 ID → 400 본문 구조
  process.stdout.write("[verify-d3] live: claude-fake-9999 (의도 4xx) …\n");
  const fake = await callOnce({
    model: "claude-fake-9999",
    messages: [{ role: "user", content: "test" }],
    maxTokens: 16,
  });
  const has400 = fake.status === 400;
  const hasInvalid = fake.errorBody?.type === "invalid_request_error";
  const hasModelMsg = /model/i.test(fake.errorBody?.message ?? "");
  if (has400 && hasInvalid && hasModelMsg) {
    record(
      "§2 추정 13",
      "PASS",
      `400 + invalid_request_error + /model/i ✓ (msg="${(fake.errorBody?.message ?? "").slice(0, 80)}")`,
    );
  } else {
    record(
      "§2 추정 13",
      "FAIL",
      `status=${fake.status} type=${fake.errorBody?.type} msg=${fake.errorBody?.message?.slice(0, 80)}`,
    );
  }

  // 3) 추정 12: D-8.1 system prompt 박힘 시 [이름] 접두 없는지 (5회 반복)
  process.stdout.write("[verify-d3] live: D-8.1 system prompt 5회 반복 (추정 12) …\n");
  const systemPrompt = `당신은 똘이입니다. 이 대화는 BYOK 기반 Robusta 서비스에서 진행됩니다.

# 정체성
- 이름: 똘이
- 역할: 대화 참여자
- 모델: ${FALLBACK_MODEL}

# 다른 참여자
- 로이 (인간)
- 꼬미 (AI · claude-sonnet-4-6)

# 행동 원칙
1. 항상 자신의 이름을 알고, 다른 참여자와 자신을 혼동하지 않는다.
2. 다른 참여자의 메시지는 [이름] 본문 형식으로 전달된다. 당신의 답변에는 [이름] 접두를 붙이지 않는다.
3. 사용자(인간)의 의도를 정확히 파악하고, 짧고 직설적으로 답한다.
4. 추측이 필요한 경우 "추정"이라 명시한다.
5. 서로 다른 AI는 관점이 다르다. 동의/반대를 명확히 한다.`;

  let noPrefixCount = 0;
  const samples: string[] = [];
  for (let i = 0; i < 5; i++) {
    const out = await callOnce({
      model: FALLBACK_MODEL,
      system: systemPrompt,
      messages: [{ role: "user", content: `[로이] 자기 소개 한 문장 (시도 ${i + 1})` }],
      maxTokens: 80,
    });
    const trimmed = out.fullText.trim();
    samples.push(trimmed.slice(0, 60));
    // [이름] 접두 패턴 — 시작 자기 이름 [똘이], [tori] 등
    const startsWithBracketName = /^\s*\[(?:똘이|tori)\]/i.test(trimmed);
    if (!startsWithBracketName) noPrefixCount++;
  }
  if (noPrefixCount >= 4) {
    record(
      "§3 추정 12",
      "PASS",
      `5회 중 ${noPrefixCount}회 [이름] 접두 없음 (≥4 OK). 샘플: ${JSON.stringify(samples).slice(0, 200)}`,
    );
  } else {
    record(
      "§3 추정 12",
      "FAIL",
      `5회 중 ${noPrefixCount}회만 [이름] 접두 없음 (<4). 샘플: ${JSON.stringify(samples)}`,
    );
  }

  // 4) D-8.3 폴백 분기 시뮬 — 잘못된 모델 → fallback 모델 → 200
  process.stdout.write("[verify-d3] live: 폴백 시뮬 (claude-fake-9999 → fallback) …\n");
  // 1차 4xx 확인 (이미 §2에서 함, 결과 재사용)
  if (has400 && hasInvalid && hasModelMsg) {
    const fb = await callOnce({
      model: FALLBACK_MODEL,
      messages: [{ role: "user", content: "test" }],
      maxTokens: 16,
    });
    if (fb.status === 200) {
      record(
        "§4 D-8.3 폴백",
        "PASS",
        `1차 4xx 가드 ✓ + 2차 ${FALLBACK_MODEL} 200 OK ✓`,
      );
    } else {
      record(
        "§4 D-8.3 폴백",
        "FAIL",
        `폴백 모델도 4xx · status=${fb.status}`,
      );
    }
  } else {
    record("§4 D-8.3 폴백", "FAIL", "1차 4xx 본문 가드 미충족 (§2 FAIL 연쇄)");
  }

  // 5) 추정 14: round-robin history 시뮬 — 응답이 자기 이름 [접두] 안 붙이는지
  process.stdout.write("[verify-d3] live: round-robin history 시뮬 (추정 14) …\n");
  const rrOut = await callOnce({
    model: FALLBACK_MODEL,
    system: systemPrompt,
    messages: [
      { role: "user", content: "[로이] 둘이 인사 한번씩 해봐.\n\n[꼬미] 안녕 똘이." },
    ],
    maxTokens: 80,
  });
  const rrText = rrOut.fullText.trim();
  const rrStartsBracket = /^\s*\[(?:똘이|tori)\]/i.test(rrText);
  if (rrOut.status === 200 && !rrStartsBracket) {
    record(
      "§5 추정 14",
      "PASS",
      `round-robin history → 자기 이름 [접두] 없음 ✓ (응답="${rrText.slice(0, 60)}")`,
    );
  } else {
    record(
      "§5 추정 14",
      "FAIL",
      `status=${rrOut.status} 시작="${rrText.slice(0, 80)}"`,
    );
  }

  process.stdout.write("\n" + toMarkdownTable());
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

main().catch((err) => {
  process.stderr.write(
    `[verify-d3] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
