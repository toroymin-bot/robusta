import { maskApiKey } from "../src/modules/api-keys/api-key-mask";
import { validateApiKeyFormat } from "../src/modules/api-keys/api-key-validate";
import { composeSystemPrompt } from "../src/modules/conversation/system-prompt-composer";
import {
  hueToHsl,
  nextParticipantHue,
  parseHueFromColor,
} from "../src/modules/participants/participant-color";
import { DEFAULT_PARTICIPANTS } from "../src/modules/participants/participant-seed";
import type { Participant } from "../src/modules/participants/participant-types";
import {
  __stream_parser_internal,
  parseAnthropicStream,
} from "../src/modules/conversation/stream-parser";
import {
  historyToAnthropicMessages,
  streamMessage,
} from "../src/modules/conversation/conversation-api";
import { pickNextSpeaker } from "../src/modules/conversation/turn-controller";
import type { Message } from "../src/modules/conversation/conversation-types";

let failed = 0;
let passed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    process.stdout.write(`  PASS  ${label}\n`);
  } else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}\n`);
  }
}

async function asyncCheck(label: string, fn: () => Promise<boolean>, detail?: string) {
  try {
    const ok = await fn();
    check(label, ok, detail);
  } catch (err) {
    check(label, false, `threw ${err instanceof Error ? err.message : String(err)}`);
  }
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    locale: "ko",
  });
  // D-8.1: 본문 카피 변경. 기존 ~~`너는 "똘이"이다`~~ → `당신은 똘이입니다` (명세 §2)
  check("composer: 자기 정체 카피 (D-8.1)", out.includes("당신은 똘이입니다"));
  check(
    "composer: 참여자 3명 모두 표시",
    out.includes("로이") && out.includes("똘이") && out.includes("꼬미"),
  );
  // D-8.1: ~~`← 너` 마커 1개~~ → others 섹션에 자기(똘이) 제외 (명세 §2)
  check(
    "composer: 자기는 # 다른 참여자 섹션에서 제외 (D-8.1)",
    out.includes("# 다른 참여자") && !/^- 똘이/m.test(out),
  );
  // D-8.1: ~~`[규칙]`~~ → `# 행동 원칙` (명세 §2)
  check("composer: # 행동 원칙 섹션 포함 (D-8.1)", out.includes("# 행동 원칙"));
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: { ...tori, systemPrompt: "" },
    participants: DEFAULT_PARTICIPANTS,
  });
  check("composer: 빈 systemPrompt → 추가 섹션 미포함", !out.includes("[너의 추가 인격/R&R]"));
}

{
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  let threw = false;
  try {
    composeSystemPrompt({ speaker: roy, participants: DEFAULT_PARTICIPANTS });
  } catch {
    threw = true;
  }
  check("composer: human speaker → throw", threw);
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    locale: "en",
  });
  // D-8.1: ~~en locale → ko fallback~~ → 본격 영문 본문 (명세 §2 의미 동일 번역)
  check(
    "composer: en locale 본격 영문 본문 (D-8.1)",
    out.includes("You are 똘이") && out.includes("# Behavior principles"),
  );
}

{
  const seeds = [20, 200, 130];
  const fourth = nextParticipantHue(seeds);
  check("hue: 4번째 = 280", fourth === 280, `got ${fourth}`);
  const fifth = nextParticipantHue([...seeds, fourth]);
  check("hue: 5번째 = 50", fifth === 50, `got ${fifth}`);
  const sixth = nextParticipantHue([...seeds, fourth, fifth]);
  check("hue: 6번째 = 320", sixth === 320, `got ${sixth}`);
}

{
  const used = [20, 200, 130, 280, 50, 320];
  const seventh = nextParticipantHue(used);
  const minDelta = used.reduce((acc, h) => {
    const diff = Math.abs(h - seventh);
    return Math.min(acc, Math.min(diff, 360 - diff));
  }, 360);
  check("hue: 7번째 ≥ 30° 거리", minDelta >= 30, `delta=${minDelta} val=${seventh}`);
}

{
  const out: Participant = DEFAULT_PARTICIPANTS[1]!;
  check("color: tori 시드에서 hue 200 추출", parseHueFromColor(out.color) === 200);
  check("color: 잘못된 색은 null", parseHueFromColor("not-a-color") === null);
}

{
  check("color: hueToHsl(-30) → hsl 양수", hueToHsl(-30) === "hsl(330 65% 55%)");
  check("color: hueToHsl(390) → hsl(30 …)", hueToHsl(390) === "hsl(30 65% 55%)");
}

