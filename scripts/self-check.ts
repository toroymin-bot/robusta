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
  check("composer: 자기 정체 카피", out.includes('너는 "똘이"이다'));
  check(
    "composer: 참여자 3명 모두 표시",
    out.includes("로이") && out.includes("똘이") && out.includes("꼬미"),
  );
  const markerMatches = out.match(/← 너/g) ?? [];
  check(
    "composer: 발언자 마커 정확히 1개",
    markerMatches.length === 1,
    `count=${markerMatches.length}`,
  );
  check("composer: [규칙] 섹션 포함", out.includes("[규칙]"));
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
  check("composer: en locale → ko fallback", out.includes("[규칙]"));
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

{
  let threw = false;
  try {
    pickNextSpeaker({
      mode: "round-robin",
      lastSpeakerId: "roy",
      participants: DEFAULT_PARTICIPANTS,
    });
  } catch {
    threw = true;
  }
  check("turn-controller: round-robin → throw 'mode not implemented'", threw);
}

runAsyncChecks()
  .then(() => {
    process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
