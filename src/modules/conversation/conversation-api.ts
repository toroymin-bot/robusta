/**
 * conversation-api.ts — Anthropic Messages API SSE 스트리밍 + history 매핑.
 *
 * D2 PR2: BYOK 키 직접 호출 + SSE 파싱 + abort + 401/429/4xx 토스트.
 * D3 (D-8.3, 2026-04-27): 모델 ID 자동 폴백 추가.
 *   - 1차 4xx + invalid_request_error + /model/i → claude-3-5-sonnet-latest 폴백.
 *   - 폴백 yield {kind:'fallback', from, to} → conversation-view에서 info 토스트.
 *   - 폴백 후도 4xx → 재폴백 X (무한루프 차단).
 *   - 5xx는 폴백 X (D4 자동 재시도 큐).
 */

import { composeSystemPrompt } from "./system-prompt-composer";
import { parseAnthropicStream } from "./stream-parser";
import type { Message, MessageUsage } from "./conversation-types";
import type { Participant } from "@/modules/participants/participant-types";

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
  | { kind: "fallback"; from: string; to: string };

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
 * Anthropic Messages API SSE 호출 + 파싱.
 * D-8.3: 모델 ID 4xx 시 1회 폴백 후 재호출. 폴백 후 4xx도 그대로 에러.
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
  const messages = historyToAnthropicMessages(
    input.history,
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

  let attempts = 0;
  // 무한루프 방지 — 최대 2회 시도 (1차 + 폴백 1회)
  while (attempts < 2) {
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

    // 5) D-8.3 폴백 분기: 1차 4xx + invalid_request + /model/ → 폴백 1회만
    if (attempts === 0) {
      const decision = await shouldFallbackModel(response);
      if (decision.ok && model !== FALLBACK_MODEL) {
        // 폴백 알림 yield → view에서 info 토스트
        yield { kind: "fallback", from: model, to: FALLBACK_MODEL };
        model = FALLBACK_MODEL;
        attempts++;
        continue;
      }
    }

    // 6) 그 외 4xx/5xx 또는 폴백 후 재실패 → 에러로 전파 (재폴백 X)
    const reason = await describeErrorResponse(response);
    yield { kind: "error", reason, status: response.status };
    return;
  }
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
  shouldFallbackModel,
};
