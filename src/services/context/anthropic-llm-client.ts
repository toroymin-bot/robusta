/**
 * anthropic-llm-client.ts
 *   - C-D19-5 (D6 07시 슬롯, 2026-05-01) — 꼬미 §1 ④ 발견사항 흡수.
 *   - C-D18-4 contextWindowGuard 의 LLMClient 인터페이스 실제 구현체.
 *
 * 책임 (Single Responsibility):
 *   - Anthropic Messages API 한정 — summarize 호출 1종.
 *   - BYOK 사용자 키 사용 (서버 키 미사용).
 *
 * 비-책임:
 *   - tiktoken 토큰 카운트 (contextWindowGuard 가 휴리스틱 사용).
 *   - 다중 BYOK (OpenAI/Gemini) — 별도 어댑터 (D20+ 슬롯).
 *
 * 정책 (똘이 §6 C-D19-5):
 *   - 기본 모델 'claude-haiku-4-5-20251001' (저비용 요약).
 *   - 재시도: 5xx/network 만 지수 백오프 (500ms, 1500ms), 4xx 즉시 throw.
 *   - timeout: 15s (AbortController + setTimeout 조합).
 *   - apiKey 누락 시 즉시 throw — fetch 호출 미발생.
 *   - 빈 응답 → throw 'Empty response' (호출자 fallback).
 */

import type { LLMClient, Msg } from "./contextWindowGuard";

export interface AnthropicLLMClientOpts {
  /** BYOK — 사용자 Anthropic 키. 누락 시 즉시 throw. */
  apiKey: string;
  /** 요약 모델 — 기본 저비용 Haiku. */
  model?: string;
  /** Messages API endpoint — 기본 공식 URL. */
  baseUrl?: string;
  /** 5xx/network 재시도 횟수 — 기본 2 (총 3회 시도). */
  maxRetries?: number;
  /** 호출당 timeout(ms) — 기본 15000. */
  timeoutMs?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_BASE_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 15000;
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT =
  "다음 대화를 한국어 5문장 이내 핵심 요약. 발화자 이름과 결정 사항 보존.";

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  error?: { type: string; message: string };
}

/**
 * 메시지 배열을 'role: text' 평문으로 직렬화 — Anthropic API 의 user 프롬프트로 전달.
 */
function serializeMessages(messages: Msg[]): string {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
}

/**
 * 지수 백오프 sleep (회피 가능한 일시 오류 재시도).
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Anthropic Messages API 어댑터 생성.
 * 호출자(예: conversation-api) 가 BYOK 키 주입 → 본 어댑터 1회용 사용.
 */
export function createAnthropicLLMClient(
  opts: AnthropicLLMClientOpts,
): LLMClient {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("AnthropicLLMClient: apiKey required (BYOK)");
  }

  return {
    async summarize(messages: Msg[]): Promise<string> {
      const serialized = serializeMessages(messages);
      const body = JSON.stringify({
        model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: serialized }],
      });

      let lastError: unknown = null;
      const totalAttempts = maxRetries + 1;

      for (let attempt = 0; attempt < totalAttempts; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);

        try {
          const resp = await fetch(baseUrl, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": ANTHROPIC_VERSION,
              "content-type": "application/json",
            },
            body,
            signal: ctrl.signal,
          });
          clearTimeout(timer);

          if (resp.status >= 400 && resp.status < 500) {
            // 4xx — 인증/한도/잘못된 키. 재시도 안 함.
            const text = await resp.text().catch(() => "");
            throw new Error(
              `AnthropicLLMClient: ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ""}`,
            );
          }

          if (resp.status >= 500) {
            // 5xx — 재시도 가능.
            lastError = new Error(
              `AnthropicLLMClient: ${resp.status} server error`,
            );
            if (attempt < totalAttempts - 1) {
              const backoffMs = 500 * Math.pow(3, attempt);
              await sleep(backoffMs);
              continue;
            }
            throw lastError;
          }

          const json = (await resp.json()) as AnthropicResponse;
          if (json.error) {
            throw new Error(
              `AnthropicLLMClient: ${json.error.type} — ${json.error.message}`,
            );
          }
          const first = json.content?.[0];
          if (!first || typeof first.text !== "string" || first.text.length === 0) {
            throw new Error("AnthropicLLMClient: Empty response");
          }
          // stop_reason='max_tokens' 도 부분 요약 그대로 반환 — contextWindowGuard 가 fallback.
          return first.text;
        } catch (err) {
          clearTimeout(timer);
          // AbortError (timeout) 또는 network error → 재시도.
          const isAbort =
            err instanceof DOMException && err.name === "AbortError";
          const isNetwork =
            err instanceof TypeError ||
            (err instanceof Error && err.message.includes("fetch"));
          if ((isAbort || isNetwork) && attempt < totalAttempts - 1) {
            lastError = err;
            const backoffMs = 500 * Math.pow(3, attempt);
            await sleep(backoffMs);
            continue;
          }
          throw err;
        }
      }
      // 도달 불가 (위에서 throw) — 안전망.
      throw lastError ?? new Error("AnthropicLLMClient: unknown failure");
    },
  };
}

// 단위 테스트용 export — production 코드 import 금지.
export const __anthropic_llm_client_internal = {
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  ANTHROPIC_VERSION,
  SYSTEM_PROMPT,
  serializeMessages,
};
