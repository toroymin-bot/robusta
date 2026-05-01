/**
 * conversation-api.ts — Anthropic Messages API SSE 스트리밍 + history 매핑.
 *
 * D2 PR2: BYOK 키 직접 호출 + SSE 파싱 + abort + 401/429/4xx 토스트.
 * D3 (D-8.3, 2026-04-27): 모델 ID 자동 폴백 추가.
 *   - 1차 4xx + invalid_request_error + /model/i → claude-3-5-sonnet-latest 폴백.
 *   - 폴백 yield {kind:'fallback', from, to} → conversation-view에서 info 토스트.
 *   - 폴백 후도 4xx → 재폴백 X (무한루프 차단).
 *   - ~~5xx는 폴백 X (D4 자동 재시도 큐).~~
 * D-10.3 (Day 5, 2026-04-28): 5xx 자동 재시도 + retrying yield 추가.
 *   - 5xx 응답 시 500ms × 2^attempt backoff 후 자동 재시도, 최대 3회.
 *   - 매 재시도 직전 yield {kind:'retrying', attempt, status} → view가 progress 표시.
 *   - 3회 모두 실패 시 yield {kind:'error', status:5xx} → view가 토스트 + 재전송 액션.
 *   - 4xx는 자동 재시도 X (D-8.3 폴백 분리 유지).
 *   - AbortController 신호 발사 시 backoff 중에도 즉시 abort yield.
 */

import { composeSystemPrompt } from "./system-prompt-composer";
import { parseAnthropicStream } from "./stream-parser";
import type { Message, MessageUsage } from "./conversation-types";
import type { Participant } from "@/modules/participants/participant-types";
// C-D20-2 (D6 11시 슬롯, 2026-05-01) — 꼬미 §3 권장 ② 흡수.
//   shouldCompact 는 순수 함수(휴리스틱) — 메인 번들 영향 ≪ 1kB. 정적 import.
//   compact + createAnthropicLLMClient 는 dynamic import — 메인 번들 무영향 (별도 chunk).
import { shouldCompact, type Msg } from "@/services/context/contextWindowGuard";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/**
 * 폴백 대상 모델 — Anthropic alias로 항상 latest 안정 모델을 가리킨다.
 * 명세 추정 15: 4xx 미발생 + 미래 deprecation 시 자동 갱신.
 */
const FALLBACK_MODEL = "claude-3-5-sonnet-latest";

export interface StreamMessageInput {
  apiKey: string;
  speaker: Participant; // kind === 'ai' 강제
  participants: Participant[];
  history: Message[]; // createdAt 오름차순
  signal?: AbortSignal;
  maxTokens?: number;
  conversationTitle?: string;
}

export type StreamChunk =
  | { kind: "delta"; text: string }
  | { kind: "usage"; usage: MessageUsage }
  | { kind: "done" }
  | { kind: "aborted" }
  | { kind: "error"; reason: string; status?: number }
  // D-8.3: 모델 ID 폴백 발생 시 view가 info 토스트 띄우도록 알림.
  | { kind: "fallback"; from: string; to: string }
  // D-10.3: 5xx 자동 재시도 직전 알림 (attempt: 1-based, status: 5xx 코드).
  | { kind: "retrying"; attempt: number; status: number }
  // C-D23-2 (D6 23시, 2026-05-01) — F-22 컨텍스트 슬라이서 UI 가시화.
  //   shrunk: 압축 후 메시지 개수 (시스템 + 요약 1건 + KEEP_TAIL 보존), original: 압축 전 개수.
  //   view 가 1줄 info 토스트 — "이전 대화 N건을 요약했어요" — 로 사용자에게 알림.
  | { kind: "compacted"; original: number; shrunk: number };

/** D-10.3: 5xx 백오프 재시도 최대 횟수. 초과 시 error 전파. */
const MAX_SERVER_RETRIES = 3;
/** D-10.3: 5xx 백오프 base — 500ms × 2^attempt (0,1,2 → 500,1000,2000ms). */
const SERVER_RETRY_BASE_MS = 500;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * D2 보유 — speaker 자기 메시지는 'assistant', 외 인간/AI는 'user' + [이름] 접두.
 * error/aborted 메시지는 history에서 제외 (Anthropic 400 회피 안전판 — D2 PR2 추가).
 * 동일 role 연속 발언은 \n\n로 join.
 */