{
  const empty = validateApiKeyFormat("anthropic", "   ");
  check(
    "apiKey: 빈 문자열 → empty",
    !empty.ok && empty.reason === "empty",
  );

  const wrongPrefix = validateApiKeyFormat("anthropic", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  check(
    "apiKey: sk-ant- 접두 없음 → wrong-prefix",
    !wrongPrefix.ok && wrongPrefix.reason === "wrong-prefix",
  );

  const tooShort = validateApiKeyFormat("anthropic", "sk-ant-shortkey");
  check(
    "apiKey: 50자 미만 → too-short",
    !tooShort.ok && tooShort.reason === "too-short",
  );

  const longKey = "sk-ant-" + "a".repeat(60);
  const ok = validateApiKeyFormat("anthropic", longKey);
  check("apiKey: sk-ant- + 50자 이상 → ok", ok.ok);

  check(
    "apiKey: 마스킹 형식 sk-ant-...{4자}",
    maskApiKey(longKey) === "sk-ant-...aaaa",
    `got=${maskApiKey(longKey)}`,
  );

  const sample = "sk-ant-abcdefghij1234567890klmnop4xY9";
  check(
    "apiKey: 마스킹 prefix7 + ... + suffix4",
    maskApiKey(sample) === "sk-ant-...4xY9",
    `got=${maskApiKey(sample)}`,
  );

  check(
    "apiKey: 짧은 키는 그대로 노출(마스킹 단축 방어)",
    maskApiKey("short") === "short",
  );
}

// ---------- D-7 추가 12개 ----------

{
  const { parseFrame } = __stream_parser_internal;
  const evt = parseFrame(
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안"}}',
    () => undefined,
  );
  check(
    "stream-parser: content_block_delta text_delta 1 이벤트",
    evt !== null && evt.type === "content_block_delta",
    `got=${JSON.stringify(evt)}`,
  );
}

{
  const { parseFrame } = __stream_parser_internal;
  let warned = false;
  const evt = parseFrame(
    'data: {not_json',
    () => {
      warned = true;
    },
  );
  check(
    "stream-parser: 잘못된 JSON → null + warn(throw 없음)",
    evt === null && warned,
  );
}

{
  const { parseFrame } = __stream_parser_internal;
  const evt = parseFrame("data: [DONE]", () => undefined);
  check("stream-parser: data: [DONE] → null", evt === null);
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  const messages: Message[] = [
    {
      id: "1",
      conversationId: "c",
      participantId: roy.id,
      content: "안녕",
      createdAt: 1,
      status: "done",
    },
    {
      id: "2",
      conversationId: "c",
      participantId: tori.id,
      content: "반가워",
      createdAt: 2,
      status: "done",
    },
  ];
  const out = historyToAnthropicMessages(messages, tori.id, DEFAULT_PARTICIPANTS);
  check(
    "history: roy → user '[로이] 안녕'",
    out[0]?.role === "user" && out[0]?.content === "[로이] 안녕",
    `got=${JSON.stringify(out[0])}`,
  );
  check(
    "history: tori 자기 → assistant 본문",
    out[1]?.role === "assistant" && out[1]?.content === "반가워",
    `got=${JSON.stringify(out[1])}`,
  );
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  const komi = DEFAULT_PARTICIPANTS.find((p) => p.id === "komi")!;
  const messages: Message[] = [
    {
      id: "1",
      conversationId: "c",
      participantId: roy.id,
      content: "A",
      createdAt: 1,
      status: "done",
    },
    {
      id: "2",
      conversationId: "c",
      participantId: komi.id,
      content: "B",
      createdAt: 2,
      status: "done",
    },
  ];
  const out = historyToAnthropicMessages(messages, tori.id, DEFAULT_PARTICIPANTS);
  check(
    "history: 동일 role 연속 → \\n\\n join",
    out.length === 1 &&
      out[0]?.role === "user" &&
      out[0]?.content === "[로이] A\n\n[꼬미] B",
    `got=${JSON.stringify(out)}`,
  );
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  const messages: Message[] = [
    {
      id: "1",
      conversationId: "c",
      participantId: roy.id,
      content: "ok",
      createdAt: 1,
      status: "done",
    },
    {
      id: "2",
      conversationId: "c",
      participantId: tori.id,
      content: "skip me",
      createdAt: 2,
      status: "error",
      errorReason: "test",
    },
  ];
  const out = historyToAnthropicMessages(messages, tori.id, DEFAULT_PARTICIPANTS);
  check(
    "history: error/aborted 메시지 제외",
    out.length === 1 && out[0]?.role === "user",
    `got=${JSON.stringify(out)}`,
  );
}

async function runAsyncChecks(): Promise<void> {
await asyncCheck("streamMessage: human speaker → throw", async () => {
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  let threw = false;
  try {
    const gen = streamMessage({
      apiKey: "sk-ant-test",
      speaker: roy,
      participants: DEFAULT_PARTICIPANTS,
      history: [],
    });
    await gen.next();
  } catch {
    threw = true;
  }
  return threw;
});

await asyncCheck("streamMessage: signal.aborted=true 시작 시 즉시 aborted", async () => {
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const controller = new AbortController();
  controller.abort();
  const gen = streamMessage({
    apiKey: "sk-ant-test",
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    history: [
      {
        id: "1",
        conversationId: "c",
        participantId: "roy",
        content: "hi",
        createdAt: 1,
        status: "done",
      },
    ],
    signal: controller.signal,
  });
  const first = await gen.next();
  return first.value?.kind === "aborted";
});

await asyncCheck("stream-parser: ReadableStream 1 이벤트 추출", async () => {
  if (typeof ReadableStream === "undefined") return true; // 런타임 미지원 시 skip
  const encoder = new TextEncoder();
  const payload =
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n';
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  const events: unknown[] = [];
  for await (const evt of parseAnthropicStream(stream)) {
    events.push(evt);
  }
  return events.length === 1;
});

// D-8 §5: streamMessage fallback — mock fetch 400 invalid_request_error /model/ → fallback yield
{
  const realFetch = globalThis.fetch;
  let callCount = 0;
  // 1차 4xx invalid_request_error /model/ → 폴백 트리거. 2차 200 SSE.
  globalThis.fetch = (async () => {
    callCount++;
    if (callCount === 1) {
      return new Response(
        JSON.stringify({
          error: { type: "invalid_request_error", message: "model not found" },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    const sse = [
      "event: message_start",
      'data: {"type":"message_start","message":{"id":"x","role":"assistant","content":[]}}',
      "",
      "event: content_block_delta",
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}',
      "",
      "event: message_stop",
      'data: {"type":"message_stop"}',
      "",
      "",
    ].join("\n");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;

  await asyncCheck(
    "D-8.3 #5 streamMessage: 4xx invalid_request /model/ → fallback yield + 200 재호출",
    async () => {
      const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
      const gen = streamMessage({
        apiKey: "sk-ant-test",
        speaker: { ...tori, model: "claude-fake-9999" },
        participants: DEFAULT_PARTICIPANTS,
        history: [
          {
            id: "1",
            conversationId: "c",
            participantId: "roy",
            content: "hi",
            createdAt: 1,
            status: "done",
          },
        ],
      });
      let sawFallback = false;
      let sawDelta = false;
      let sawDone = false;
      for await (const chunk of gen) {
        if (chunk.kind === "fallback") {
          sawFallback =
            chunk.from === "claude-fake-9999" &&
            chunk.to === "claude-3-5-sonnet-latest";
        } else if (chunk.kind === "delta") {
          sawDelta = chunk.text === "hi";
        } else if (chunk.kind === "done") {
          sawDone = true;
        }
      }
      return sawFallback && sawDelta && sawDone && callCount === 2;
    },
  );
  globalThis.fetch = realFetch;
}

// D-8 §6: streamMessage 폴백 후 또 4xx → 재폴백 X (error로 종료, 무한루프 차단)
{
  const realFetch = globalThis.fetch;
  let callCount = 0;
  // 매번 400 invalid_request_error /model/ — 무한루프 방지 검증
  globalThis.fetch = (async () => {
    callCount++;
    return new Response(
      JSON.stringify({
        error: { type: "invalid_request_error", message: "model not found again" },
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  await asyncCheck(
    "D-8.3 #6 streamMessage: 폴백 후 또 4xx → 재폴백 X, error yield",
    async () => {
      const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
      const gen = streamMessage({
        apiKey: "sk-ant-test",
        speaker: { ...tori, model: "claude-fake-9999" },
        participants: DEFAULT_PARTICIPANTS,
        history: [
          {
            id: "1",
            conversationId: "c",
            participantId: "roy",
            content: "hi",
            createdAt: 1,
            status: "done",
          },
        ],
      });
      let fallbackCount = 0;
      let errorStatus: number | undefined;
      for await (const chunk of gen) {
        if (chunk.kind === "fallback") fallbackCount++;
        if (chunk.kind === "error") errorStatus = chunk.status;
      }
      // 정확히 1번 fallback, 그 후 error로 종료, 총 fetch 호출 2번 (1차 + 폴백 1번)
      return fallbackCount === 1 && errorStatus === 400 && callCount === 2;
    },
  );
  globalThis.fetch = realFetch;
}

}

{
  const result = pickNextSpeaker({
    mode: "manual",
    lastSpeakerId: "roy",
    participants: DEFAULT_PARTICIPANTS,
    manualPick: "tori",
  });
  check("turn-controller: manual + manualPick='tori' → 'tori'", result === "tori");
}

{
  let threw = false;
  try {
    pickNextSpeaker({
      mode: "manual",
      lastSpeakerId: "roy",
      participants: DEFAULT_PARTICIPANTS,
    });
  } catch {
    threw = true;
  }
  check("turn-controller: manual + manualPick=undefined → throw", threw);
}

// D2: ~~round-robin → throw~~ 였으나 D-8.2에서 본격 구현. 신규 round-robin 테스트로 대체.
// (아래 D-8 추가 §3 self-check #3에서 round-robin 정상 동작 검증.)

// ---------- D-8 추가 6개 (D3, 41/41) ----------

// D-8 §1: composeSystemPrompt 자기 정체 + 다른 참여자 표시 (명세 §8 #1)
{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    locale: "ko",
  });
  check(
    "D-8.1 #1 composer: '당신은 똘이입니다' 본격 카피",
    out.includes("당신은 똘이입니다"),
  );
  check(
    "D-8.1 #1 composer: 다른 참여자에 로이/꼬미 표시 + 똘이 자기 제외",
    out.includes("# 다른 참여자") &&
      out.includes("로이") &&
      out.includes("꼬미") &&
      !/^- 똘이/m.test(out),
  );
}

// D-8 §2: human speaker → throw (이미 위에서 검증되었지만 명세 §8 #2로 명시 박음)
{
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  let threw = false;
  try {
    composeSystemPrompt({
      speaker: roy,
      participants: DEFAULT_PARTICIPANTS,
      locale: "ko",
    });
  } catch {
    threw = true;
  }
  check("D-8.1 #2 composer: human speaker → throw (명세 §8 #2)", threw);
}

// D-8 §3: pickNextSpeaker round-robin 3 participants 순환
{
  const ids = DEFAULT_PARTICIPANTS.map((p) => p.id); // [roy, tori, komi]
  const next1 = pickNextSpeaker({
    mode: "round-robin",
    lastSpeakerId: "roy",
    participants: DEFAULT_PARTICIPANTS,
    participantIds: ids,
  });
  check("D-8.2 #3a round-robin: lastSpeakerId='roy' → 'tori'", next1 === "tori");

  const next2 = pickNextSpeaker({
    mode: "round-robin",
    lastSpeakerId: "komi",
    participants: DEFAULT_PARTICIPANTS,
    participantIds: ids,
  });
  check(
    "D-8.2 #3b round-robin: lastSpeakerId='komi' → 'roy' (modulo 순환)",
    next2 === "roy",
  );

  const next3 = pickNextSpeaker({
    mode: "round-robin",
    lastSpeakerId: null,
    participants: DEFAULT_PARTICIPANTS,
    participantIds: ids,
  });
  check(
    "D-8.2 #3c round-robin: lastSpeakerId=null → 첫 번째 'roy'",
    next3 === "roy",
  );
}

// D-8 §4: round-robin + manualPick 우선 override (모드 무관)
{
  const ids = DEFAULT_PARTICIPANTS.map((p) => p.id);
  const out = pickNextSpeaker({
    mode: "round-robin",
    lastSpeakerId: "roy",
    participants: DEFAULT_PARTICIPANTS,
    participantIds: ids,
    manualPick: "komi",
  });
  check(
    "D-8.2 #4 round-robin + manualPick='komi' → 'komi' (사용자 명시 우선)",
    out === "komi",
  );
}

// D-8 §5/§6 (streamMessage fallback) — runAsyncChecks 함수 안으로 옮김 (top-level await 회피)

runAsyncChecks()
  .then(() => {
    process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
