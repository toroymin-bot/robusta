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

// ---------- D-9 추가 7개 (D4 P0, 2026-04-29, 50/50) ----------

// D-9.7 #1 i18n: t('modal.err.nameEmpty') ko default → 한국어
{
  // 동적 import 회피 — i18n 모듈은 sync (require/ESM)
  // import 통합을 위해 top-level static import는 self-check 위쪽에 두지 않고 여기서 lazy load.
  // (self-check가 cli 1회 실행이므로 lazy 비용 무시 가능.)
}

// 위 lazy 패턴 대신 정적 import — top-level에 박는다.

import { t, MESSAGES } from "../src/modules/i18n/messages";
import {
  ALLOWED_MODELS,
  PARTICIPANT_NAME_MAX,
  PARTICIPANT_SYSTEM_PROMPT_MAX,
} from "../src/modules/participants/participant-types";
import { useToastStore, __toast_internal } from "../src/modules/ui/toast";
import { useParticipantStore } from "../src/stores/participant-store";

// D-9 #1 — i18n ko 카피 정합성
check(
  "D-9.0 #1 i18n: ko 'modal.err.nameEmpty' = '이름은 비워둘 수 없습니다.'",
  t("modal.err.nameEmpty") === "이름은 비워둘 수 없습니다.",
);

// D-9 #2 — i18n en 카피 정합성
check(
  "D-9.0 #2 i18n: en 'modal.err.nameEmpty' = 'Name cannot be empty.'",
  t("modal.err.nameEmpty", undefined, "en") === "Name cannot be empty.",
);

// D-9 #3 — i18n 변수 치환
check(
  "D-9.0 #3 i18n: 'toast.persona.saved' {name} 치환 — '꼬미 저장됨'",
  t("toast.persona.saved", { name: "꼬미" }) === "꼬미 저장됨",
  `got=${t("toast.persona.saved", { name: "꼬미" })}`,
);

// D-9 #4 — i18n: 키 누락 시 키 그대로 반환 (운영 가시화)
check(
  "D-9.0 #4 i18n: 모든 ko 키가 en에도 존재 (카피 동기화 검증)",
  Object.keys(MESSAGES.ko).every((k) => k in MESSAGES.en),
);

// D-9.7 #5 — useToastStore push 4개 → 3개만 (FIFO oldest 자동 폐기)
{
  // 초기화
  useToastStore.setState({ toasts: [] });
  const store = useToastStore.getState();
  store.push({ tone: "info", message: "1" });
  store.push({ tone: "info", message: "2" });
  store.push({ tone: "info", message: "3" });
  store.push({ tone: "info", message: "4" });
  const after = useToastStore.getState().toasts;
  check(
    `D-9.7 #5 toast: push 4 → length === ${__toast_internal.MAX_TOASTS}`,
    after.length === __toast_internal.MAX_TOASTS,
    `got length=${after.length}`,
  );
  check(
    "D-9.7 #5 toast: oldest('1') 자동 폐기, 잔여=2,3,4",
    after[0]?.message === "2" &&
      after[1]?.message === "3" &&
      after[2]?.message === "4",
    `got=${after.map((t) => t.message).join(",")}`,
  );
}

// D-9.7 #6 — dismissLatest 가장 최근 1개 폐기 (ESC)
{
  useToastStore.setState({ toasts: [] });
  const store = useToastStore.getState();
  store.push({ tone: "info", message: "a" });
  store.push({ tone: "warning", message: "b" });
  store.push({ tone: "error", message: "c" });
  store.dismissLatest();
  const after = useToastStore.getState().toasts;
  check(
    "D-9.7 #6 toast: dismissLatest → 'c' 제거, [a,b] 잔여",
    after.length === 2 &&
      after[0]?.message === "a" &&
      after[1]?.message === "b",
    `got=${after.map((t) => t.message).join(",")}`,
  );
}

// D-9.7 #6.5 — variant별 hue 보더 색 정합성
//   D-14.5 (Day 8) info를 노란색 밴드 yellow-500(#F5C518)로 박음 — 똘이 디자인 인수.
check(
  "D-9.7 #6.5 toast: BORDER_COLOR.info=#F5C518 / warning=#E8A03A / error=#D6443A (D-14.5 갱신)",
  __toast_internal.BORDER_COLOR.info === "#F5C518" &&
    __toast_internal.BORDER_COLOR.warning === "#E8A03A" &&
    __toast_internal.BORDER_COLOR.error === "#D6443A",
);

// D-9.2 #7 — participant-store.update 빈 name patch → throw
{
  // 모킹: store.participants에 직접 set
  useParticipantStore.setState({
    participants: [
      {
        id: "px",
        kind: "ai",
        name: "old",
        color: "hsl(20 65% 55%)",
      },
    ],
  });
  let threwMsg: string | null = null;
  try {
    // getDb 단계까지 가기 전 trim 검증에서 throw 되어야 함
    void useParticipantStore
      .getState()
      .update("px", { name: "   " })
      .catch((err: unknown) => {
        threwMsg = err instanceof Error ? err.message : String(err);
      });
  } catch (err) {
    threwMsg = err instanceof Error ? err.message : String(err);
  }
  // setTimeout 미래에 마이크로태스크 처리 — 동기 환경에서 catch 동작 보장 위해 한 사이클 await
}
// 위 #7은 비동기 처리 위해 runAsyncChecks 안으로 추가:
async function runD9AsyncChecks(): Promise<void> {
  await asyncCheck("D-9.2 #7 participant-store.update: 빈 name → throw 메시지", async () => {
    useParticipantStore.setState({
      participants: [
        {
          id: "py",
          kind: "ai",
          name: "old",
          color: "hsl(20 65% 55%)",
        },
      ],
    });
    let msg: string | null = null;
    try {
      await useParticipantStore.getState().update("py", { name: "   " });
    } catch (err) {
      msg = err instanceof Error ? err.message : String(err);
    }
    return msg !== null && msg.includes("이름은 빈 값일 수 없습니다");
  });

  // 추가: ALLOWED_MODELS 화이트리스트 정합성 (D-9.2 §3 표)
  await asyncCheck("D-9.2 #8 ALLOWED_MODELS 화이트리스트 = 3종 (opus-4-7, sonnet-4-6, claude-3-5-sonnet-latest)", async () => {
    return (
      ALLOWED_MODELS.length === 3 &&
      ALLOWED_MODELS.includes("claude-opus-4-7") &&
      ALLOWED_MODELS.includes("claude-sonnet-4-6") &&
      ALLOWED_MODELS.includes("claude-3-5-sonnet-latest")
    );
  });

  // 추가: D-9.2 길이 상수 정합성
  await asyncCheck("D-9.2 #9 길이 상수: name MAX=30, systemPrompt MAX=1500", async () => {
    return PARTICIPANT_NAME_MAX === 30 && PARTICIPANT_SYSTEM_PROMPT_MAX === 1500;
  });
}

