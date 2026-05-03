/**
 * api-keys/key-validate.ts
 *   C-D35-5 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-5 / F-D35-4.
 *
 * Why: BYOK 키 입력 후 800ms 디바운스 ping — 자동 검증.
 *   기존 api-key-ping.ts(저장 직전 1회) 와 분리 — 본 함수는 입력 중 inline 검증용.
 *   Anthropic /v1/models GET 호출 (인증 only — 비용 0).
 *
 * 정책 (D-35-자-5):
 *   - apiKey 길이 < 10 → skip ('invalid' 반환)
 *   - prefix 'sk-ant-' 미시작 → 즉시 invalid (네트워크 절약)
 *   - HTTP 200 → ok:true
 *   - HTTP 401·403 → invalid
 *   - HTTP 429 → rate_limit
 *   - 기타 (네트워크/timeout) → network
 *   - AbortSignal 발동 시 throw DOMException (호출자가 catch swallow)
 */

const ANTHROPIC_PREFIX = "sk-ant-";
const MIN_KEY_LENGTH = 10;
const VALIDATE_ENDPOINT = "https://api.anthropic.com/v1/models";

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "network" | "rate_limit" };

/**
 * Anthropic 키 검증 — /v1/models GET (인증 only, 무료).
 *   본 함수는 fetch 만 — 호출자가 디바운스 / AbortController 책임.
 */
export async function validateAnthropicKey(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ValidateResult> {
  const key = apiKey.trim();
  if (key.length < MIN_KEY_LENGTH) {
    return { ok: false, reason: "invalid" };
  }
  if (!key.startsWith(ANTHROPIC_PREFIX)) {
    return { ok: false, reason: "invalid" };
  }

  let res: Response;
  try {
    res = await fetch(VALIDATE_ENDPOINT, {
      method: "GET",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return { ok: false, reason: "network" };
  }

  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "invalid" };
  }
  if (res.status === 429) {
    return { ok: false, reason: "rate_limit" };
  }
  return { ok: false, reason: "network" };
}
