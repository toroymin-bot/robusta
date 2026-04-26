import type {
  ApiKeyProvider,
  ApiKeyValidationResult,
} from "./api-key-types";

const ANTHROPIC_PREFIX = "sk-ant-";
const ANTHROPIC_MIN_LENGTH = 50;

export function validateApiKeyFormat(
  provider: ApiKeyProvider,
  key: string,
): ApiKeyValidationResult {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (provider === "anthropic") {
    if (!trimmed.startsWith(ANTHROPIC_PREFIX)) {
      return { ok: false, reason: "wrong-prefix" };
    }
    if (trimmed.length < ANTHROPIC_MIN_LENGTH) {
      return { ok: false, reason: "too-short" };
    }
  }
  return { ok: true };
}

export function describeValidationReason(
  provider: ApiKeyProvider,
  reason: Exclude<ApiKeyValidationResult, { ok: true }>["reason"],
): string {
  if (reason === "empty") return "키를 입력하세요.";
  if (provider === "anthropic") {
    if (reason === "wrong-prefix") return "Anthropic 키는 sk-ant- 으로 시작합니다.";
    if (reason === "too-short") return "키 길이가 너무 짧습니다.";
  }
  return "키 형식이 올바르지 않습니다.";
}