export function historyToAnthropicMessages(
  history: Message[],
  speakerId: string,
  participants: Participant[],
): AnthropicMessage[] {
  const nameById = new Map<string, string>();
  for (const p of participants) nameById.set(p.id, p.name);

  const out: AnthropicMessage[] = [];
  for (const m of history) {
    if (m.status === "error" || m.status === "aborted") continue;
    if (m.content.length === 0) continue;
    const role: AnthropicMessage["role"] =
      m.participantId === speakerId ? "assistant" : "user";
    const speakerName = nameById.get(m.participantId) ?? m.participantId;
    const content = role === "user" ? `[${speakerName}] ${m.content}` : m.content;

    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role, content });
    }
  }

  return out;
}

interface AnthropicErrorBody {
  error?: { type?: string; message?: string };
}

/**
 * D-8.3 핵심: 4xx 응답 본문 파싱 후 모델 ID 폴백 가능 여부 판정.
 * 조건: status === 400 && error.type === 'invalid_request_error' && /model/i.test(message)
 * 본문 파싱 실패 시 false (폴백 X — 그대로 에러 전파).
 */
async function shouldFallbackModel(res: Response): Promise<{
  ok: boolean;
  reason: string;
}> {
  // status 400만 폴백 후보 (401/403/404/429 등은 모델 문제 아님)
  if (res.status !== 400) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  let body: AnthropicErrorBody | null = null;
  try {
    body = (await res.clone().json()) as AnthropicErrorBody;
  } catch {
    body = null;
  }
  const type = body?.error?.type;
  const message = body?.error?.message ?? "";
  // 명세 §4 정확한 가드: invalid_request_error + 메시지에 'model' 단어 포함
  if (type === "invalid_request_error" && /model/i.test(message)) {
    return { ok: true, reason: message || "invalid_request_error: model" };
  }
  return { ok: false, reason: message || `HTTP ${res.status}` };
}

