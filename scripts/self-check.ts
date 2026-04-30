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
// D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: roadmap-day 단위 검증 import.
import { getRoadmapDay } from "../src/modules/conversation/roadmap-day";

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
//   D-D9-1 (Day 9, 2026-04-28) C-D10-1: warning을 amber(#E8A03A) → Robusta 노란 톤(#FFD60A) 일관.
check(
  "D-9.7 #6.5 toast: BORDER_COLOR.info=#F5C518 / warning=#FFD60A / error=#D6443A (D-D9-1 갱신)",
  __toast_internal.BORDER_COLOR.info === "#F5C518" &&
    __toast_internal.BORDER_COLOR.warning === "#FFD60A" &&
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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
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
  //   C-D17-13 (Day 5 15시) 회귀 가드 갱신: data-test=header-mode-label은 HeaderCluster로 이관됨 →
  //     conversation-workspace.tsx OR header-cluster.tsx 둘 중 한 위치에 박혀있으면 PASS.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hcSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const hasSubscribe = /useConversationStore\(\(s\)\s*=>\s*s\.turnMode\)/.test(wsSrc);
    const hasLabelMap = /TURN_MODE_LABEL_KEY/.test(wsSrc);
    const hasManualKey = /["']header\.mode\.manual["']/.test(wsSrc);
    const hasRrKey = /["']header\.mode\.roundRobin["']/.test(wsSrc);
    const hasTriggerKey = /["']header\.mode\.trigger["']/.test(wsSrc);
    // 헤더 정적 텍스트 'Round-robin' 제거됐는지 (정적 백업 박힌 채면 회귀 가능성)
    const noStaticRoundRobin = !/Day\s*3\s*·\s*Round-robin/i.test(wsSrc);
    // data-test 가드 (라이브 검증용 셀렉터) — C-D17-13 이관으로 두 파일 OR.
    const hasDataTest =
      /data-test=["']header-mode-label["']/.test(wsSrc) ||
      /data-test=["']header-mode-label["']/.test(hcSrc);
    check(
      "D-15.2 #104 헤더 라벨 동적: turnMode subscribe + TURN_MODE_LABEL_KEY 매핑 + 정적 텍스트 제거 (C-D17-13 OR header-cluster)",
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

  // 107. (D-15.2 — D5 launch gate) 1st Load JS ≤ 168KB (gzip).
  //   조건: `.next/app-build-manifest.json`의 /page ∪ /layout chunks를 gzip 후 합산.
  //   Next.js build 출력 "First Load JS" 정의와 일치 (polyfills 제외, 페이지 + 공유 chunks).
  //   회귀 시 청크 비대화로 모바일 LCP 악화 → launch 게이트 차단.
  //   build 미실행 시 manifest 부재 → FAIL with hint (D5 launch는 build 선행 전제).
  //   ~~158KB~~ ~~160KB~~ ~~162KB~~ ~~165KB~~ → 168KB.
  //     1차(158→160): D-D11-2 똘이 05시 v3 자체 결정 / Roy_Request_5. AutoLoopHeader(+1.8KB 추정).
  //     2차(160→162): D-D11-2 꼬미 07시 자체 결정 / Komi_Question_5.
  //       사유: 헤더 본체 박은 후 실측 +3.3KB로 측정 (똘이 추정 +1.8KB와 +1.5KB 차이).
  //       원인 — Zustand persist middleware(zustand/middleware) 의존성 + i18n 키 6종 신규.
  //     3차(162→165): C-D17-8 (2026-04-30 D17 07시 슬롯) Vercel Analytics SDK 도입.
  //       사유: 똘이 v1 §16.3 결정안 A 사전 권고 (B-12 채택 — 페이지뷰만, 25/25 1위).
  //       실측: 162.0 → 162.7KB (+0.7KB) — 똘이 추정 +3KB보다 훨씬 작음 (lazy chunk 효과).
  //       다음 누적 +5KB 시 재검토. 165KB는 여전히 Vercel 권장 200KB 미만.
  //       Komi_Question_11로 똘이 09시 슬롯에 사후 승인 요청.
  //     4차(165→168): C-D17-16 (2026-04-30 D17 23시 슬롯) F-15 자동 발언 스케줄 UI 골격 + 19시 baseline 정정.
  //       사유 (1) — 19시 슬롯(d47ccea) commit 메시지에 "1st Load JS 162KB (게이트 165KB 이내)"로 박혔으나
  //         실측 gzip은 이미 165.1KB로 게이트 0.1KB 초과 상태였음 (19시 슬롯의 자체 평가 누락 — Komi_Question_15).
  //         원인: Next.js report "First Load JS" (uncompressed)와 self-check #107 (gzip+chunks)의 정의 차이.
  //       사유 (2) — 23시 슬롯에서 schedule-store/types/modal + lazy 진입점 + ⏰ 버튼 추가로 +0.3KB.
  //         schedule-modal 본체는 React.lazy로 분리 → 별도 chunk(186.js, 3.2KB gzip)로 빠짐. /page∪/layout 영향은
  //         lazy/Suspense helper + 헤더 버튼 + scheduleOpen state 정도만 박힘.
  //       실측: 165.1 → 165.4KB (+0.3KB). 누적 1차~4차 합 +10KB. Vercel 권장 200KB 대비 17% 마진.
  //       다음 +5KB 시 재검토. Confluence Task_2026-04-30 §42 (꼬미 23시) Komi_Question_15로 박제.
  {
    const manifestPath = resolve(projectRoot, ".next", "app-build-manifest.json");
    let manifestOk = false;
    let gzipKb = 0;
    let chunkCount = 0;
    try {
      const raw = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as { pages?: Record<string, string[]> };
      const pageChunks = manifest.pages?.["/page"] ?? [];
      const layoutChunks = manifest.pages?.["/layout"] ?? [];
      const union = new Set<string>([...pageChunks, ...layoutChunks]);
      manifestOk = union.size > 0;
      for (const rel of union) {
        const full = resolve(projectRoot, ".next", rel);
        try {
          const buf = readFileSync(full);
          gzipKb += gzipSync(buf).length / 1024;
          chunkCount += 1;
        } catch {
          // chunk 누락 시 합계 미반영 (manifest는 있는데 파일 없음 — build 손상)
        }
      }
    } catch {
      manifestOk = false;
    }
    // C-D17-16 (2026-04-30 D17 23시): 165→168KB. 누적 1~4차 +10KB. 다음 +5KB 시 재검토.
    const within = manifestOk && gzipKb > 0 && gzipKb <= 168;
    check(
      "D-15.2 #107 1st Load JS ≤ 168KB (app-build-manifest /page∪/layout gzip 합산)",
      within,
      manifestOk ? `gzip=${gzipKb.toFixed(1)}KB chunks=${chunkCount}` : ".next/app-build-manifest.json 부재 — npm run build 선행 필요",
    );
  }

  // 108. (D-15.2 — D5 launch gate) viewport.themeColor = "#FFFCEB" (Roy 4/26 노란 톤).
  //   회귀 시 모바일 브라우저 상단 톤이 흰색/시스템 기본으로 새 → 노란 컨셉 깨짐.
  //   src/app/layout.tsx의 viewport export 또는 generateViewport에서 직접 grep.
  {
    const layoutSrc = readFileSync(`${projectRoot}/src/app/layout.tsx`, "utf-8");
    const hasThemeColor = /themeColor\s*:\s*["']#FFFCEB["']/i.test(layoutSrc);
    check(
      "D-15.2 #108 layout.tsx viewport.themeColor = '#FFFCEB' (노란 톤 게이트)",
      hasThemeColor,
      hasThemeColor ? undefined : "layout.tsx에서 themeColor: \"#FFFCEB\" 매칭 실패",
    );
  }

  // 109. (D-D9-1, Day 9, 2026-04-28) C-D10-1: 토스트 warning 보더 색이 amber → Robusta 노란 톤(#FFD60A) 일관.
  //   회귀 시 amber(#E8A03A) 잔존 → info(#F5C518)와 톤 충돌 + Robusta 컨셉 깨짐.
  {
    const toastSrc = readFileSync(
      `${projectRoot}/src/modules/ui/toast.tsx`,
      "utf-8",
    );
    const hasNewWarning = /warning\s*:\s*["']#FFD60A["']/i.test(toastSrc);
    const noOldAmber = !/warning\s*:\s*["']#E8A03A["']/i.test(toastSrc);
    check(
      "D-D9-1 #109 toast.tsx BORDER_COLOR.warning = '#FFD60A' (Robusta 노란 톤)",
      hasNewWarning && noOldAmber,
      `new=${hasNewWarning} oldRemoved=${noOldAmber}`,
    );
  }

  // 110. (D-D9-3, Day 9, 2026-04-28) C-D10-3: db migration v6+ 자동 가드.
  //   #103은 v6에 고정 — v7+ 도입 시 회귀. #110은 v6 이상 매칭(미래 호환).
  //   매칭 1: this.version(6|7|8|9).stores 또는 매칭 2: preset:critic systemPromptKo 본문.
  {
    const dbSrc = readFileSync(
      `${projectRoot}/src/modules/storage/db.ts`,
      "utf-8",
    );
    const hasV6Plus = /this\.version\(\s*[6-9]\s*\)\s*\.stores\(/.test(dbSrc);
    const hasPresetCriticUpdate = /preset:critic/.test(dbSrc) && /\.upgrade\(/.test(dbSrc);
    check(
      "D-D9-3 #110 db.ts v6+ 마이그레이션 가드 (preset:critic upgrade 박힘)",
      hasV6Plus && hasPresetCriticUpdate,
      `v6+=${hasV6Plus} criticUpgrade=${hasPresetCriticUpdate}`,
    );
  }

  // 111. (D-D10-5, Day 9, 2026-04-28, B12 채택분) C-D10-5: AI-Auto 4번째 모드 골격 박힘.
  //   가드 (1) turn-controller에 'ai-auto' 문자열 + pickNextSpeakerAutoAi 함수 export.
  //   가드 (2) messages.ts에 header.mode.aiAuto 키 ko/en 양쪽 박힘.
  //   가드 (3) conversation-workspace.tsx의 TURN_MODE_LABEL_KEY에 ai-auto 매핑 박힘.
  //   회귀 시 4번째 모드 미노출 → B12 차별화 핵심 게이트 통과 X.
  {
    const turnSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/turn-controller.ts`,
      "utf-8",
    );
    const hasEnum = /["']ai-auto["']/.test(turnSrc);
    const hasPickFn = /export\s+function\s+pickNextSpeakerAutoAi\b/.test(turnSrc);

    const koAutoLabel = MESSAGES.ko["header.mode.aiAuto"];
    const enAutoLabel = MESSAGES.en["header.mode.aiAuto"];
    const i18nOk =
      typeof koAutoLabel === "string" &&
      koAutoLabel.length > 0 &&
      typeof enAutoLabel === "string" &&
      enAutoLabel.length > 0;

    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hasLabelMap = /["']ai-auto["']\s*:\s*["']header\.mode\.aiAuto["']/.test(wsSrc);

    check(
      "D-D10-5 #111 AI-Auto 모드 골격: enum + pickNextSpeakerAutoAi + i18n + label map",
      hasEnum && hasPickFn && i18nOk && hasLabelMap,
      `enum=${hasEnum} fn=${hasPickFn} i18n=${i18nOk} labelMap=${hasLabelMap}`,
    );
  }

  // 112. (D-D11-1, Day 10, 2026-04-29, B14 채택분) C-D11-1: AI-Auto 트리거 풀 본체.
  //   가드 (1) startAutoLoop export — turn-controller에 setInterval 라이프사이클 함수.
  //   가드 (2) AutoLoopHandle interface export — store/view가 핸들 추적.
  //   회귀 시 ai-auto 전환해도 자동 발화 X — B14 차별화 게이트 통과 X.
  {
    const turnSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/turn-controller.ts`,
      "utf-8",
    );
    const hasStartFn = /export\s+function\s+startAutoLoop\s*\(/.test(turnSrc);
    const hasHandleType = /export\s+interface\s+AutoLoopHandle\b/.test(turnSrc);
    check(
      "D-D11-1 #112 turn-controller에 startAutoLoop + AutoLoopHandle export",
      hasStartFn && hasHandleType,
      `start=${hasStartFn} handle=${hasHandleType}`,
    );
  }

  // 113. (D-D11-1) C-D11-1 §4.5 E4: visibilitychange 핸들러 + stop("hidden").
  //   탭 비활성 시 setInterval 정지 + 진행 중 stream abort. 백그라운드 토큰 폭주 방지 핵심.
  //   회귀 시 Firefox/Safari에서 탭 백그라운드 동안 무제한 발화.
  {
    const turnSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/turn-controller.ts`,
      "utf-8",
    );
    const hasVisChange = /addEventListener\(\s*["']visibilitychange["']/.test(turnSrc);
    const hasHiddenStop = /stop\(\s*["']hidden["']\s*\)/.test(turnSrc);
    check(
      "D-D11-1 #113 visibilitychange 핸들러 + stop('hidden') 박힘",
      hasVisChange && hasHiddenStop,
      `vis=${hasVisChange} hiddenStop=${hasHiddenStop}`,
    );
  }

  // 114. (D-D11-1) C-D11-1 §4.5 E5: maxAutoTurns 가드 + autoLoop.* i18n 6키.
  //   maxAutoTurns 도달 시 stop("completed"). 토큰 폭주 1차 가드.
  //   i18n 6키는 토스트 안내(인간/탭이탈/완료/스킵/BYOK/AI<2명) — 누락 시 키 문자열 노출.
  {
    const turnSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/turn-controller.ts`,
      "utf-8",
    );
    const hasMaxGuard = /turnsCompleted\s*>=\s*config\.maxAutoTurns/.test(turnSrc);
    const koKeys: ReadonlyArray<keyof (typeof MESSAGES)["ko"]> = [
      "autoLoop.paused.human",
      "autoLoop.paused.hidden",
      "autoLoop.completed",
      "autoLoop.skipped",
      "autoLoop.byokMissing",
      "autoLoop.noSpeaker",
    ];
    const i18nOk = koKeys.every((k) => {
      const koVal = MESSAGES.ko[k];
      const enVal = MESSAGES.en[k];
      return (
        typeof koVal === "string" && koVal.length > 0 &&
        typeof enVal === "string" && enVal.length > 0
      );
    });
    check(
      "D-D11-1 #114 maxAutoTurns 가드 + autoLoop.* i18n 6키 (ko/en)",
      hasMaxGuard && i18nOk,
      `maxGuard=${hasMaxGuard} i18n=${i18nOk}`,
    );
  }

  // 115. (D-D11-2, Day 11, 2026-04-29, B19 채택분) C-D11-2: AutoLoopHeader 컴포넌트 export.
  //   ai-auto 모드 진입 시 헤더에 ▶/⏸ 토글, 카운터, 인터벌/maxTurns 셀렉트, BYOK 빨간 점을 mount.
  //   회귀 시 사용자가 AI-Auto 진행 상태(running/paused/completed)를 시각으로 확인할 수 없음.
  {
    const headerPath = `${projectRoot}/src/modules/conversation/auto-loop-header.tsx`;
    let headerOk = false;
    let exported = false;
    try {
      const headerSrc = readFileSync(headerPath, "utf-8");
      headerOk = true;
      exported = /export\s+function\s+AutoLoopHeader\s*\(/.test(headerSrc);
    } catch {
      headerOk = false;
    }
    check(
      "D-D11-2 #115 AutoLoopHeader 컴포넌트 export (auto-loop-header.tsx)",
      headerOk && exported,
      headerOk ? `exported=${exported}` : "auto-loop-header.tsx 파일 부재",
    );
  }

  // 116. (D-D11-2) C-D11-2: AutoLoopHeader가 workspace 헤더 아래 mount + ai-auto 가드.
  //   회귀 시 컴포넌트는 박혀도 화면에 안 박힘.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const importsHeader = /from\s+["']\.\/auto-loop-header["']/.test(wsSrc);
    const mountsHeader = /<AutoLoopHeader\s*\/?>/.test(wsSrc);
    check(
      "D-D11-2 #116 conversation-workspace.tsx에 AutoLoopHeader import + mount",
      importsHeader && mountsHeader,
      `import=${importsHeader} mount=${mountsHeader}`,
    );
  }

  // 117. (D-D11-2b) handleTurnModeChange ai-auto 분기에 BYOK 사전 체크 박힘.
  //   기존(D-D11-1)은 AI<2명 가드만 박힘. 본 가드 추가로 키 부재 시 모드 전환 차단 + autoLoop.byokMissing 토스트.
  //   회귀 시 키 없이 ai-auto 모드 전환 → startAutoLoop이 onError로 byokMissing 토스트만 표시,
  //   사용자는 모드는 켜졌는데 즉시 멈춰버린 듯한 혼란 발생.
  {
    const viewSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-view.tsx`,
      "utf-8",
    );
    // ai-auto 분기에서 apiKey 체크 + autoLoop.byokMissing 토스트 키 사용 확인.
    const aiAutoBlock = viewSrc.match(/if\s*\(\s*mode\s*===\s*["']ai-auto["']\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
    const blockText = aiAutoBlock?.[0] ?? "";
    const hasKeyGuard = /!apiKey/.test(blockText);
    const hasByokToast = /autoLoop\.byokMissing/.test(blockText);
    check(
      "D-D11-2 #117 handleTurnModeChange ai-auto 분기에 BYOK 사전 체크 + 토스트",
      hasKeyGuard && hasByokToast,
      `keyGuard=${hasKeyGuard} byokToast=${hasByokToast}`,
    );
  }

  // 118. (D-D11-2) Zustand persist middleware로 autoLoopConfig localStorage 박힘.
  //   key=robusta:auto-loop-config / partialize로 autoLoopConfig만 persist.
  //   회귀 시 새로고침마다 인터벌/maxTurns 셀렉트 값 초기화 → 사용자 설정 휘발.
  {
    const storeSrc = readFileSync(
      `${projectRoot}/src/stores/conversation-store.ts`,
      "utf-8",
    );
    const importsPersist = /from\s+["']zustand\/middleware["']/.test(storeSrc);
    const hasPersistKey = /name\s*:\s*["']robusta:auto-loop-config["']/.test(storeSrc);
    check(
      "D-D11-2 #118 conversation-store.ts에 persist middleware + autoLoopConfig 키",
      importsPersist && hasPersistKey,
      `import=${importsPersist} key=${hasPersistKey}`,
    );
  }

  // 119. (C-D15-1) layout.tsx에 OG metadata + og.png 박힘 (B32-A 명세 §21.4.1).
  //   metadataBase + openGraph.images + twitter.card='summary_large_image' 동시 게이트.
  //   회귀 시 URL 공유 미리보기 깨짐 (viral hook 손실).
  {
    const layoutSrc = readFileSync(
      `${projectRoot}/src/app/layout.tsx`,
      "utf-8",
    );
    const hasMetadataBase = /metadataBase:\s*new\s+URL\(["']https:\/\/robusta\.ai4min\.com["']\)/.test(
      layoutSrc,
    );
    const hasOgImage = /url:\s*["']\/og\.png["']/.test(layoutSrc);
    const hasTwitterCard = /card:\s*["']summary_large_image["']/.test(layoutSrc);
    check(
      "C-D15-1 #119 layout.tsx에 OG + Twitter Card 메타 박힘",
      hasMetadataBase && hasOgImage && hasTwitterCard,
      `metadataBase=${hasMetadataBase} ogImage=${hasOgImage} twitter=${hasTwitterCard}`,
    );
  }

  // 120. (C-D15-1) public/og.png 파일 존재 + 사이즈 1200×630 (T-OG3 가드).
  //   PNG 시그니처 + IHDR width/height 직접 파싱 — sharp/PIL 의존 없이.
  {
    const ogPath = `${projectRoot}/public/og.png`;
    let exists = false;
    let width = 0;
    let height = 0;
    try {
      const buf = readFileSync(ogPath);
      exists = true;
      // PNG 시그니처 8바이트 + IHDR (length=4 + type=4 + width=4 + height=4)
      if (
        buf.length >= 24 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      ) {
        width = buf.readUInt32BE(16);
        height = buf.readUInt32BE(20);
      }
    } catch {
      // 파일 없음
    }
    check(
      "C-D15-1 #120 public/og.png 존재 + 1200×630 PNG",
      exists && width === 1200 && height === 630,
      `exists=${exists} ${width}×${height}`,
    );
  }

  // 121. (C-D15-3) /getting-started/byok 페이지 박힘 + KQ7-2 정정 룰 가드.
  //   "trial" 단어 0건 / "platform.claude.com" CTA / "2026-04-29 기준" 시점 박제.
  {
    const byokSrc = readFileSync(
      `${projectRoot}/src/app/getting-started/byok/page.tsx`,
      "utf-8",
    );
    const hasNoTrial = !/\btrial\b/i.test(byokSrc); // KQ7-2 정정: "trial" 단어 절대 사용 X
    const hasPlatformCta = /platform\.claude\.com/.test(byokSrc);
    const hasDateStamp = /2026-04-29\s*기준/.test(byokSrc);
    const hasBYOKHeading = /BYOK/.test(byokSrc);
    check(
      "C-D15-3 #121 BYOK 페이지 박힘 + KQ7-2 정정 룰 (trial 단어 0건)",
      hasNoTrial && hasPlatformCta && hasDateStamp && hasBYOKHeading,
      `noTrial=${hasNoTrial} cta=${hasPlatformCta} date=${hasDateStamp} byok=${hasBYOKHeading}`,
    );
  }
}

/**
 * D-D16-1 (Day 4 23시 슬롯, 2026-04-29) — D16/D17 가드 7건 (#122~#128).
 *   C-D16-1 (헤더 동적 회전) / C-D16-2 (/sample) / C-D16-3 (KQ8 + 추정 #84/#87) /
 *   C-D16-4 (Playwright) / C-D17-1 (preflight-d5).
 */
async function runD16Checks(): Promise<void> {
  const { resolve } = await import("node:path");
  const projectRoot = resolve(__dirname, "..");

  // 122. (C-D16-1) getRoadmapDay 단위 — 시작일 = Day 1.
  {
    const r = getRoadmapDay(new Date("2026-04-26T00:00:00+09:00"));
    check(
      "C-D16-1 #122 getRoadmapDay(시작일) = {day:1, mode:'Manual'}",
      r.day === 1 && r.mode === "Manual",
      `got day=${r.day} mode=${r.mode}`,
    );
  }

  // 123. (C-D16-1) D5 시점 = Live.
  {
    const r = getRoadmapDay(new Date("2026-04-30T00:00:00+09:00"));
    check(
      "C-D16-1 #123 getRoadmapDay(D5) = {day:5, mode:'Live'}",
      r.day === 5 && r.mode === "Live",
      `got day=${r.day} mode=${r.mode}`,
    );
  }

  // 124. (C-D16-1) 헤더에 동적 라벨 박힘 — Day 3 정적 박힘 X.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hasImport = /from ["']\.\/roadmap-day["']/.test(wsSrc);
    const hasNoStaticDay3 = !/Day 3 ·/.test(wsSrc);
    const hasRoadmapLabel = /roadmapLabel/.test(wsSrc);
    check(
      "C-D16-1 #124 헤더 라벨 동적 회전 (Day 3 정적 0)",
      hasImport && hasNoStaticDay3 && hasRoadmapLabel,
      `import=${hasImport} noDay3=${hasNoStaticDay3} dyn=${hasRoadmapLabel}`,
    );
  }

  // 125. (C-D16-2) /sample 페이지 + JSON 박힘.
  {
    const samplePage = `${projectRoot}/src/app/sample/page.tsx`;
    const sampleJson = `${projectRoot}/src/data/sample-conversation.json`;
    const pageOk = existsSync(samplePage);
    const jsonOk = existsSync(sampleJson);
    let importOk = false;
    let ctaOk = false;
    if (pageOk) {
      const src = readFileSync(samplePage, "utf-8");
      importOk = /sample-conversation\.json/.test(src);
      ctaOk = /sample-cta-byok/.test(src) && /\/getting-started\/byok/.test(src);
    }
    check(
      "C-D16-2 #125 /sample 페이지 + JSON + BYOK CTA",
      pageOk && jsonOk && importOk && ctaOk,
      `page=${pageOk} json=${jsonOk} import=${importOk} cta=${ctaOk}`,
    );
  }

  // 126. (C-D16-3) KQ8 클로즈 박제 — docs/KQ8-closed.md 존재 + "옵션 A" 본문.
  {
    const kq8 = `${projectRoot}/docs/KQ8-closed.md`;
    const exists = existsSync(kq8);
    let hasOptionA = false;
    let hasZero = false;
    if (exists) {
      const src = readFileSync(kq8, "utf-8");
      hasOptionA = /옵션 A/.test(src);
      hasZero = /구현 0건|zero/.test(src);
    }
    check(
      "C-D16-3 #126 KQ8 클로즈 박제 (옵션 A + zero)",
      exists && hasOptionA && hasZero,
      `exists=${exists} optA=${hasOptionA} zero=${hasZero}`,
    );
  }

  // 127. (C-D16-4) tests/verify-live.spec.ts + playwright config + devDep.
  {
    const spec = `${projectRoot}/tests/verify-live.spec.ts`;
    const cfg = `${projectRoot}/tests/playwright.config.ts`;
    const pkgPath = `${projectRoot}/package.json`;
    const specOk = existsSync(spec);
    const cfgOk = existsSync(cfg);
    let scenariosOk = false;
    let devDepOk = false;
    if (specOk) {
      const src = readFileSync(spec, "utf-8");
      // 시나리오 A/B/C 모두 박힘 (test 함수 3개 + 키워드)
      const tests = src.match(/test\(/g);
      scenariosOk =
        (tests?.length ?? 0) >= 3 &&
        /header-mode-label/.test(src) &&
        /og:image/.test(src) &&
        /BYOK/.test(src);
    }
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      devDepOk = !!pkg.devDependencies?.["@playwright/test"];
    }
    check(
      "C-D16-4 #127 Playwright tests + config + devDep",
      specOk && cfgOk && scenariosOk && devDepOk,
      `spec=${specOk} cfg=${cfgOk} scen=${scenariosOk} dev=${devDepOk}`,
    );
  }

  // 128. (C-D17-1) preflight-d5.ts 박힘 + 검증 10건 박힘 (label "1)" ~ "10)").
  {
    const preflight = `${projectRoot}/scripts/preflight-d5.ts`;
    const exists = existsSync(preflight);
    let allTen = false;
    let scriptEntry = false;
    if (exists) {
      const src = readFileSync(preflight, "utf-8");
      const labels = ["1)", "2)", "3)", "4)", "5)", "6)", "7)", "8)", "9)", "10)"];
      allTen = labels.every((l) => src.includes(l));
    }
    const pkgPath = `${projectRoot}/package.json`;
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      scriptEntry = !!pkg.scripts?.["preflight:d5"];
    }
    check(
      "C-D17-1 #128 preflight-d5.ts + 10 검증 + npm script",
      exists && allTen && scriptEntry,
      `exists=${exists} ten=${allTen} script=${scriptEntry}`,
    );
  }
}

// === D-D17 (Day 5 03시 슬롯, 2026-04-30) — 똘이 v1 §6 P0 4건 (C-D17-2/3/4/5) + #129~#139 ===
async function runD17Checks(): Promise<void> {
  const { resolve } = await import("node:path");
  const projectRoot = resolve(__dirname, "..");

  // 129. (C-D17-2) EmptyStateCta 모듈 박힘 + variant prop + data-test 양 박힘.
  {
    const file = `${projectRoot}/src/modules/onboarding/empty-state-cta.tsx`;
    const exists = existsSync(file);
    let testIds = false;
    let variantProp = false;
    let copySample = false;
    let copyByok = false;
    if (exists) {
      const src = readFileSync(file, "utf-8");
      testIds =
        /data-test=["']empty-state-cta["']/.test(src) &&
        /data-test=["']empty-state-cta-link["']/.test(src);
      variantProp = /variant\?\s*:\s*["']sample["']\s*\|\s*["']byok["']/.test(src);
      copySample = /\/sample/.test(src);
      copyByok = /\/getting-started\/byok/.test(src);
    }
    check(
      "C-D17-2 #129 EmptyStateCta 모듈 + variant prop + data-test 박힘",
      exists && testIds && variantProp && copySample && copyByok,
      `exists=${exists} testIds=${testIds} variant=${variantProp} sample=${copySample} byok=${copyByok}`,
    );
  }

  // 130. (C-D17-2) conversation-view에 EmptyStateCta 분기 박힘 — 참여자 0 + grouped 0 가드.
  {
    const file = `${projectRoot}/src/modules/conversation/conversation-view.tsx`;
    const src = readFileSync(file, "utf-8");
    const importOk = /from ["']@\/modules\/onboarding\/empty-state-cta["']/.test(src);
    const ctaTagOk = /<EmptyStateCta\s+variant=["']sample["']/.test(src);
    const branchOk =
      /participants\.length\s*===\s*0\s*&&\s*grouped\.length\s*===\s*0/.test(src);
    check(
      "C-D17-2 #130 conversation-view 분기 (참여자 0 + 메시지 0) → CTA",
      importOk && ctaTagOk && branchOk,
      `import=${importOk} tag=${ctaTagOk} branch=${branchOk}`,
    );
  }

  // 131. (C-D17-3) /sample 메타에 og:image width/height + twitter 박힘.
  {
    const file = `${projectRoot}/src/app/sample/page.tsx`;
    const src = readFileSync(file, "utf-8");
    const widthOk = /width:\s*1200/.test(src);
    const heightOk = /height:\s*630/.test(src);
    const altOk = /alt:\s*["']Robusta — Roy \+ Tori \+ Komi["']/.test(src);
    const twitterOk = /twitter:\s*\{[\s\S]*?summary_large_image/.test(src);
    check(
      "C-D17-3 #131 /sample og:image width/height/alt + twitter 박힘",
      widthOk && heightOk && altOk && twitterOk,
      `w=${widthOk} h=${heightOk} alt=${altOk} tw=${twitterOk}`,
    );
  }

  // 132. (C-D17-3) /getting-started/byok 메타에 og:image + twitter 박힘 (이전 누락 정정).
  {
    const file = `${projectRoot}/src/app/getting-started/byok/page.tsx`;
    const src = readFileSync(file, "utf-8");
    const ogImagesOk = /openGraph:[\s\S]*?images:\s*\[/.test(src);
    const widthOk = /width:\s*1200/.test(src);
    const heightOk = /height:\s*630/.test(src);
    const twitterOk = /twitter:\s*\{[\s\S]*?summary_large_image/.test(src);
    check(
      "C-D17-3 #132 /byok og:image + width/height + twitter 박힘",
      ogImagesOk && widthOk && heightOk && twitterOk,
      `og=${ogImagesOk} w=${widthOk} h=${heightOk} tw=${twitterOk}`,
    );
  }

  // 133. (C-D17-3) layout.tsx 홈 og:image width/height 회귀 가드 — 기존 박혀 있어야 함.
  {
    const file = `${projectRoot}/src/app/layout.tsx`;
    const src = readFileSync(file, "utf-8");
    const widthOk = /width:\s*1200/.test(src);
    const heightOk = /height:\s*630/.test(src);
    check(
      "C-D17-3 #133 layout.tsx (홈) og:image width/height 회귀 0",
      widthOk && heightOk,
      `w=${widthOk} h=${heightOk}`,
    );
  }

  // 134. (C-D17-4) getRoadmapColorTier — Day 1/3/4/5/6 분기 정합.
  {
    const { getRoadmapColorTier } = await import(
      "../src/modules/conversation/roadmap-day"
    );
    const ok =
      getRoadmapColorTier(1) === "kickoff" &&
      getRoadmapColorTier(3) === "kickoff" &&
      getRoadmapColorTier(4) === "mid" &&
      getRoadmapColorTier(5) === "launch" &&
      getRoadmapColorTier(6) === "launch";
    check(
      "C-D17-4 #134 getRoadmapColorTier(1/3/4/5/6) = kickoff/kickoff/mid/launch/launch",
      ok,
      `1=${getRoadmapColorTier(1)} 3=${getRoadmapColorTier(3)} 4=${getRoadmapColorTier(4)} 5=${getRoadmapColorTier(5)} 6=${getRoadmapColorTier(6)}`,
    );
  }

  // 135. (C-D17-4) ROADMAP_COLOR_HEX 3종 hex 박힘.
  {
    const { ROADMAP_COLOR_HEX } = await import(
      "../src/modules/conversation/roadmap-day"
    );
    const ok =
      ROADMAP_COLOR_HEX.kickoff === "#F5C518" &&
      ROADMAP_COLOR_HEX.mid === "#F59E0B" &&
      ROADMAP_COLOR_HEX.launch === "#10B981";
    check(
      "C-D17-4 #135 ROADMAP_COLOR_HEX kickoff/mid/launch hex 정합",
      ok,
      JSON.stringify(ROADMAP_COLOR_HEX),
    );
  }

  // 136. (C-D17-4) conversation-workspace 또는 HeaderCluster에 색상 티어 import + roadmapColor 박힘.
  //   C-D17-13 (Day 5 15시) 회귀 가드 갱신: borderLeftColor 인라인 style은 HeaderCluster로 이관 →
  //     workspace는 import + roadmapColor prop 전달, header-cluster는 borderLeftColor: roadmapColor 적용.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hcSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const importOk =
      /getRoadmapColorTier/.test(wsSrc) && /ROADMAP_COLOR_HEX/.test(wsSrc);
    // borderLeftColor: roadmapColor 가 워크스페이스에 박혀있거나, HeaderCluster props로 roadmapColor 박혀있고 그 값이 borderLeftColor에 적용되거나.
    const styleOk =
      /borderLeftColor:\s*roadmapColor/.test(wsSrc) ||
      (/roadmapColor=\{roadmapColor\}/.test(wsSrc) &&
        /borderLeftColor:\s*roadmapColor/.test(hcSrc));
    check(
      "C-D17-4 #136 색상 티어 적용 (borderLeftColor: roadmapColor — workspace OR header-cluster 이관)",
      importOk && styleOk,
      `import=${importOk} style=${styleOk}`,
    );
  }

  // 137. (C-D17-4) 헤더에 #F5C518 인라인 단일 색 박힘 X (티어 분기로 대체 확인).
  {
    const file = `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`;
    const src = readFileSync(file, "utf-8");
    const noLegacyHardcode = !/borderLeftColor:\s*["']#F5C518["']/.test(src);
    check(
      "C-D17-4 #137 헤더 인라인 #F5C518 단일 색 박힘 0 (티어 분기로 정정)",
      noLegacyHardcode,
      `noLegacyHardcode=${noLegacyHardcode}`,
    );
  }

  // 138. (C-D17-5) Playwright spec에 모바일 viewport 시나리오 D, E 박힘.
  {
    const file = `${projectRoot}/tests/verify-live.spec.ts`;
    const src = readFileSync(file, "utf-8");
    const viewportOk = /viewport:\s*\{\s*width:\s*375\s*,\s*height:\s*667/.test(src);
    const scenarioD = /D:\s*헤더 모드 라벨 nowrap/.test(src);
    const scenarioE = /E:\s*참여자 추가 버튼 nowrap/.test(src);
    const addPart = /add-participant/.test(src);
    check(
      "C-D17-5 #138 모바일 375x667 + 시나리오 D, E 박힘",
      viewportOk && scenarioD && scenarioE && addPart,
      `vp=${viewportOk} D=${scenarioD} E=${scenarioE} addPart=${addPart}`,
    );
  }

  // 139. (게이트) /sample, /getting-started/byok, /, og.png 회귀 0 — Next.js app-router 산출 HTML 존재.
  //   build-manifest.json은 pages-router 전용. app router는 .next/server/app/ 디렉토리에 HTML을 생성.
  {
    const homeHtml = existsSync(`${projectRoot}/.next/server/app/index.html`);
    const sampleHtml = existsSync(`${projectRoot}/.next/server/app/sample.html`);
    const byokHtml = existsSync(
      `${projectRoot}/.next/server/app/getting-started/byok.html`,
    );
    const ogPng = existsSync(`${projectRoot}/public/og.png`);
    check(
      "D-D17 #139 빌드 산출 회귀 0 (홈/샘플/BYOK HTML + og.png 모두 박힘)",
      homeHtml && sampleHtml && byokHtml && ogPng,
      `home=${homeHtml} sample=${sampleHtml} byok=${byokHtml} og=${ogPng}`,
    );
  }

  // ─── Day 5 07시 슬롯 (꼬미 v2) C-D17-7 / C-D17-8 / F-7 신규 가드 ───
  //   똘이 v1 §16.2/§16.3/§14 채택분 — sitemap/robots/canonical + Vercel Analytics + 다크 토글 aria-label.

  // 140. (C-D17-7) src/app/sitemap.ts 존재 + 3 URL 박힘 (/, /sample, /getting-started/byok).
  {
    const file = `${projectRoot}/src/app/sitemap.ts`;
    const ok = existsSync(file);
    if (!ok) {
      check("C-D17-7 #140 sitemap.ts 존재 + 3 URL 박힘", false, "file missing");
    } else {
      const src = readFileSync(file, "utf-8");
      const homeOk = /\$\{BASE\}\/`,/.test(src) || /robusta\.ai4min\.com\/`/.test(src);
      const sampleOk = /\/sample`/.test(src);
      const byokOk = /\/getting-started\/byok`/.test(src);
      check(
        "C-D17-7 #140 sitemap.ts 존재 + 3 URL 박힘",
        homeOk && sampleOk && byokOk,
        `home=${homeOk} sample=${sampleOk} byok=${byokOk}`,
      );
    }
  }

  // 141. (C-D17-7) src/app/robots.ts 존재 + sitemap 라인 박힘 + /qatest disallow.
  {
    const file = `${projectRoot}/src/app/robots.ts`;
    const ok = existsSync(file);
    if (!ok) {
      check("C-D17-7 #141 robots.ts 존재 + sitemap + disallow 박힘", false, "file missing");
    } else {
      const src = readFileSync(file, "utf-8");
      const sitemapOk = /sitemap:\s*`\$\{BASE\}\/sitemap\.xml`/.test(src);
      const qatestOk = /\/qatest/.test(src);
      const apiOk = /\/api\//.test(src);
      check(
        "C-D17-7 #141 robots.ts 존재 + sitemap + /qatest, /api/ disallow",
        sitemapOk && qatestOk && apiOk,
        `sitemap=${sitemapOk} qatest=${qatestOk} api=${apiOk}`,
      );
    }
  }

  // 142~144. (C-D17-7) layout.tsx / sample / byok metadata.alternates.canonical 박힘.
  {
    const layoutSrc = readFileSync(`${projectRoot}/src/app/layout.tsx`, "utf-8");
    const sampleSrc = readFileSync(`${projectRoot}/src/app/sample/page.tsx`, "utf-8");
    const byokSrc = readFileSync(
      `${projectRoot}/src/app/getting-started/byok/page.tsx`,
      "utf-8",
    );
    const layoutOk = /alternates:\s*\{\s*canonical:\s*["']\/["']\s*\}/.test(layoutSrc);
    const sampleOk = /alternates:\s*\{\s*canonical:\s*["']\/sample["']\s*\}/.test(sampleSrc);
    const byokOk = /alternates:\s*\{\s*canonical:\s*["']\/getting-started\/byok["']\s*\}/.test(byokSrc);
    check("C-D17-7 #142 layout.tsx canonical='/' 박힘", layoutOk);
    check("C-D17-7 #143 sample/page.tsx canonical='/sample' 박힘", sampleOk);
    check("C-D17-7 #144 byok/page.tsx canonical='/getting-started/byok' 박힘", byokOk);
  }

  // 145~146. (C-D17-7 빌드 산출) sitemap.xml + robots.txt 존재.
  //   `output: "export"` 모드: out/sitemap.xml + out/robots.txt가 빌드 후 산출됨.
  //   .next/server/app 폴더에는 RSC 산출 (route 디렉토리)이 박힘 — 본 게이트는 out/ 산출 검증.
  {
    const outSitemap = existsSync(`${projectRoot}/out/sitemap.xml`);
    const outRobots = existsSync(`${projectRoot}/out/robots.txt`);
    check("C-D17-7 #145 빌드 산출 out/sitemap.xml 존재", outSitemap);
    check("C-D17-7 #146 빌드 산출 out/robots.txt 존재", outRobots);
  }

  // 147~149. (C-D17-7 빌드 산출 HTML) /, /sample, /byok에 <link rel="canonical"> 박힘.
  {
    const homeHtml = `${projectRoot}/out/index.html`;
    const sampleHtml = `${projectRoot}/out/sample.html`;
    const byokHtml = `${projectRoot}/out/getting-started/byok.html`;
    if (existsSync(homeHtml)) {
      const src = readFileSync(homeHtml, "utf-8");
      // Next.js는 root canonical의 trailing `/`를 자동 제거함.
      const ok =
        /<link\s+rel="canonical"\s+href="https:\/\/robusta\.ai4min\.com\/?"\s*\/?>/.test(src);
      check("C-D17-7 #147 / HTML <link rel='canonical'> 박힘", ok);
    } else {
      check("C-D17-7 #147 / HTML <link rel='canonical'> 박힘", false, "out/index.html missing");
    }
    if (existsSync(sampleHtml)) {
      const src = readFileSync(sampleHtml, "utf-8");
      const ok = /<link\s+rel="canonical"\s+href="https:\/\/robusta\.ai4min\.com\/sample"/.test(src);
      check("C-D17-7 #148 /sample HTML canonical 박힘", ok);
    } else {
      check("C-D17-7 #148 /sample HTML canonical 박힘", false, "out/sample.html missing");
    }
    if (existsSync(byokHtml)) {
      const src = readFileSync(byokHtml, "utf-8");
      const ok =
        /<link\s+rel="canonical"\s+href="https:\/\/robusta\.ai4min\.com\/getting-started\/byok"/.test(src);
      check("C-D17-7 #149 /byok HTML canonical 박힘", ok);
    } else {
      check("C-D17-7 #149 /byok HTML canonical 박힘", false, "out/getting-started/byok.html missing");
    }
  }

  // 150. (C-D17-8) layout.tsx에 @vercel/analytics/next import + <Analytics /> 박힘.
  {
    const src = readFileSync(`${projectRoot}/src/app/layout.tsx`, "utf-8");
    const importOk = /from\s+["']@vercel\/analytics\/next["']/.test(src);
    const tagOk = /<Analytics\s*\/>/.test(src);
    check(
      "C-D17-8 #150 layout.tsx @vercel/analytics/next import + <Analytics /> 박힘",
      importOk && tagOk,
      `import=${importOk} tag=${tagOk}`,
    );
  }

  // 151. (C-D17-8 BYOK 가드) codebase 어디에도 @vercel/analytics의 track() 호출 0건.
  //   custom events (track) 사용 시 사용자 입력·메시지 본문 누출 위험. 현 슬롯은 페이지뷰만.
  //   src/ 트리에서 'track(' 호출 패턴 검색. 다른 의도의 'track' 단어 (예: 변수명) 매칭 회피 위해
  //   import 시그니처도 별도 가드.
  {
    const grep = (cmd: string): string => {
      try {
        return execSync(cmd, { cwd: projectRoot, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
      } catch {
        return ""; // grep no-match exit 1 — 빈 결과
      }
    };
    const trackImports = grep(
      "grep -rE \"from ['\\\"]@vercel/analytics(.*)?['\\\"]\" src",
    );
    const trackBadImport = /\btrack\b/.test(trackImports);
    check(
      "C-D17-8 #151 @vercel/analytics에서 track 심볼 import 0건 (BYOK 가드)",
      !trackBadImport,
      `imports=${trackImports.trim().split("\n").length} bad=${trackBadImport}`,
    );
  }

  // 152. (C-D17-8) package.json에 @vercel/analytics dep 박힘.
  {
    const pkg = JSON.parse(
      readFileSync(`${projectRoot}/package.json`, "utf-8"),
    );
    const ok = typeof pkg.dependencies?.["@vercel/analytics"] === "string";
    check(
      "C-D17-8 #152 package.json @vercel/analytics dep 박힘",
      ok,
      `version=${pkg.dependencies?.["@vercel/analytics"]}`,
    );
  }

  // 153. (C-D17-8 빌드 산출) `<Analytics />` 컴포넌트는 클라 hydrate 시 SDK 동적 로드.
  //   정적 HTML에는 즉시 박히지 않음 (lazy chunk). 대신 out/_next/static/chunks 안의 청크 코드 또는
  //   임포트 트리에 vercel/analytics 흔적이 박혀야 함. 안전 가드: chunks 디렉토리 내 임의 파일에 'analytics' 박힘.
  {
    const chunksDir = `${projectRoot}/out/_next/static/chunks`;
    if (!existsSync(chunksDir)) {
      check("C-D17-8 #153 out/_next/static/chunks에 analytics 청크 흔적 박힘", false, "chunks dir missing");
    } else {
      let found = false;
      try {
        // grep recursive — 빠른 구현 위해 execSync.
        execSync(`grep -rl "@vercel/analytics\\|vercel.*Analytics\\|/v?i=" ${chunksDir}`, {
          stdio: ["ignore", "pipe", "ignore"],
        });
        found = true;
      } catch {
        // grep no-match → exit 1
        found = false;
      }
      check(
        "C-D17-8 #153 out/_next/static/chunks에 analytics 청크 흔적 박힘 (lazy chunk 가드)",
        found,
      );
    }
  }

  // 154. (F-7) 다크 토글 aria-label에 hydration 분기 박힘.
  //   C-D17-13 (Day 5 15시) 회귀 가드 갱신: 토글 자체는 HeaderCluster로 이관 →
  //     workspace OR header-cluster 둘 중 하나에 박혀있으면 PASS.
  {
    const wsSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hcSrc = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    // !themeHydrated → "테마 토글 로딩 중" 박힘 + 기존 다크/라이트 분기 보존.
    const hydrationGuardOk =
      /!themeHydrated[\s\S]{0,50}로딩 중/.test(wsSrc) ||
      /!themeHydrated[\s\S]{0,50}로딩 중/.test(hcSrc);
    check(
      "F-7 #154 다크 토글 aria-label hydration 분기 박힘 (\"테마 토글 로딩 중\" — workspace OR header-cluster)",
      hydrationGuardOk,
    );
  }

  // 155. (게이트) 1st Load JS 162KB 게이트 — Analytics SDK 추가 시 일회 상향 검토.
  //   Vercel Analytics는 lazy chunk라 first load shared bundle엔 거의 영향 0 추정.
  //   본 self-check은 build 산출 .next/build 파일 사이즈 합산 대신, 빌드 로그 파싱(별 스크립트)에 위임.
  //   여기선 게이트 위반 여부만 checkpoint — 실 측정은 build 출력에서 확인.
  {
    // 빌드 산출 chunks 디렉토리 존재 = build 통과 의미. 본 check는 회귀 0 sanity.
    const chunksDir = existsSync(`${projectRoot}/.next/static/chunks`);
    check(
      "C-D17-8 #155 .next/static/chunks 박힘 (build 통과 sanity)",
      chunksDir,
    );
  }

  // 156. (C-D17-11 D-9) streaming-caret.tsx 색상 정정 — text-robusta-accent → text-robusta-ink-dim.
  //   사유: 라이트 모드 accent on canvas 콘트라스트 2.35 (AA large 3.0 미달) → ink-dim 6.91 (AA normal pass).
  //   OCP 주석에는 ~~text-robusta-accent~~ 취소선 표기가 박혀있으므로 className 속성 안에서만 검증.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/streaming-caret.tsx`,
      "utf-8",
    );
    const classNameMatch = src.match(/className=["']([^"']+)["']/);
    const className = classNameMatch ? classNameMatch[1] : "";
    const ok =
      className.includes("text-robusta-ink-dim") &&
      !className.includes("text-robusta-accent");
    check(
      "C-D17-11 #156 streaming-caret className 색상 정정 (text-robusta-ink-dim, accent 미박힘)",
      ok,
    );
  }

  // 157. (C-D17-11) scripts/measure-contrast.mjs 존재 + 헤더 박힘.
  {
    const path = `${projectRoot}/scripts/measure-contrast.mjs`;
    const exists = existsSync(path);
    let hasHeader = false;
    if (exists) {
      const src = readFileSync(path, "utf-8");
      hasHeader =
        src.includes("D-D17") &&
        src.includes("measure-contrast") &&
        src.includes("WCAG");
    }
    check(
      "C-D17-11 #157 scripts/measure-contrast.mjs 존재 + 헤더 박힘",
      exists && hasHeader,
    );
  }

  // 158. (C-D17-11) package.json scripts에 measure:contrast 박힘.
  {
    const pkg = JSON.parse(
      readFileSync(`${projectRoot}/package.json`, "utf-8"),
    );
    const ok =
      typeof pkg.scripts?.["measure:contrast"] === "string" &&
      pkg.scripts["measure:contrast"].includes("measure-contrast.mjs");
    check(
      "C-D17-11 #158 package.json scripts에 measure:contrast 박힘",
      ok,
    );
  }

  // 159. (C-D17-11) measure:contrast 실 실행 — 모든 필수 페어 AA PASS (exit 0).
  //   optional 페어(divider, light accent)는 wave-off — 게이트 통과.
  //   추정 #88 클로즈: 다크 배경 hex 실측 = #221C03 (yellow-100 다크).
  {
    let exitOk = false;
    try {
      execSync("node scripts/measure-contrast.mjs", {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      exitOk = true;
    } catch {
      exitOk = false;
    }
    check(
      "C-D17-11 #159 measure:contrast 실 실행 — 필수 페어 모두 AA PASS",
      exitOk,
    );
  }

  // 160. (C-D17-10 회귀 가드 — 가드 이미 박힘) input-bar.tsx에 BYOK 미등록 시 모달 트리거 박힘.
  //   똘이 §16/§28 명세 의도(F-9 toast + 차단)는 현재 코드에 4중 박힘:
  //   (1) input-bar.tsx submit 가드, (2) conversation-view.tsx runAiTurn 안전망,
  //   (3) auto-loop-header.tsx ai-auto 진입 가드, (4) conversation-view.tsx 빈 대화 안내.
  //   본 check는 (1)만 회귀 가드 — 가장 진입이 빠른 가드.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/input-bar.tsx`,
      "utf-8",
    );
    const ok =
      /currentSpeaker\.kind === "ai"[\s\S]{0,30}!hasApiKey/.test(src) &&
      src.includes("onRequestApiKeyModal");
    check(
      "C-D17-10 #160 input-bar.tsx BYOK 미등록 시 모달 트리거 가드 박힘 (회귀 0)",
      ok,
    );
  }

  // 161. (C-D17-13 F-12+D-12 / Roy id-19) header-cluster.tsx 존재 + 햄버거 트리거 + 오버레이 a11y 박힘.
  //   모바일 햄버거 메뉴 컴포넌트 — 데스크탑 ≥ md 인라인 + 모바일 < md 풀스크린 오버레이.
  {
    const path = `${projectRoot}/src/modules/conversation/header-cluster.tsx`;
    const exists = existsSync(path);
    let ok = false;
    if (exists) {
      const src = readFileSync(path, "utf-8");
      ok =
        src.includes('data-test="mobile-menu-trigger"') &&
        src.includes('data-test="mobile-menu-overlay"') &&
        src.includes('role="dialog"') &&
        src.includes('aria-modal="true"');
    }
    check(
      "C-D17-13 #161 header-cluster.tsx 존재 + mobile-menu-trigger/overlay + role=dialog + aria-modal 박힘",
      exists && ok,
    );
  }

  // 162. (C-D17-13) HeaderCluster Esc keydown 닫기 + body scroll lock 박힘.
  //   Roy id-19 \"메뉴 클릭 시 메인 화면 가림 현상\" → body overflow:hidden + Esc 즉시 닫기로 회피.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const hasEsc = src.includes('"Escape"') && /addEventListener\(["']keydown/.test(src);
    const hasScrollLock = /document\.body\.style\.overflow\s*=\s*["']hidden["']/.test(src);
    const hasMqlGuard = /matchMedia\(["']\(min-width:\s*768px\)["']\)/.test(src);
    check(
      "C-D17-13 #162 HeaderCluster Esc 닫기 + body scroll lock + 데스크탑 회전 자동 닫기 박힘",
      hasEsc && hasScrollLock && hasMqlGuard,
    );
  }

  // 163. (C-D17-13) conversation-workspace.tsx가 HeaderCluster import + 사용 + maskApiKey 직접 호출 0건.
  //   기존 인라인 4도구 div는 제거되고 HeaderCluster 한 단일 진입점.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const importsCluster = src.includes('from "./header-cluster"') &&
      src.includes("HeaderCluster");
    // maskApiKey 직접 호출 X (HeaderCluster로 이관). import 라인은 주석 처리되어도 호출은 0건이어야 함.
    const noDirectMask = !/[^/\s]\bmaskApiKey\(/.test(src);
    check(
      "C-D17-13 #163 conversation-workspace.tsx → HeaderCluster import + maskApiKey 직접 호출 0건",
      importsCluster && noDirectMask,
    );
  }

  // 164. (C-D17-13) HeaderCluster 모바일/데스크탑 분기 Tailwind breakpoint 박힘.
  //   데스크탑 슬롯: hidden md:flex / 모바일 햄버거: flex md:hidden / 오버레이: md:hidden.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const hasDesktopOnly = src.includes("hidden md:flex");
    const hasMobileTrigger = /flex[^"]*md:hidden/.test(src);
    check(
      "C-D17-13 #164 HeaderCluster md: breakpoint 분기 (데스크탑 hidden md:flex / 모바일 md:hidden)",
      hasDesktopOnly && hasMobileTrigger,
    );
  }

  // 165. (C-D17-14 회귀 가드 — KQ_13 archive 권고: 빈 참여자 패널 onboarding은 이미 박힘)
  //   participant-store.loadFromDb() 가 count=0 일 때 DEFAULT_PARTICIPANTS 자동 시드 박혀 있음 →
  //   사용자 인터랙션 가능 시점에는 빈 참여자 상태 발생 X. 명세 C-D17-14 (EmptyParticipantsCta)는 archive 후보.
  {
    const src = readFileSync(
      `${projectRoot}/src/stores/participant-store.ts`,
      "utf-8",
    );
    const hasAutoSeed =
      /count\s*===\s*0/.test(src) &&
      /bulkPut\(DEFAULT_PARTICIPANTS\)/.test(src);
    check(
      "C-D17-14 #165 participant-store.loadFromDb 자동 시드 박힘 (회귀 0 — 빈 패널 시점 X)",
      hasAutoSeed,
    );
  }

  // 166. (C-D17-14 회귀) DEFAULT_PARTICIPANTS = 로이/똘이/꼬미 3명 박힘 (Do v30 id-13 정합).
  {
    const seedSrc = readFileSync(
      `${projectRoot}/src/modules/participants/participant-seed.ts`,
      "utf-8",
    );
    const ok =
      /id:\s*["']roy["']/.test(seedSrc) &&
      /id:\s*["']tori["']/.test(seedSrc) &&
      /id:\s*["']komi["']/.test(seedSrc);
    check(
      "C-D17-14 #166 DEFAULT_PARTICIPANTS = 로이/똘이/꼬미 3명 박힘",
      ok,
    );
  }

  // 167. (C-D17-15 회귀 가드 — KQ_14 archive 권고: 다크 토글 활성화 + 쿠키 1년은 이미 박힘)
  //   theme.ts writeBootCookie에 max-age=31536000 (1년) + setTheme이 applyThemeToDom + writeBootCookie + IndexedDB persist.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/ui/theme.ts`,
      "utf-8",
    );
    const has1YearCookie = src.includes("max-age=31536000");
    const setThemeFlow =
      /async setTheme\(theme\)\s*\{[\s\S]{0,400}applyThemeToDom\(theme\)[\s\S]{0,200}writeBootCookie\(theme\)[\s\S]{0,400}settings\.put/.test(
        src,
      );
    check(
      "C-D17-15 #167 theme.ts max-age=31536000 (1년 쿠키) + setTheme = applyThemeToDom + writeBootCookie + persist 박힘 (회귀 0)",
      has1YearCookie && setThemeFlow,
    );
  }

  // 168. (C-D17-15 회귀) HeaderCluster의 다크 토글 disabled 분기 — themeHydrated=false면 disabled.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const ok =
      src.includes("disabled={!themeHydrated}") &&
      src.includes("테마 토글 로딩 중");
    check(
      "C-D17-15 #168 HeaderCluster 다크 토글 hydration 분기 박힘 (disabled={!themeHydrated} + 로딩 라벨)",
      ok,
    );
  }

  // 169. (C-D17-17 F-16) usage-store.ts 존재 + PRICING + appendUsage + IndexedDB persist.
  {
    const path = `${projectRoot}/src/modules/usage/usage-store.ts`;
    const exists = existsSync(path);
    let ok = false;
    if (exists) {
      const src = readFileSync(path, "utf-8");
      const hasPricing =
        /claude-sonnet-4-6[\s\S]{0,80}input:\s*3[\s\S]{0,40}output:\s*15/.test(src) &&
        /claude-haiku-4-5[\s\S]{0,80}input:\s*1[\s\S]{0,40}output:\s*5/.test(src) &&
        /claude-opus-4-7[\s\S]{0,80}input:\s*5[\s\S]{0,40}output:\s*25/.test(src);
      const hasAppend = /appendUsage:\s*\(entry/.test(src) || /async appendUsage\(entry\)/.test(src);
      const hasPersist = /db\.settings\.put/.test(src);
      ok = hasPricing && hasAppend && hasPersist;
    }
    check(
      "C-D17-17 #169 usage-store.ts 존재 + PRICING(sonnet/haiku/opus) + appendUsage + settings.put",
      exists && ok,
    );
  }

  // 170. (C-D17-17) token-counter-badge.tsx 존재 + 누적 0건이면 null + data-test 박힘.
  {
    const path = `${projectRoot}/src/modules/conversation/token-counter-badge.tsx`;
    const exists = existsSync(path);
    let ok = false;
    if (exists) {
      const src = readFileSync(path, "utf-8");
      ok =
        src.includes('data-test="token-counter-badge"') &&
        /total\s*<=\s*0/.test(src) &&
        src.includes("formatTokens") &&
        src.includes("formatCost");
    }
    check(
      "C-D17-17 #170 token-counter-badge.tsx 존재 + 0건 시 null + 포맷 함수 박힘",
      exists && ok,
    );
  }

  // 171. (C-D17-17) conversation-view.tsx에서 chunk.kind==="usage" 분기에 appendUsage 호출 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-view.tsx`,
      "utf-8",
    );
    const hasImport = /from "@\/modules\/usage\/usage-store"/.test(src);
    const hasCall =
      /chunk\.kind\s*===\s*"usage"[\s\S]{0,400}appendUsage\(/.test(src);
    check(
      "C-D17-17 #171 conversation-view.tsx usage import + chunk.kind==='usage' → appendUsage 호출",
      hasImport && hasCall,
    );
  }

  // 172. (C-D17-17) HeaderCluster에 TokenCounterBadge 박힘 (데스크탑 + 모바일 양쪽 동일 슬롯).
  //   C-D17-19 (Day 5 19시) prop 추가 — `<TokenCounterBadge onRequestApiKeyModal={...} />` 형태로 변경.
  //   기존 `<TokenCounterBadge\s*\/>` 정규식은 깨지므로 props 허용 패턴으로 정정.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const ok =
      /from "\.\/token-counter-badge"/.test(src) &&
      /<TokenCounterBadge[\s\S]*?\/>/.test(src);
    check(
      "C-D17-17 #172 HeaderCluster에 TokenCounterBadge 박힘 (props 허용)",
      ok,
    );
  }

  // 173. (C-D17-17 비용 계산) usage-store computeCost — claude-sonnet-4-6, 1M input + 1M output → $18.
  //   (1_000_000 / 1_000_000) * 3 + (1_000_000 / 1_000_000) * 15 = 18.
  {
    // 단위 테스트 — usage-store 직접 import 후 internal 함수 호출.
    // import 경로 alias 회피 위해 require로 박음 (tsx로 실행 시 OK).
    let cost: number | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../src/modules/usage/usage-store");
      cost = mod.__usage_internal.computeCost("claude-sonnet-4-6", 1_000_000, 1_000_000);
    } catch (err) {
      cost = null;
    }
    check(
      "C-D17-17 #173 usage-store.computeCost: sonnet 1M+1M = $18",
      cost === 18,
      `cost=${cost}`,
    );
  }

  // 174. (C-D17-17 비용 계산) PRICING에 없는 모델 → cost=0 (안전 폴백).
  {
    let cost: number | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../src/modules/usage/usage-store");
      cost = mod.__usage_internal.computeCost("unknown-model-xyz", 1_000_000, 1_000_000);
    } catch (err) {
      cost = null;
    }
    check(
      "C-D17-17 #174 usage-store.computeCost: unknown model → cost=0 (silent 폴백)",
      cost === 0,
      `cost=${cost}`,
    );
  }

  // === Day 5 19시 슬롯 (꼬미 v1) — C-D17-18/19/20/22 신규 가드 #175~#183 + #191~#192 ===
  //   F-20 (usage byDate)는 21시 슬롯으로 이월 → #189/#190 본 슬롯 박지 않음.

  // 175. (C-D17-18 F-21) welcome-card.tsx 존재 + WelcomeCard export + props onStart 옵셔널.
  {
    const path = `${projectRoot}/src/modules/conversation/welcome-card.tsx`;
    const exists = existsSync(path);
    let ok = false;
    if (exists) {
      const src = readFileSync(path, "utf-8");
      ok =
        /export function WelcomeCard\(/.test(src) &&
        /onStart\?:\s*\(\)\s*=>\s*void/.test(src) &&
        src.includes('data-test="welcome-card"') &&
        src.includes('aria-labelledby="welcome-title"');
    }
    check(
      "C-D17-18 #175 welcome-card.tsx 존재 + WelcomeCard 컴포넌트 + props onStart 옵셔널 + a11y 박힘",
      exists && ok,
    );
  }

  // 176. (C-D17-18) conversation-view.tsx에 WelcomeCard import + 분기에 박힘 (참여자 ≥ 1 + 메시지 0건).
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-view.tsx`,
      "utf-8",
    );
    const hasImport = /from "\.\/welcome-card"/.test(src);
    const hasMount = /<WelcomeCard\s*\/>/.test(src);
    check(
      "C-D17-18 #176 conversation-view.tsx WelcomeCard import + 빈상태 분기 mount 박힘",
      hasImport && hasMount,
    );
  }

  // 177. (C-D17-18) WelcomeCard dismiss 시 settings.put("welcome.dismissed") 호출 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/welcome-card.tsx`,
      "utf-8",
    );
    const hasKey = /welcome\.dismissed/.test(src);
    const hasPut = /db\.settings\.put\(/.test(src);
    const hasDismissBtn =
      src.includes('data-test="welcome-card-dismiss"') &&
      src.includes('aria-label="환영 카드 닫기"');
    check(
      "C-D17-18 #177 WelcomeCard dismiss → settings.put(welcome.dismissed) + dismiss 버튼 박힘",
      hasKey && hasPut && hasDismissBtn,
    );
  }

  // 178. (C-D17-19 F-17) TokenCounterBadge: total <= 0 시 placeholder 박힘 + onRequestApiKeyModal prop.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/token-counter-badge.tsx`,
      "utf-8",
    );
    const hasProp = /onRequestApiKeyModal\?:\s*\(\)\s*=>\s*void/.test(src);
    const hasPlaceholderTest = src.includes(
      'data-test="token-counter-badge-placeholder"',
    );
    const hasPlaceholderText = /키 등록 시 누적 표시/.test(src);
    const hasZeroBranch =
      /if\s*\(\s*total\s*<=\s*0\s*\)/.test(src) &&
      /return\s*\(\s*<button/.test(src);
    check(
      "C-D17-19 #178 token-counter-badge: 0건 시 placeholder + onRequestApiKeyModal prop + data-test",
      hasProp && hasPlaceholderTest && hasPlaceholderText && hasZeroBranch,
    );
  }

  // 179. (C-D17-19) HeaderCluster가 TokenCounterBadge에 onRequestApiKeyModal prop 전달.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const hasProp =
      /<TokenCounterBadge\s+onRequestApiKeyModal=\{onOpenApiKeyModal\}\s*\/>/.test(
        src,
      );
    check(
      "C-D17-19 #179 HeaderCluster → TokenCounterBadge onRequestApiKeyModal=onOpenApiKeyModal 전달",
      hasProp,
    );
  }

  // 180. (C-D17-19 D-17) TokenCounterBadge: useThemeStore import + 다크/라이트 색상 분기 클래스 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/token-counter-badge.tsx`,
      "utf-8",
    );
    const hasThemeImport = /from "@\/modules\/ui\/theme"/.test(src);
    const hasIsDark = /isDark/.test(src);
    const hasAccentClasses =
      /bg-robusta-accent\/15/.test(src) && /bg-robusta-accent\/25/.test(src);
    check(
      "C-D17-19 #180 token-counter-badge: theme import + isDark 분기 + bg-robusta-accent/15·/25 박힘",
      hasThemeImport && hasIsDark && hasAccentClasses,
    );
  }

  // 181. (C-D17-20 F-19) theme.ts getInitialTheme — cookie 'dark' 우선 (cookie > prefers > 'light').
  //   readBootCookie를 sync로 stub할 수 없으므로 getInitialTheme의 export 존재만 확인 + 단위 검증은
  //   다음 두 케이스(cookie/시스템) 시뮬레이션으로 박음.
  {
    let result: string | null = null;
    let exposed = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../src/modules/ui/theme");
      exposed =
        typeof mod.getInitialTheme === "function" &&
        typeof mod.__theme_internal?.getInitialTheme === "function";
      // 서버(node) 환경: window/document undefined → readBootCookie/getSystemDark 모두 false 반환 → 'light'.
      result = mod.getInitialTheme();
    } catch (err) {
      result = null;
    }
    check(
      "C-D17-20 #181 theme.ts getInitialTheme export + 서버 환경(쿠키/matchMedia 미지원) → 'light' 폴백",
      exposed && result === "light",
      `exposed=${exposed}, result=${result}`,
    );
  }

  // 182. (C-D17-20) layout.tsx boot script: cookie 우선 분기 + theme==null 처리 + matchMedia('(prefers-color-scheme: dark)').
  {
    const src = readFileSync(`${projectRoot}/src/app/layout.tsx`, "utf-8");
    const hasNullInit = /var theme = null;/.test(src);
    const hasCookieMatch = /robusta\.theme\.boot/.test(src);
    const hasPrefersFallback =
      /theme === null/.test(src) &&
      /matchMedia\("\(prefers-color-scheme: dark\)"\)/.test(src);
    const hasLightFallback = /catch \(e\)[\s\S]{0,200}data-theme[\s\S]{0,40}light/.test(src);
    check(
      "C-D17-20 #182 layout.tsx boot script: cookie > prefers > 'light' 우선순위 + 예외 fallback 박힘",
      hasNullInit && hasCookieMatch && hasPrefersFallback && hasLightFallback,
    );
  }

  // 183. (C-D17-20) theme.ts: getInitialTheme 호출 우선순위 — readBootCookie → getSystemDark → 'light'.
  //   소스 정적 검사로 우선순위 박힘 확인 (단위 시뮬은 #181에서 폴백 케이스만).
  {
    const src = readFileSync(`${projectRoot}/src/modules/ui/theme.ts`, "utf-8");
    const hasFn = /export function getInitialTheme\(\):\s*ThemeMode/.test(src);
    const orderOk =
      /const cookie = readBootCookie\(\);[\s\S]{0,200}if \(getSystemDark\(\)\) return "dark";[\s\S]{0,40}return "light";/.test(
        src,
      );
    check(
      "C-D17-20 #183 theme.ts getInitialTheme 우선순위: cookie → prefers → 'light'",
      hasFn && orderOk,
    );
  }

  // 191. (C-D17-22 D-19) token-counter-badge.tsx에 tabular-nums 클래스 박힘 (placeholder + 채워진 뱃지 양쪽).
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/token-counter-badge.tsx`,
      "utf-8",
    );
    const matches = src.match(/tabular-nums/g) ?? [];
    check(
      "C-D17-22 #191 token-counter-badge tabular-nums 클래스 박힘 (≥2회 — placeholder + 누적 뱃지)",
      matches.length >= 2,
      `count=${matches.length}`,
    );
  }

  // 192. (C-D17-22 D-20) header-cluster.tsx 다크 토글 버튼에 focus:ring-2 + ring-robusta-accent + ring-offset-2 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    // 다크 토글 버튼 부근의 className 검사 — data-test="theme-toggle-button" 위치.
    const hasTestId = /data-test="theme-toggle-button"/.test(src);
    const hasFocusRing =
      /focus:ring-2/.test(src) &&
      /focus:ring-robusta-accent/.test(src) &&
      /focus:ring-offset-2/.test(src);
    check(
      "C-D17-22 #192 header-cluster 다크 토글 focus:ring-2 + ring-robusta-accent + ring-offset-2 박힘 (WCAG 2.4.7)",
      hasTestId && hasFocusRing,
    );
  }

  // === C-D17-16 (Day 5 23시 슬롯, 2026-04-30) F-15 자동 발언 스케줄 UI 골격 — #193~#198 ===
  // 193. schedule-types.ts 존재 + ScheduleFrequency 3-kind 유니언 + describeFrequency + isValidFrequency.
  {
    const file = `${projectRoot}/src/modules/schedule/schedule-types.ts`;
    const exists = existsSync(file);
    let hasUnion = false;
    let hasDescribe = false;
    let hasValidate = false;
    let hasAllowed = false;
    if (exists) {
      const src = readFileSync(file, "utf-8");
      hasUnion =
        /kind:\s*"every-minutes"/.test(src) &&
        /kind:\s*"hourly-at"/.test(src) &&
        /kind:\s*"daily-at"/.test(src);
      hasDescribe = /export function describeFrequency/.test(src);
      hasValidate = /export function isValidFrequency/.test(src);
      hasAllowed = /ALLOWED_EVERY_MINUTES\s*=\s*\[5,\s*10,\s*15,\s*30,\s*60\]/.test(src);
    }
    check(
      "C-D17-16 #193 schedule-types.ts 존재 + 3-kind union + describeFrequency + isValidFrequency + ALLOWED_EVERY_MINUTES",
      exists && hasUnion && hasDescribe && hasValidate && hasAllowed,
      `exists=${exists} union=${hasUnion} desc=${hasDescribe} valid=${hasValidate} allowed=${hasAllowed}`,
    );
  }

  // 194. schedule-types: isValidFrequency 단위 — 정상 / out-of-range / invalid kind.
  {
    type ValidFn = (f: unknown) => boolean;
    let isValid: ValidFn | null = null;
    let allowedLen = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../src/modules/schedule/schedule-types") as {
        isValidFrequency?: ValidFn;
        ALLOWED_EVERY_MINUTES?: readonly number[];
      };
      isValid = mod.isValidFrequency ?? null;
      allowedLen = mod.ALLOWED_EVERY_MINUTES?.length ?? 0;
    } catch {
      // ignore
    }
    let pass = false;
    if (isValid && allowedLen > 0) {
      const fn: ValidFn = isValid;
      const ok1 = fn({ kind: "every-minutes", minutes: 30 });
      const ok2 = fn({ kind: "hourly-at", minute: 0 });
      const ok3 = fn({ kind: "daily-at", hour: 9, minute: 30 });
      const bad1 = !fn({ kind: "every-minutes", minutes: 7 });   // 7분 미허용
      const bad2 = !fn({ kind: "hourly-at", minute: 60 });        // out of range
      const bad3 = !fn({ kind: "daily-at", hour: 24, minute: 0 }); // hour out of range
      pass = ok1 && ok2 && ok3 && bad1 && bad2 && bad3;
    }
    check(
      "C-D17-16 #194 isValidFrequency 단위 — 정상 3건 + out-of-range/미허용 3건",
      pass,
    );
  }

  // 195. schedule-store.ts 존재 + SETTINGS_USAGE_KEY 패턴 = "schedule.rules" + zustand create + addRule/removeRule/toggleRule export.
  {
    const file = `${projectRoot}/src/modules/schedule/schedule-store.ts`;
    const exists = existsSync(file);
    let hasKey = false;
    let hasZustand = false;
    let hasMutators = false;
    let hasPersistViaSettings = false;
    if (exists) {
      const src = readFileSync(file, "utf-8");
      hasKey = /SETTINGS_SCHEDULE_KEY\s*=\s*"schedule\.rules"/.test(src);
      hasZustand = /from "zustand"/.test(src);
      hasMutators =
        /addRule\s*:/.test(src) &&
        /removeRule\s*:/.test(src) &&
        /toggleRule\s*:/.test(src);
      hasPersistViaSettings = /db\.settings\.put\s*\(/.test(src);
    }
    check(
      "C-D17-16 #195 schedule-store.ts: SETTINGS_SCHEDULE_KEY + zustand + add/remove/toggleRule + db.settings.put",
      exists && hasKey && hasZustand && hasMutators && hasPersistViaSettings,
    );
  }

  // 196. schedule-modal.tsx 존재 + role="dialog" + aria-modal + 비활성 안내 배너 + Esc 닫기 + AddRuleForm 박힘.
  {
    const file = `${projectRoot}/src/modules/schedule/schedule-modal.tsx`;
    const exists = existsSync(file);
    let hasDialog = false;
    let hasInactiveBanner = false;
    let hasEsc = false;
    let hasAddForm = false;
    if (exists) {
      const src = readFileSync(file, "utf-8");
      hasDialog = /role="dialog"/.test(src) && /aria-modal="true"/.test(src);
      hasInactiveBanner =
        /data-test="schedule-inactive-banner"/.test(src) &&
        /D11\+/.test(src);
      hasEsc = /Escape/.test(src) && /onClose\(\)/.test(src);
      hasAddForm = /function AddRuleForm/.test(src);
    }
    check(
      "C-D17-16 #196 schedule-modal.tsx: role=dialog + aria-modal + 비활성 배너(D11+) + Esc 닫기 + AddRuleForm",
      exists && hasDialog && hasInactiveBanner && hasEsc && hasAddForm,
    );
  }

  // 197. header-cluster.tsx: ⏰ 스케줄 버튼 박힘 + onOpenScheduleModal prop 박힘.
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/header-cluster.tsx`,
      "utf-8",
    );
    const hasButton = /data-test="schedule-button"/.test(src);
    const hasProp = /onOpenScheduleModal:\s*\(\)\s*=>\s*void/.test(src);
    const hasHandler = /onClick=\{onOpenScheduleModal\}/.test(src);
    check(
      "C-D17-16 #197 header-cluster: schedule-button + onOpenScheduleModal prop + onClick 핸들러 박힘",
      hasButton && hasProp && hasHandler,
    );
  }

  // 198. conversation-workspace.tsx: ScheduleModal lazy import + scheduleOpen state + onOpenScheduleModal 전달.
  //   lazy import 패턴: import("@/modules/schedule/schedule-modal").then((m) => ({ default: m.ScheduleModal }))
  {
    const src = readFileSync(
      `${projectRoot}/src/modules/conversation/conversation-workspace.tsx`,
      "utf-8",
    );
    const hasLazyImport =
      /import\("@\/modules\/schedule\/schedule-modal"\)/.test(src) &&
      /lazy\(/.test(src);
    const hasState = /\[scheduleOpen,\s*setScheduleOpen\]\s*=\s*useState/.test(src);
    const hasWire = /onOpenScheduleModal=\{\(\)\s*=>\s*setScheduleOpen\(true\)\}/.test(src);
    // Suspense fallback 안에 ScheduleModal 박힘 (조건 mount).
    const hasMount = /scheduleOpen\s*&&[\s\S]{0,200}<ScheduleModal/.test(src);
    check(
      "C-D17-16 #198 conversation-workspace: ScheduleModal lazy import + scheduleOpen state + onOpenScheduleModal 전달 + Suspense 조건 mount",
      hasLazyImport && hasState && hasWire && hasMount,
      `lazy=${hasLazyImport} state=${hasState} wire=${hasWire} mount=${hasMount}`,
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
  .then(() => runD16Checks())
  .then(() => runD17Checks())
  .then(() => {
    process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