// ---------- D-10 추가 6개 (Day 5, 2026-04-28, 60/60) ----------

// D-10.4 #60 toast action 옵션 — error/warning 한정 노출 + 폐기 동작 (sync 검증).
{
  useToastStore.setState({ toasts: [] });
  let onClickCalled = 0;
  const action = {
    label: "재시도",
    onClick: () => {
      onClickCalled++;
    },
  };
  // info에는 action을 박아도 ToastItem이 노출 X. 검증은 push 결과 객체.
  useToastStore.getState().push({ tone: "info", message: "i", action });
  // error는 push 후 toast.action 보존
  useToastStore.getState().push({ tone: "error", message: "e", action });
  const after = useToastStore.getState().toasts;
  check(
    "D-10.4 #60 toast: error variant — action 보존 (label='재시도')",
    after[1]?.action?.label === "재시도",
    `got=${JSON.stringify(after[1]?.action)}`,
  );
  check(
    "D-10.4 #60 toast: info variant도 action 객체는 보존 (렌더에서만 차단)",
    after[0]?.action?.label === "재시도",
  );
  // onClick 직접 호출 (UI 클릭 시뮬)
  after[1]?.action?.onClick();
  check(
    "D-10.4 #60 toast: action.onClick 호출 가능",
    onClickCalled === 1,
    `got=${onClickCalled}`,
  );
}

// D-10.3 #59 buildRetryPlan — 순수 함수, 모든 분기 검증 (브라우저/db 없이 동작).
{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  const errMsg: Message = {
    id: "m-err",
    conversationId: "c1",
    participantId: tori.id,
    content: "fail",
    createdAt: 1000,
    status: "error",
    errorReason: "5xx exhausted",
  };
  const userMsg: Message = {
    id: "m-user",
    conversationId: "c1",
    participantId: roy.id,
    content: "안녕",
    createdAt: 500,
    status: "done",
  };
  // (a) 정상: error 메시지 → ok=true, speaker=tori, history는 원본 그대로(2건), placeholder 신규
  const planOk = buildRetryPlan({
    messages: [userMsg, errMsg],
    messageId: "m-err",
    participants: DEFAULT_PARTICIPANTS,
    apiKey: "sk-ant-" + "x".repeat(60),
    conversationId: "c1",
    createMessageId: () => "m-new",
    now: () => 9999,
  });
  check(
    "D-10.3 #59a buildRetryPlan: ok=true + speaker=tori",
    planOk.ok && planOk.speaker.id === "tori",
  );
  check(
    "D-10.3 #59b buildRetryPlan: history 그대로 (원본 error row 보존, 2건)",
    planOk.ok && planOk.history.length === 2 && planOk.history[1]?.id === "m-err",
  );
  check(
    "D-10.3 #59c buildRetryPlan: placeholder 신규 id + status='streaming'",
    planOk.ok &&
      planOk.placeholder.id === "m-new" &&
      planOk.placeholder.status === "streaming",
  );
  check(
    "D-10.3 #59d buildRetryPlan: placeholder.createdAt > 원본 error.createdAt",
    planOk.ok && planOk.placeholder.createdAt > errMsg.createdAt,
  );

  // (b) not-found
  const planNotFound = buildRetryPlan({
    messages: [userMsg],
    messageId: "missing",
    participants: DEFAULT_PARTICIPANTS,
    apiKey: "sk-ant-x",
    conversationId: "c1",
    createMessageId: () => "m-x",
  });
  check(
    "D-10.3 #59e buildRetryPlan: not-found",
    !planNotFound.ok && planNotFound.reason === "not-found",
  );

  // (c) speaker-not-ai (사용자 발언 retry 시도)
  const planHuman = buildRetryPlan({
    messages: [{ ...userMsg, status: "error" as const }],
    messageId: "m-user",
    participants: DEFAULT_PARTICIPANTS,
    apiKey: "sk-ant-x",
    conversationId: "c1",
    createMessageId: () => "m-x",
  });
  check(
    "D-10.3 #59f buildRetryPlan: speaker-not-ai",
    !planHuman.ok && planHuman.reason === "speaker-not-ai",
  );

  // (d) no-api-key
  const planNoKey = buildRetryPlan({
    messages: [errMsg],
    messageId: "m-err",
    participants: DEFAULT_PARTICIPANTS,
    apiKey: "",
    conversationId: "c1",
    createMessageId: () => "m-x",
  });
  check(
    "D-10.3 #59g buildRetryPlan: no-api-key",
    !planNoKey.ok && planNoKey.reason === "no-api-key",
  );

  // (e) not-retryable (status='done' 메시지)
  const planDone = buildRetryPlan({
    messages: [{ ...errMsg, status: "done" as const }],
    messageId: "m-err",
    participants: DEFAULT_PARTICIPANTS,
    apiKey: "sk-ant-x",
    conversationId: "c1",
    createMessageId: () => "m-x",
  });
  check(
    "D-10.3 #59h buildRetryPlan: not-retryable (status=done)",
    !planDone.ok && planDone.reason === "not-retryable",
  );
}

