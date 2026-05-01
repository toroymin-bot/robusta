/**
 * api-key-ping.ts — D-10.2 (Day 5, F-D4-1, 2026-04-28) BYOK 키 ping 검증.
 *
 * 사용자가 키를 저장하기 직전에 1글자 user 메시지(max_tokens=1)로 Anthropic Messages API에
 * 검증용 호출을 1회 보내 인증 가능 여부를 확인한다.
 *   - 200 → 'verified' (저장 진행 + ✓ 토스트)
 *   - 401/403 → 'unauthorized' (저장 차단 + 에러 토스트, action: 키 모달 다시 열기)
 *   - 그 외 4xx/5xx/network/timeout → 'unknown' (저장 진행 + 경고 토스트)
 *
 * 비용: max_tokens=1 → ≈$0.000003 미만. AbortController 타임아웃 5초.
 *
 * 명세 §2 §10 — 명세상 위치는 src/modules/security/api-key-store.ts였으나
 * 실제 모듈 구조에 맞춰 src/modules/api-keys/api-key-ping.ts로 정의.
 * 동작은 명세 §2와 동일. (꼬미 자율 §9 — 위치 정정 메모는 Task_2026-04-27 §11에 정의.)
 */

import type { ApiKeyProvider } from "./api-key-types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
/** ping에 사용할 모델 — 가장 저렴한 alias. 향후 provider별 분기 가능. */
const PING_MODEL = "claude-3-5-sonnet-latest";
/** ping timeout — 명세 §2 권장 5초. 꼬미 자율 §9 변경 가능. */
export const PING_TIMEOUT_MS = 5000;

export type ApiKeyPingStatus = "verified" | "unauthorized" | "unknown";

export interface ApiKeyPingResult {
  status: ApiKeyPingStatus;
  httpStatus?: number;
  /** unauthorized 또는 unknown 시 본문 message 첫 100자 (디버깅용). */
  reason?: string;
}

interface PingOptions {
  provider: ApiKeyProvider;
  key: string;
  /** 외부 abort 신호 — 모달 닫힘 시 cancel. timeout과 별개. */
  signal?: AbortSignal;
  /** 테스트용 fetch 주입 — 운영은 globalThis.fetch 사용. */
  fetchImpl?: typeof fetch;
  /** 테스트용 timeout 단축 — 운영은 PING_TIMEOUT_MS 사용. */
  timeoutMs?: number;
}

interface AnthropicErrorBody {
  error?: { type?: string; message?: string };
}

/**
 * BYOK 키 ping. 외부 signal과 내부 timeout signal을 합성하여 둘 중 하나라도 발사되면 abort.
 * 본 함수는 throw 하지 않는다 — 항상 ApiKeyPingResult 반환 (호출자 분기 단순화).
 */
export async function pingApiKey(opts: PingOptions): Promise<ApiKeyPingResult> {
  const trimmed = opts.key.trim();
  if (trimmed.length === 0) {
    return { status: "unauthorized", reason: "empty key" };
  }
  // anthropic 외 provider는 아직 미지원 — 추후 ChatGPT/Gemini/Grok/DeepSeek 추가 시 분기.
  if (opts.provider !== "anthropic") {
    return { status: "unknown", reason: `provider ${opts.provider} ping unsupported` };
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? PING_TIMEOUT_MS;

  // 외부 signal과 내부 timeout signal을 합성.
  // AbortSignal.any가 있으면 사용, 없으면 (구식 환경) timeout만 사용 + 외부 signal 수동 forwarding.
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
  let externalListener: (() => void) | null = null;
  if (opts.signal) {
    if (opts.signal.aborted) {
      clearTimeout(timeoutHandle);
      return { status: "unknown", reason: "aborted before ping" };
    }
    externalListener = () => timeoutController.abort();
    opts.signal.addEventListener("abort", externalListener, { once: true });
  }

  try {
    const res = await fetchImpl(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": trimmed,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: PING_MODEL,
        max_tokens: 1,
        // stream: false — ping은 응답 본문 필요 없음, status만 본다.
        messages: [{ role: "user", content: "." }],
      }),
      signal: timeoutController.signal,
    });

    if (res.status === 200) {
      // 본문은 즉시 폐기 (stream 미사용이므로 GC가 회수).
      return { status: "verified", httpStatus: 200 };
    }
    if (res.status === 401 || res.status === 403) {
      const reason = await extractErrorMessage(res);
      return { status: "unauthorized", httpStatus: res.status, reason };
    }
    // 그 외 4xx/5xx — 저장은 진행, 경고만 표시 (명세 §2 5번)
    const reason = await extractErrorMessage(res);
    return { status: "unknown", httpStatus: res.status, reason };
  } catch (err) {
    // AbortError(timeout 또는 외부 cancel), network failure 등 — 저장 진행, 경고
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (name === "AbortError") {
      // 외부 cancel과 timeout 구분 — 외부 signal이 abort 상태면 외부 cancel.
      if (opts.signal?.aborted) {
        return { status: "unknown", reason: "cancelled" };
      }
      return { status: "unknown", reason: `timeout after ${timeoutMs}ms` };
    }
    return { status: "unknown", reason: msg.slice(0, 100) };
  } finally {
    clearTimeout(timeoutHandle);
    if (opts.signal && externalListener) {
      opts.signal.removeEventListener("abort", externalListener);
    }
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as AnthropicErrorBody;
    const msg = body.error?.message;
    if (typeof msg === "string" && msg.length > 0) {
      return msg.slice(0, 100);
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`;
}

export const __api_key_ping_internal = {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  PING_MODEL,
  PING_TIMEOUT_MS,
};