async function describeErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as AnthropicErrorBody;
    if (body.error?.message) return body.error.message;
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`;
}

/**
 * C-D20-2 (D6 11시 슬롯, 2026-05-01) — 컨텍스트 슬라이서 통합 헬퍼.
 *   - history 가 모델 한도의 80% 초과 시 LLM 1회 호출로 압축 1줄 요약 + 마지막 KEEP_TAIL건 보존.
 *   - apiKey 미입력 → 압축 스킵 (원본 반환). compact 자체 실패 → 원본 반환 + 에러 로깅.
 *   - dynamic import → anthropic-llm-client 가 메인 번들 외 chunk 로 분리.
 *
 * (입력) history: Message[], modelMaxTokens: number, apiKey: string
 * (출력) Promise<Message[]> — 압축된 (또는 원본) 메시지 배열
 */
async function maybeCompactHistory(
  history: Message[],
  modelMaxTokens: number,
  apiKey: string,
): Promise<Message[]> {
  // Message → Msg (contextWindowGuard 인터페이스). speaker 매핑은 본 모듈 책임 외 — id 만 보존.
  const msgs: Msg[] = history.map((h) => ({
    id: h.id,
    role: "user", // history 단계에서는 모두 user 로 취급 — 압축 의미상 충분.
    content: h.content,
    createdAt: h.createdAt,
  }));

  if (!shouldCompact(msgs, modelMaxTokens)) return history;
  if (!apiKey) {
    // BYOK 미입력 — 압축 스킵, 원본 반환. (4xx token-limit 발생 시 호출자가 사용자에게 안내)
    return history;
  }

  try {
    const [{ compact }, { createAnthropicLLMClient }] = await Promise.all([
      import("@/services/context/contextWindowGuard"),
      import("@/services/context/anthropic-llm-client"),
    ]);
    const llm = createAnthropicLLMClient({ apiKey });
    const compacted = await compact(msgs, llm);

    // 압축된 Msg → 원본 Message 매핑. 압축 결과는 마지막 KEEP_TAIL건은 원본 그대로 + 요약 1건이 앞.
    // id 매칭으로 원본 Message 복원 — 매칭 실패 (=요약 신규) 시 동기 합성 Message 1건 생성.
    const byId = new Map<string, Message>();
    for (const h of history) byId.set(h.id, h);
    return compacted.map((m): Message => {
      const orig = byId.get(m.id);
      if (orig) return orig;
      // 요약 신규 메시지 — 호출자가 LLM 송신 페이로드로만 사용 (DB 저장 X).
      return {
        id: m.id,
        conversationId: history[0]?.conversationId ?? "",
        participantId: history[0]?.participantId ?? "",
        content: m.content,
        createdAt: m.createdAt,
        status: "done",
      };
    });
  } catch (e) {
    // 압축 실패 — 원본 반환 + 에러 로깅 (서비스 중단 X).
    // eslint-disable-next-line no-console
    console.error("[contextCompact] failed:", e);
    return history;
  }
}

/** Anthropic 모델별 컨텍스트 한도(추정) — 압축 임계치 계산용.
 *  추정: claude-haiku-4-5 = 200k, claude-sonnet-4-6 = 200k, claude-opus-4-7[1m] = 1M.
 *  본 슬롯에서는 보수적으로 200k 기본값 적용 (모델별 분기는 차후 슬롯). */
const DEFAULT_MODEL_CONTEXT_TOKENS = 200_000;

/**
 * Anthropic Messages API SSE 호출 + 파싱.
 * D-8.3: 모델 ID 4xx 시 1회 폴백 후 재호출. 폴백 후 4xx도 그대로 에러.
 * C-D20-2: streamMessage 진입부에서 컨텍스트 한도 80% 초과 시 자동 압축.
 */
export async function* streamMessage(
  input: StreamMessageInput,
): AsyncGenerator<StreamChunk, void, void> {
  // 1) human speaker 차단 (system prompt 의미 없음)
  if (input.speaker.kind !== "ai") {
    throw new Error("streamMessage: speaker must be ai");
  }
  // 2) 시작 직후 abort 체크 — fetch 진입 전에 즉시 종료
  if (input.signal?.aborted) {
    yield { kind: "aborted" };
    return;
  }

  // D-8.3: while 루프 + attempts 가드. 최대 2번 (1차 + 폴백 1회).
  let model = input.speaker.model ?? FALLBACK_MODEL;
  const system = composeSystemPrompt({
    speaker: input.speaker,
    participants: input.participants,
    locale: "ko",
    conversationTitle: input.conversationTitle,
  });
  // C-D20-2: 송신 직전 자동 압축 — apiKey 누락/실패 시 원본 그대로 진행.
  const compactedHistory = await maybeCompactHistory(
    input.history,
    DEFAULT_MODEL_CONTEXT_TOKENS,
    input.apiKey,
  );
  // C-D23-2 (D6 23시) — F-22 가시화: 압축이 실제 발생한 경우 view 에 알림.
  //   maybeCompactHistory 는 압축 미발생/실패 시 원본 reference 를 그대로 반환 → 길이 동일.
  //   압축 성공 시 마지막 KEEP_TAIL건 + 요약 1건 + 시스템(현재 0건) 으로 줄어듦.
  if (compactedHistory.length < input.history.length) {
    yield {
      kind: "compacted",
      original: input.history.length,
      shrunk: compactedHistory.length,
    };
  }
  const messages = historyToAnthropicMessages(
    compactedHistory,
    input.speaker.id,
    input.participants,
  );

  // 3) history 사전 검증
  if (messages.length === 0) {
    yield { kind: "error", reason: "history is empty" };
    return;
  }
  if (messages[messages.length - 1]!.role !== "user") {
    yield { kind: "error", reason: "last message must be user role" };
    return;
  }

  // D-10.3: 폴백/5xx 카운터를 분리하여 가드. 폴백 1회 + 5xx 재시도 3회 = 최대 4 fetch 루프.
  let fallbackUsed = false;
  let serverRetries = 0;
  while (true) {
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": input.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: input.maxTokens ?? 1024,
          stream: true,
          system,
          messages,
        }),
        signal: input.signal,
      });
    } catch (err) {
      // AbortController 신호 시 AbortError swallow (D2 PR2 패턴 유지)
      if (err instanceof Error && err.name === "AbortError") {
        yield { kind: "aborted" };
        return;
      }
      yield {
        kind: "error",
        reason: err instanceof Error ? err.message : "network error",
      };
      return;
    }

    // 4) 성공 응답 — SSE 처리 후 종료
    if (response.ok) {
      if (!response.body) {
        yield { kind: "error", reason: "response body missing" };
        return;
      }
      yield* consumeSse(response.body, input.signal);
      return;
    }

    // 5) D-10.3 5xx 분기: 백오프 후 자동 재시도 (최대 3회)
    if (response.status >= 500 && serverRetries < MAX_SERVER_RETRIES) {
      // 응답 본문은 폐기 (재시도하므로 잡아둘 필요 없음 — GC가 회수).
      const backoff = SERVER_RETRY_BASE_MS * Math.pow(2, serverRetries);
      // attempt는 1-based로 yield (사용자 표시용 — "재시도 1/3").
      yield {
        kind: "retrying",
        attempt: serverRetries + 1,
        status: response.status,
      };
      try {
        await sleepWithAbort(backoff, input.signal);
      } catch {
        // sleepWithAbort는 abort 시 throw — view가 aborted로 분기.
        yield { kind: "aborted" };
        return;
      }
      serverRetries++;
      continue;
    }

    // 6) D-8.3 폴백 분기: 4xx invalid_request + /model/ → 폴백 1회만 (5xx 재시도와 분리)
    if (!fallbackUsed) {
      const decision = await shouldFallbackModel(response);
      if (decision.ok && model !== FALLBACK_MODEL) {
        // 폴백 알림 yield → view에서 info 토스트
        yield { kind: "fallback", from: model, to: FALLBACK_MODEL };
        model = FALLBACK_MODEL;
        fallbackUsed = true;
        continue;
      }
    }

    // 7) 그 외 4xx/5xx (재시도 한도 초과 포함) 또는 폴백 후 재실패 → 에러로 전파
    const reason = await describeErrorResponse(response);
    yield { kind: "error", reason, status: response.status };
    return;
  }
}

/**
 * D-10.3: AbortSignal을 존중하는 sleep — backoff 중에도 사용자 abort 즉시 반응.
 * abort 시 AbortError throw → 호출자가 aborted yield.
 */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const handle = setTimeout(() => {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    let onAbort: (() => void) | null = null;
    if (signal) {
      onAbort = () => {
        clearTimeout(handle);
        reject(new DOMException("aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * SSE 본문 소비 — D2 PR2 보유 로직 그대로, while 루프 분리를 위해 별도 함수로 추출.
 */
async function* consumeSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, void> {
  const usage: MessageUsage = {};
  let usageDirty = false;

  try {
    for await (const evt of parseAnthropicStream(body)) {
      // 매 이벤트마다 abort 체크 — 즉각 중단
      if (signal?.aborted) {
        yield { kind: "aborted" };
        return;
      }
      switch (evt.type) {
        case "message_start": {
          const inTok = evt.usage?.input_tokens;
          if (typeof inTok === "number") {
            usage.inputTokens = inTok;
            usageDirty = true;
          }
          break;
        }
        case "content_block_delta": {
          const delta = evt.delta;
          if (delta && delta.type === "text_delta") {
            const text = (delta as { type: "text_delta"; text: string }).text;
            if (text.length > 0) yield { kind: "delta", text };
          }
          break;
        }
        case "message_delta": {
          const outTok = evt.usage?.output_tokens;
          if (typeof outTok === "number") {
            usage.outputTokens = outTok;
            usageDirty = true;
          }
          break;
        }
        case "message_stop": {
          if (usageDirty) yield { kind: "usage", usage };
          yield { kind: "done" };
          return;
        }
        case "error": {
          yield { kind: "error", reason: evt.error.message };
          return;
        }
        default:
          // ping / content_block_start / content_block_stop → noop
          break;
      }
    }
    if (usageDirty) yield { kind: "usage", usage };
    yield { kind: "done" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      yield { kind: "aborted" };
      return;
    }
    yield {
      kind: "error",
      reason: err instanceof Error ? err.message : "stream error",
    };
  }
}

export const __conversation_api_internal = {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  FALLBACK_MODEL,
  // D-10.3 노출 — self-check가 검증.
  MAX_SERVER_RETRIES,
  SERVER_RETRY_BASE_MS,
  shouldFallbackModel,
  sleepWithAbort,
};