async function runD10AsyncChecks(): Promise<void> {
  // D-10.2 #55 pingApiKey: mock 200 → verified
  await asyncCheck("D-10.2 #55 pingApiKey: mock 200 → verified", async () => {
    const fakeFetch = (async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const result = await pingApiKey({
      provider: "anthropic",
      key: "sk-ant-test",
      fetchImpl: fakeFetch,
    });
    return result.status === "verified" && result.httpStatus === 200;
  });

  // D-10.2 #56 pingApiKey: mock 401 → unauthorized
  await asyncCheck(
    "D-10.2 #56 pingApiKey: mock 401 → unauthorized + httpStatus=401",
    async () => {
      const fakeFetch = (async () =>
        new Response(
          JSON.stringify({
            error: { type: "authentication_error", message: "invalid x-api-key" },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        )) as typeof fetch;
      const result = await pingApiKey({
        provider: "anthropic",
        key: "sk-ant-bad",
        fetchImpl: fakeFetch,
      });
      return (
        result.status === "unauthorized" &&
        result.httpStatus === 401 &&
        typeof result.reason === "string" &&
        result.reason.includes("invalid")
      );
    },
  );

  // D-10.2 #56b pingApiKey: timeout → unknown
  await asyncCheck(
    "D-10.2 #56b pingApiKey: timeout(50ms) → unknown",
    async () => {
      const fakeFetch = ((_url: unknown, init: { signal?: AbortSignal }) =>
        new Promise<Response>((resolve, reject) => {
          // 영원히 응답 안 함 — abort 신호로만 종료
          if (init.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }
          // resolve 미호출 (intentional)
          void resolve;
        })) as unknown as typeof fetch;
      const result = await pingApiKey({
        provider: "anthropic",
        key: "sk-ant-test",
        fetchImpl: fakeFetch,
        timeoutMs: 50,
      });
      return (
        result.status === "unknown" &&
        typeof result.reason === "string" &&
        result.reason.includes("timeout")
      );
    },
  );

  // D-10.3 #57 streamMessage: 5xx 1회 + 200 1회 → retrying yield + delta + done
  {
    const realFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: { message: "server" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      const sse = [
        "event: message_start",
        'data: {"type":"message_start","message":{"id":"x","role":"assistant","content":[]}}',
        "",
        "event: content_block_delta",
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}',
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
      "D-10.3 #57 streamMessage: 503 1회 → retrying yield, 200 재호출 정상",
      async () => {
        const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
        const gen = streamMessage({
          apiKey: "sk-ant-test",
          speaker: tori,
          participants: DEFAULT_PARTICIPANTS,
          history: [
            {
              id: "u1",
              conversationId: "c",
              participantId: "roy",
              content: "hi",
              createdAt: 1,
              status: "done",
            },
          ],
        });
        let retryingCount = 0;
        let sawDelta = false;
        let sawDone = false;
        for await (const chunk of gen) {
          if (chunk.kind === "retrying") {
            retryingCount++;
          } else if (chunk.kind === "delta" && chunk.text === "ok") {
            sawDelta = true;
          } else if (chunk.kind === "done") {
            sawDone = true;
          }
        }
        return retryingCount === 1 && sawDelta && sawDone && callCount === 2;
      },
    );
    globalThis.fetch = realFetch;
  }

  // D-10.3 #58 streamMessage: 5xx 4회 → retrying 3회 + error yield
  {
    const realFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: "down" } }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await asyncCheck(
      "D-10.3 #58 streamMessage: 502 4회 → retrying 3회 + error yield",
      async () => {
        const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
        const gen = streamMessage({
          apiKey: "sk-ant-test",
          speaker: tori,
          participants: DEFAULT_PARTICIPANTS,
          history: [
            {
              id: "u1",
              conversationId: "c",
              participantId: "roy",
              content: "hi",
              createdAt: 1,
              status: "done",
            },
          ],
        });
        let retryingCount = 0;
        let errorStatus: number | undefined;
        for await (const chunk of gen) {
          if (chunk.kind === "retrying") retryingCount++;
          if (chunk.kind === "error") errorStatus = chunk.status;
        }
        // 4 fetch 호출 (초기 1 + 재시도 3), retrying 3회, error 502
        return retryingCount === 3 && errorStatus === 502 && callCount === 4;
      },
    );
    globalThis.fetch = realFetch;
  }
}

// 추가 import — D-10 검증용 모듈 (top-level static import)
import { pingApiKey } from "../src/modules/api-keys/api-key-ping";
import { buildRetryPlan } from "../src/modules/conversation/retry-plan";

// D-11/D-12 검증용 (Day 6, 2026-04-28). MESSAGES는 위에서 이미 import 됨.
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  isMaybeExpired,
  __api_key_meta_internal,
} from "../src/modules/api-keys/api-key-meta";

async function runD11D12Checks(): Promise<void> {
  const projectRoot = resolve(__dirname, "..");

  // 71. (D-11.0) decide-track.sh KEY 부재 시 stdout '[track] B'
  await asyncCheck(
    "D-11.0 #71 decide-track.sh KEY 부재 → '[track] B' 출력",
    async () => {
      const out = execSync(`bash ${projectRoot}/scripts/decide-track.sh`, {
        env: { ...process.env, ANTHROPIC_API_KEY: "" },
        encoding: "utf-8",
      });
      return out.includes("[track] B");
    },
  );

  // 72. (D-11.0) KEY 더미 박음 → '[track] A'
  await asyncCheck(
    "D-11.0 #72 decide-track.sh KEY 더미 → '[track] A' 출력",
    async () => {
      const out = execSync(`bash ${projectRoot}/scripts/decide-track.sh`, {
        env: { ...process.env, ANTHROPIC_API_KEY: "sk-ant-dummy-key-for-test-12345" },
        encoding: "utf-8",
      });
      return out.includes("[track] A");
    },
  );

  // 73. (D-11.3) BYOK 모달 안내 박스 — 키 0건 시 노출, 1건 이상 시 숨김.
  //     showGuide 표현식과 testid grep으로 검증.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/api-keys/api-keys-view.tsx`,
      "utf-8",
    );
    check(
      "D-11.3 #73 BYOK 모달 안내 박스 showGuide = hydrated && !stored",
      /showGuide\s*=\s*hydrated\s*&&\s*!stored/.test(src) &&
        /data-testid="byok-guide-panel"/.test(src),
    );
  }

  // 74. (D-11.3) i18n ko/en 5건 박혀 있음 (guide 3 + modal 2)
  {
    const koHas =
      "byok.guide.headline" in MESSAGES.ko &&
      "byok.guide.body" in MESSAGES.ko &&
      "byok.guide.cta" in MESSAGES.ko &&
      "byok.modal.verifying" in MESSAGES.ko &&
      "byok.modal.unauthorized" in MESSAGES.ko;
    const enHas =
      "byok.guide.headline" in MESSAGES.en &&
      "byok.guide.body" in MESSAGES.en &&
      "byok.guide.cta" in MESSAGES.en &&
      "byok.modal.verifying" in MESSAGES.en &&
      "byok.modal.unauthorized" in MESSAGES.en;
    check("D-11.3 #74 i18n byok.guide/modal 5건 ko/en 박힘", koHas && enHas);
  }

  // 75. (D-11.4) BORDER_BY_STATE 4 + idle = 5 키 모두 매핑 (api-keys-view export)
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/api-keys/api-keys-view.tsx`,
      "utf-8",
    );
    const states = ["idle", "verifying", "verified", "unauthorized", "unknown"];
    const ok = states.every((s) => new RegExp(`^\\s*${s}:\\s*"border-`, "m").test(src));
    check("D-11.4 #75 BORDER_BY_STATE 5상태 매핑 (idle/verifying/verified/unauthorized/unknown)", ok);
  }

  // 76. (D-11.4) animations.css @keyframes 3종 + .robusta-* 클래스 정의.
  {
    const css = readFileSync(`${projectRoot}/src/styles/animations.css`, "utf-8");
    const hasKeyframes =
      /@keyframes\s+robusta-pulse-check/.test(css) &&
      /@keyframes\s+robusta-shake/.test(css) &&
      /@keyframes\s+robusta-spinner-rotate/.test(css);
    const hasClasses =
      /\.robusta-pulse-check\b/.test(css) &&
      /\.robusta-shake\b/.test(css) &&
      /\.robusta-spinner\b/.test(css);
    check("D-11.4 #76 animations.css @keyframes 3종 + .robusta-* 3클래스", hasKeyframes && hasClasses);
  }

  // 77. (D-11.4) prefers-reduced-motion: reduce 미디어쿼리 가드 존재.
  {
    const css = readFileSync(`${projectRoot}/src/styles/animations.css`, "utf-8");
    check(
      "D-11.4 #77 animations.css prefers-reduced-motion 가드 + animation: none",
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css) &&
        /animation:\s*none/.test(css),
    );
  }

  // 78. (D-11.0) scripts/decide-track.sh 실행 권한 +x.
  {
    const stat = statSync(`${projectRoot}/scripts/decide-track.sh`);
    // mode mask 0o111 — owner/group/other 중 하나 이상 +x
    check("D-11.0 #78 decide-track.sh 실행 권한 +x", (stat.mode & 0o111) !== 0);
  }

  // === TRACK_B 회복탄력성 P1 (D-12) ===

  // 79. (D-12.1) cleanStaleStreamingMessages export + STREAMING_STALE_MS = 5min.
  {
    const src = readFileSync(`${projectRoot}/src/modules/storage/db.ts`, "utf-8");
    const hasFn = /export\s+async\s+function\s+cleanStaleStreamingMessages\s*\(/.test(src);
    const hasConst = /export\s+const\s+STREAMING_STALE_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(src);
    const hasV4 = /this\.version\(4\)/.test(src);
    const hasMetaTable = /apiKeyMeta\s*:\s*"/.test(src);
    const hasStartedAtIndex = /streamingStartedAt/.test(src);
    check(
      "D-12.1 #79 db v4 + cleanStaleStreamingMessages + apiKeyMeta + streamingStartedAt 인덱스",
      hasFn && hasConst && hasV4 && hasMetaTable && hasStartedAtIndex,
    );
  }

  // 80. (D-12.1) Message 타입에 streamingStartedAt 추가됨.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-types.ts`,
      "utf-8",
    );
    check(
      "D-12.1 #80 Message 타입에 streamingStartedAt?: number 추가",
      /streamingStartedAt\?\s*:\s*number/.test(src),
    );
  }

  // 81. (D-12.2) markUnauthorized / markVerified / getKeyMeta export.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/api-keys/api-key-meta.ts`,
      "utf-8",
    );
    const hasMU = /export\s+async\s+function\s+markUnauthorized/.test(src);
    const hasMV = /export\s+async\s+function\s+markVerified/.test(src);
    const hasGet = /export\s+async\s+function\s+getKeyMeta/.test(src);
    const hasRecheck = /export\s+async\s+function\s+recheckKey/.test(src);
    check(
      "D-12.2 #81 api-key-meta.ts: markUnauthorized + markVerified + getKeyMeta + recheckKey export",
      hasMU && hasMV && hasGet && hasRecheck,
    );
  }

  // 82. (D-12.2) UNAUTHORIZED_TTL_MS = 24h.
  check(
    "D-12.2 #82 UNAUTHORIZED_TTL_MS = 24h (24*60*60*1000ms)",
    __api_key_meta_internal.UNAUTHORIZED_TTL_MS === 24 * 60 * 60 * 1000,
  );

  // 83. (D-12.2) isMaybeExpired 순수 함수 — 24h 이내 true / null·undefined·이후 false.
  {
    const now = 1_000_000_000_000;
    const t1 = isMaybeExpired(
      {
        pk: "anthropic::sk-ant-...XXXX",
        provider: "anthropic",
        keyMask: "sk-ant-...XXXX",
        lastUnauthorizedAt: now - 60 * 60 * 1000, // 1h ago
        updatedAt: now,
      },
      now,
    );
    const t2 = isMaybeExpired(
      {
        pk: "anthropic::sk-ant-...XXXX",
        provider: "anthropic",
        keyMask: "sk-ant-...XXXX",
        lastUnauthorizedAt: now - 25 * 60 * 60 * 1000, // 25h ago
        updatedAt: now,
      },
      now,
    );
    const t3 = isMaybeExpired(null, now);
    check("D-12.2 #83 isMaybeExpired: 1h true / 25h false / null false", t1 === true && t2 === false && t3 === false);
  }

  // 84. (D-12.3) online-listener.ts: registerOnlineListener / unregisterOnlineListener export +
  //     ONLINE_THROTTLE_MS = 3000.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/ui/online-listener.ts`,
      "utf-8",
    );
    const hasReg = /export\s+function\s+registerOnlineListener/.test(src);
    const hasUnreg = /export\s+function\s+unregisterOnlineListener/.test(src);
    const hasThrottle = /ONLINE_THROTTLE_MS\s*=\s*3000/.test(src);
    const hasWindow = /ONLINE_RETRY_WINDOW_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(src);
    check(
      "D-12.3 #84 online-listener.ts: register/unregister + 3s throttle + 5min window",
      hasReg && hasUnreg && hasThrottle && hasWindow,
    );
  }

  // 85. (D-12.3) conversation-store.retryAll: maxCount default 5 + intervalMs default 200.
  {
    const src = readFileSync(
      `${projectRoot}/src/stores/conversation-store.ts`,
      "utf-8",
    );
    const hasRetryAll = /async\s+retryAll\s*\(\s*filter\s*\)/.test(src);
    const hasMax5 = /filter\.maxCount\s*\?\?\s*5/.test(src);
    const hasInt200 = /filter\.intervalMs\s*\?\?\s*200/.test(src);
    const hasMarkUnauth = /markUnauthorized\("anthropic",\s*apiKey!\)/.test(src);
    check(
      "D-12.3 #85 conversation-store.retryAll: maxCount=5 + intervalMs=200 + 401→markUnauthorized",
      hasRetryAll && hasMax5 && hasInt200 && hasMarkUnauth,
    );
  }
}

// === D-13 (Day 7, 2026-04-29) 페르소나 프리셋 카탈로그 ===

import {
  PERSONA_PRESETS,
  ensurePresetSeed,
} from "../src/modules/personas/preset-catalog";
import {
  PERSONA_COLOR_TOKENS,
  PresetImmutableError,
  colorTokenToCssVar,
} from "../src/modules/personas/persona-types";

async function runD13Checks(): Promise<void> {
  const projectRoot = resolve(__dirname, "..");

  // 86. (D-13.0) db v5 — personas 테이블 + 인덱스 4종.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/storage/db.ts`,
      "utf-8",
    );
    const hasV5 = /this\.version\(5\)/.test(src);
    const hasPersonasTable =
      /personas\s*:\s*"&id, kind, isPreset, createdAt, \[kind\+isPreset\]"/.test(
        src,
      );
    const hasPersonasField = /personas!\s*:\s*Table<Persona,\s*string>/.test(
      src,
    );
    check(
      "D-13.0 #86 db v5 personas 테이블 (인덱스 4종) + Table<Persona> 필드",
      hasV5 && hasPersonasTable && hasPersonasField,
    );
  }

  // 87. (D-13.1) PRESETS.length === 6 && human 1 + ai 5
  {
    const total = PERSONA_PRESETS.length;
    const human = PERSONA_PRESETS.filter((p) => p.kind === "human").length;
    const ai = PERSONA_PRESETS.filter((p) => p.kind === "ai").length;
    const allPresetIds = PERSONA_PRESETS.every((p) =>
      p.id.startsWith("preset:"),
    );
    const allMarkedPreset = PERSONA_PRESETS.every((p) => p.isPreset === true);
    check(
      "D-13.1 #87 프리셋 6종 (ai:5 + human:1) + id prefix 'preset:' + isPreset=true",
      total === 6 && human === 1 && ai === 5 && allPresetIds && allMarkedPreset,
    );
  }

  // 88. (D-13.1) 프리셋 colorToken이 모두 PERSONA_COLOR_TOKENS에 존재.
  {
    const allTokensValid = PERSONA_PRESETS.every((p) =>
      (PERSONA_COLOR_TOKENS as readonly string[]).includes(p.colorToken),
    );
    check(
      "D-13.1 #88 프리셋 colorToken 7종 토큰 카탈로그 내 존재",
      allTokensValid,
    );
  }

  // 89. (D-13.2) preset-store: PresetImmutableError 클래스 export + name === 'PresetImmutableError'
  {
    const err = new PresetImmutableError("remove", "preset:director");
    check(
      "D-13.2 #89 PresetImmutableError export + name + message format",
      err.name === "PresetImmutableError" &&
        err.message.includes("preset_immutable") &&
        err.message.includes("preset:director"),
    );
  }

  // 90. (D-13.0) ensurePresetSeed 함수 export.
  {
    check(
      "D-13.0 #90 ensurePresetSeed export 함수",
      typeof ensurePresetSeed === "function",
    );
  }

  // 91. (D-13.6) tokens v2 — globals.css에 participant-1~5 + human-1/2 = 7 토큰 박힘.
  {
    const css = readFileSync(`${projectRoot}/src/app/globals.css`, "utf-8");
    const tokens = [
      "--robusta-color-participant-1",
      "--robusta-color-participant-2",
      "--robusta-color-participant-3",
      "--robusta-color-participant-4",
      "--robusta-color-participant-5",
      "--robusta-color-participant-human-1",
      "--robusta-color-participant-human-2",
    ];
    const allPresent = tokens.every((tk) => css.includes(tk));
    check(
      "D-13.6 #91 globals.css participant-1~5 + human-1/2 = 7 토큰 정의",
      allPresent,
    );
  }

  // 92. (D-13.0) Persona 타입의 필드 셋 명세 §1과 동기화.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/personas/persona-types.ts`,
      "utf-8",
    );
    const fields = [
      /id\s*:\s*string/,
      /kind\s*:\s*PersonaKind/,
      /isPreset\s*:\s*boolean/,
      /nameKo\s*:\s*string/,
      /nameEn\s*:\s*string/,
      /colorToken\s*:\s*string/,
      /iconMonogram\s*:\s*string/,
      /systemPromptKo\s*:\s*string/,
      /systemPromptEn\s*:\s*string/,
      /defaultProvider\?\s*:\s*PersonaProvider/,
      /createdAt\s*:\s*number/,
      /updatedAt\s*:\s*number/,
    ];
    const ok = fields.every((re) => re.test(src));
    check("D-13.0 #92 Persona 인터페이스 12 필드 박힘", ok);
  }

  // 93. (D-13.5 → D-14.1) ParticipantsPanel — PersonaPickerModal/PersonaEditModal 박힘 + 제한 박힘.
  //     D-14.1 (Day 8): PersonaEditModal은 next/dynamic으로 lazy 로드. 정적 import 매칭 → dynamic 매칭으로 갱신.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/participants/participants-panel.tsx`,
      "utf-8",
    );
    // D-14.1: 정적 OR dynamic 둘 중 하나 매칭 — Picker/Edit 둘 다 lazy 박음.
    const hasPicker =
      /import\s*\{\s*PersonaPickerModal\s*\}/.test(src) ||
      /dynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*["']@\/modules\/personas\/persona-picker-modal["']\s*\)/.test(
        src,
      );
    const hasEdit =
      /import\s*\{\s*PersonaEditModal\s*\}/.test(src) ||
      /dynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*["']@\/modules\/personas\/persona-edit-modal["']\s*\)/.test(
        src,
      );
    const hasLimitTotal = /PARTICIPANT_LIMIT_TOTAL\s*=\s*4/.test(src);
    const hasLimitHuman = /PARTICIPANT_LIMIT_HUMAN\s*=\s*2/.test(src);
    const hasLimitAi = /PARTICIPANT_LIMIT_AI\s*=\s*3/.test(src);
    check(
      "D-13.5 #93 ParticipantsPanel: 픽커/편집 박힘(정적 또는 dynamic) + 제한 4/2/3 박힘",
      hasPicker && hasEdit && hasLimitTotal && hasLimitHuman && hasLimitAi,
    );
  }

  // 94. (D-13.5) [+참여자 추가] 버튼이 whitespace-nowrap 가드 박혀있음 (모바일 320px 줄바꿈 0).
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/participants/participants-panel.tsx`,
      "utf-8",
    );
    const ok =
      /참여자 추가/.test(src) && /whitespace-nowrap/.test(src);
    check(
      "D-13.5 #94 [+참여자 추가] whitespace-nowrap 가드 박힘 (Roy Do #9)",
      ok,
    );
  }

  // 95. (D-13) i18n 13건 ko/en 모두 박힘.
  {
    const ko = MESSAGES.ko;
    const en = MESSAGES.en;
    const keys: (keyof typeof ko)[] = [
      "persona.picker.title",
      "persona.picker.toggleAi",
      "persona.picker.toggleHuman",
      "persona.picker.customCta",
      "persona.preset.director",
      "persona.preset.engineer",
      "persona.preset.critic",
      "persona.preset.optimist",
      "persona.preset.researcher",
      "persona.preset.humanDefault",
      "persona.error.nameRequired",
      "persona.error.participantLimit",
      "persona.toast.saved",
    ];
    const allKoBoxed = keys.every((k) => typeof ko[k] === "string");
    const allEnBoxed = keys.every((k) => typeof en[k] === "string");
    // 본문 ≤200자 가드 (humanDefault는 빈 문자열 허용)
    const presetBodyKeys = [
      "persona.preset.director",
      "persona.preset.engineer",
      "persona.preset.critic",
      "persona.preset.optimist",
      "persona.preset.researcher",
    ] as const;
    const koUnder200 = presetBodyKeys.every((k) => ko[k].length > 0 && ko[k].length <= 200);
    const enUnder200 = presetBodyKeys.every((k) => en[k].length > 0 && en[k].length <= 200);
    check(
      "D-13 #95 i18n 13건 ko/en 박힘 + 프리셋 본문 1~200자",
      allKoBoxed && allEnBoxed && koUnder200 && enUnder200,
    );
  }

  // 96. (D-13.2) colorTokenToCssVar 합성 결과 'var(--token-name)' 형식.
  {
    const out = colorTokenToCssVar("robusta-color-participant-1");
    check(
      "D-13.2 #96 colorTokenToCssVar('foo') === 'var(--foo)'",
      out === "var(--robusta-color-participant-1)",
    );
  }
}

// === D-14 (Day 8, 2026-04-28) PersonaUnify + Mobile Layout + Yellow Band ===

import { runMobileLayoutCheck } from "./check-mobile-layout";

async function runD14Checks(): Promise<void> {
  const projectRoot = resolve(__dirname, "..");

  // 97. (D-14.1) PersonaEditModal lazy 로드 — participants-panel.tsx에서 next/dynamic 사용.
  //     실제 청크 분리는 next build 후 .next/static/chunks/ 검증이지만, 본 self-check는 소스
  //     레벨 정합성 보장 (dynamic + import('persona-edit-modal') 박혀있음).
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/participants/participants-panel.tsx`,
      "utf-8",
    );
    const hasDynamicImport =
      /import\s+dynamic\s+from\s+["']next\/dynamic["']/.test(src);
    const hasLazyEdit =
      /dynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*["']@\/modules\/personas\/persona-edit-modal["']\s*\)/.test(
        src,
      );
    check(
      "D-14.1 #97 PersonaEditModal lazy: next/dynamic + import('persona-edit-modal') 박힘",
      hasDynamicImport && hasLazyEdit,
    );
  }

  // 98. (D-14.2) Picker disabled 비주얼 + 1회 토스트 + i18n 4건 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/personas/persona-picker-modal.tsx`,
      "utf-8",
    );
    const hasOpacity = /opacity-40/.test(src);
    const hasCursor = /cursor-not-allowed/.test(src);
    const hasAriaDisabled = /aria-disabled=/.test(src);
    const hasToastKey = /toast\.participant\.limit/.test(src);
    check(
      "D-14.2 #98 picker disabled: opacity-40 + cursor-not-allowed + aria-disabled + toast.participant.limit 박힘",
      hasOpacity && hasCursor && hasAriaDisabled && hasToastKey,
    );
  }

  // 99. (D-14.3) PersonaModal/EditModal 모달 일원화.
  //     - conversation/persona-modal.tsx → PersonaEditModal import + 본문에 <input>/<textarea>/<select> 직접 미박힘.
  //     - participants-panel.tsx → mode="edit" 호출.
  {
    const shimSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/persona-modal.tsx`,
      "utf-8",
    );
    const panelSrc = readFileSync(
      `${projectRoot}/src/modules/participants/participants-panel.tsx`,
      "utf-8",
    );
    const shimImports =
      /from\s+["']@\/modules\/personas\/persona-edit-modal["']/.test(shimSrc);
    // shim 본문에 form input element 없음 (PersonaEditModal 내부에만 있음)
    const shimNoFormElements =
      !/<input\b/.test(shimSrc) &&
      !/<textarea\b/.test(shimSrc) &&
      !/<select\b/.test(shimSrc);
    const panelHasEditMode = /mode\s*=\s*["']edit["']/.test(panelSrc);
    check(
      "D-14.3 #99 모달 일원화: shim import + shim form elements 0 + panel mode='edit' 박힘",
      shimImports && shimNoFormElements && panelHasEditMode,
    );
  }

  // 100. (D-14.4) 모바일 320px 회귀 가드 — data-test 3종 + whitespace-nowrap + truncate|overflow-hidden.
  {
    const result = runMobileLayoutCheck();
    check(
      "D-14.4 #100 모바일 320px CSS 룰 스캔: 3개 셀렉터 모두 가드 박힘" +
        (result.ok ? "" : ` — ${result.failures.join(" / ")}`),
      result.ok,
    );
  }

  // 101. (D-14.5) 노란색 밴드 5단계 + canvas alias + 카드 v2 + 토스트 border-l-4.
  {
    const css = readFileSync(`${projectRoot}/src/app/globals.css`, "utf-8");
    const tokens = [
      "--robusta-yellow-50",
      "--robusta-yellow-100",
      "--robusta-yellow-200",
      "--robusta-yellow-300",
      "--robusta-yellow-500",
    ];
    const allTokens = tokens.every((tk) => css.includes(tk));
    const hasCanvasAlias =
      /--robusta-canvas\s*:\s*var\(--robusta-yellow-100\)/.test(css);

    const pickerSrc = readFileSync(
      `${projectRoot}/src/modules/personas/persona-picker-modal.tsx`,
      "utf-8",
    );
    // 카드 v2 — 모노그램 원 + (이름 truncate) + 2행 systemPrompt 60자 truncate.
    const hasCardV2 =
      /\.slice\(\s*\n?\s*0,\s*\n?\s*60,?\s*\n?\s*\)/.test(pickerSrc) ||
      /slice\(0,\s*60\)/.test(pickerSrc);

    const toastSrc = readFileSync(
      `${projectRoot}/src/modules/ui/toast.tsx`,
      "utf-8",
    );
    const hasBorderL4 = /border-l-4/.test(toastSrc);

    check(
      "D-14.5 #101 디자인 토큰: yellow-50~500 5종 + canvas alias + 카드 v2(60자 truncate) + 토스트 border-l-4",
      allTokens && hasCanvasAlias && hasCardV2 && hasBorderL4,
      `tokens=${allTokens} alias=${hasCanvasAlias} cardV2=${hasCardV2} border=${hasBorderL4}`,
    );
  }
}

// === D-15 (Day 9, 2026-04-28) Critic 인사 처리 + 헤더 동적 라벨 + 비판자 폴백 카피 ===

async function runD15Checks(): Promise<void> {
  const projectRoot = resolve(__dirname, "..");

  // 102. (D-15.1) Critic systemPrompt 인사 처리 라인 박힘 (i18n + preset-catalog 1:1 동기화).
  //     라이브 회귀(B-1) fix — Critic이 "안녕" 인사에 ⚠ 에러로 종료되던 문제. 인사·스몰토크 예외 박음.
  {
    const ko = MESSAGES.ko["persona.preset.critic"];
    const en = MESSAGES.en["persona.preset.critic"];
    // 키워드 가드: KO "인사·스몰토크", EN "Greetings"
    const koHasGreeting = /인사·스몰토크/.test(ko) || /인사/.test(ko);
    const enHasGreeting = /Greeting/i.test(en);
    // 본문 ≤200자 가드 유지 (#95 검증과 동일)
    const koUnder200 = ko.length > 0 && ko.length <= 200;
    const enUnder200 = en.length > 0 && en.length <= 200;

    const presetSrc = readFileSync(
      `${projectRoot}/src/modules/personas/preset-catalog.ts`,
      "utf-8",
    );
    // preset-catalog.ts와 messages.ts의 critic 본문이 동일 핵심 키워드 박음 (i18n 키 lookup이 아닌 직접 박음 — D-13.1 디자인).
    const presetKoMatches = presetSrc.includes(ko);
    const presetEnMatches = presetSrc.includes(en);
    check(
      "D-15.1 #102 Critic 본문에 인사 처리 박힘 + i18n/preset-catalog 동기화 + 200자 한도",
      koHasGreeting && enHasGreeting && koUnder200 && enUnder200 && presetKoMatches && presetEnMatches,
      `koGreet=${koHasGreeting} enGreet=${enHasGreeting} koLen=${ko.length} enLen=${en.length} presetKo=${presetKoMatches} presetEn=${presetEnMatches}`,
    );
  }

  // 103. (D-15.1) db.ts v6 마이그레이션 박힘 — 기존 critic preset row 강제 갱신.
  //     ensurePresetSeed 멱등 시드는 이미 박힌 row를 건너뛰므로, 기존 사용자 DB의 critic 본문을 fix하려면 마이그레이션 필요.
  {
    const dbSrc = readFileSync(`${projectRoot}/src/modules/storage/db.ts`, "utf-8");
    const hasV6 = /this\.version\(6\)\s*\.stores\(/.test(dbSrc);
    const hasUpgrade = /\.upgrade\(/.test(dbSrc) && /preset:critic/.test(dbSrc);
    const hasUpdate = /personas\.update\(\s*["']preset:critic["']/.test(dbSrc);
    check(
      "D-15.1 #103 db v6 마이그레이션: critic preset systemPrompt 강제 갱신",
      hasV6 && hasUpgrade && hasUpdate,
      `v6=${hasV6} upgrade=${hasUpgrade} update=${hasUpdate}`,
    );
  }

  // 104. (D-15.2) 헤더 발언 모드 라벨 동적 — turnMode subscribe + TURN_MODE_LABEL_KEY 매핑 박힘.
  //     B-2 라이브 회귀(헤더 'ROUND-ROBIN' 정적) fix.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hasSubscribe = /useConversationStore\(\(s\)\s*=>\s*s\.turnMode\)/.test(wsSrc);
    const hasLabelMap = /TURN_MODE_LABEL_KEY/.test(wsSrc);
    const hasManualKey = /["']header\.mode\.manual["']/.test(wsSrc);
    const hasRrKey = /["']header\.mode\.roundRobin["']/.test(wsSrc);
    const hasTriggerKey = /["']header\.mode\.trigger["']/.test(wsSrc);
    // 헤더 정적 텍스트 'Round-robin' 제거됐는지 (정적 백업 박힌 채면 회귀 가능성)
    const noStaticRoundRobin = !/Day\s*3\s*·\s*Round-robin/i.test(wsSrc);
    // data-test 가드 (라이브 검증용 셀렉터)
    const hasDataTest = /data-test=["']header-mode-label["']/.test(wsSrc);
    check(
      "D-15.2 #104 헤더 라벨 동적: turnMode subscribe + TURN_MODE_LABEL_KEY 매핑 + 정적 텍스트 제거",
      hasSubscribe && hasLabelMap && hasManualKey && hasRrKey && hasTriggerKey && noStaticRoundRobin && hasDataTest,
      `sub=${hasSubscribe} map=${hasLabelMap} m=${hasManualKey} rr=${hasRrKey} tr=${hasTriggerKey} noStatic=${noStaticRoundRobin} dt=${hasDataTest}`,
    );
  }

  // 105. (D-15.2) i18n header.mode.{manual,roundRobin,trigger} ko/en 박힘.
  {
    const koHas =
      typeof MESSAGES.ko["header.mode.manual"] === "string" &&
      typeof MESSAGES.ko["header.mode.roundRobin"] === "string" &&
      typeof MESSAGES.ko["header.mode.trigger"] === "string";
    const enHas =
      typeof MESSAGES.en["header.mode.manual"] === "string" &&
      typeof MESSAGES.en["header.mode.roundRobin"] === "string" &&
      typeof MESSAGES.en["header.mode.trigger"] === "string";
    // turnMode 3종 enum과 1:1 매핑 — 본문 비어있지 않아야 함 (헤더에 빈 라벨 박히면 사용자 혼란).
    const allFilled =
      MESSAGES.ko["header.mode.manual"].length > 0 &&
      MESSAGES.ko["header.mode.roundRobin"].length > 0 &&
      MESSAGES.ko["header.mode.trigger"].length > 0 &&
      MESSAGES.en["header.mode.manual"].length > 0 &&
      MESSAGES.en["header.mode.roundRobin"].length > 0 &&
      MESSAGES.en["header.mode.trigger"].length > 0;
    check(
      "D-15.2 #105 i18n header.mode.* 3종 ko/en 박힘 + 본문 비어있지 않음",
      koHas && enHas && allFilled,
    );
  }

  // 106. (D-15.1) F-D9-1 toast.critic.softFallback i18n ko/en 박힘 — D-D9-1 노란 액센트 카피.
  {
    const ko = MESSAGES.ko["toast.critic.softFallback"];
    const en = MESSAGES.en["toast.critic.softFallback"];
    const koHasIcon = ko.startsWith("⚠");
    const enHasIcon = en.startsWith("⚠");
    const koShort = ko.length > 0 && ko.length <= 80;
    const enShort = en.length > 0 && en.length <= 80;
    check(
      "D-15.1 #106 toast.critic.softFallback ko/en: ⚠ prefix + 1줄 80자 이내",
      koHasIcon && enHasIcon && koShort && enShort,
      `koLen=${ko.length} enLen=${en.length}`,
    );
  }
}

runAsyncChecks()
  .then(() => runD9AsyncChecks())
  .then(() => runD10AsyncChecks())
  .then(() => runD11D12Checks())
  .then(() => runD13Checks())
  .then(() => runD14Checks())
  .then(() => runD15Checks())
  .then(() => {
    process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
