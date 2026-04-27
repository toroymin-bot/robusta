/**
 * api-key-meta.ts — D-12.2 (Day 6, 2026-04-28) BYOK 키 만료 자동 감지.
 *
 * conversation-api streamMessage 첫 401 → markUnauthorized (lastUnauthorizedAt 박음).
 * BYOK 모달이 열릴 때 키 카드: lastUnauthorizedAt 24h 이내 → ⚠ 배지 + 토스트 권장.
 * recheckKey → pingApiKey 재호출 → verified 시 lastUnauthorizedAt 클리어 + lastVerifiedAt 갱신.
 *
 * 평문 키는 박지 않고 maskApiKey 결과만 박는다 (보안 — 키 평문이 IndexedDB에 중복 저장 안 됨).
 *
 * IndexedDB 미지원(시크릿 모드) → silent fallback. streaming/error 동작은 유지.
 */

"use client";

import { getDb, type ApiKeyMetaRecord } from "@/modules/storage/db";
import { maskApiKey } from "./api-key-mask";
import { pingApiKey, type ApiKeyPingResult } from "./api-key-ping";
import type { ApiKeyProvider } from "./api-key-types";

/** lastUnauthorizedAt 24시간 윈도우 — 그 이상은 stale 처리. */
export const UNAUTHORIZED_TTL_MS = 24 * 60 * 60 * 1000;

function pk(provider: string, keyMask: string): string {
  return `${provider}::${keyMask}`;
}

/**
 * 401 발생 시 호출 — provider+key를 마스킹하여 meta에 박음.
 * IndexedDB 차단 시 silent (catch).
 */
export async function markUnauthorized(
  provider: ApiKeyProvider,
  rawKey: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const keyMask = maskApiKey(rawKey);
  if (keyMask.length === 0) return;
  try {
    const db = getDb();
    const id = pk(provider, keyMask);
    const existing = await db.apiKeyMeta.get(id);
    const now = Date.now();
    const next: ApiKeyMetaRecord = {
      pk: id,
      provider,
      keyMask,
      lastUnauthorizedAt: now,
      lastVerifiedAt: existing?.lastVerifiedAt,
      updatedAt: now,
    };
    await db.apiKeyMeta.put(next);
  } catch {
    // silent
  }
}

/**
 * verified 시 호출 — lastUnauthorizedAt 클리어 + lastVerifiedAt 갱신.
 */
export async function markVerified(
  provider: ApiKeyProvider,
  rawKey: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const keyMask = maskApiKey(rawKey);
  if (keyMask.length === 0) return;
  try {
    const db = getDb();
    const id = pk(provider, keyMask);
    const now = Date.now();
    const next: ApiKeyMetaRecord = {
      pk: id,
      provider,
      keyMask,
      lastUnauthorizedAt: undefined,
      lastVerifiedAt: now,
      updatedAt: now,
    };
    await db.apiKeyMeta.put(next);
  } catch {
    // silent
  }
}

/**
 * 모달 진입 시 호출 — meta 조회. 없으면 null.
 */
export async function getKeyMeta(
  provider: ApiKeyProvider,
  rawKeyOrMask: string,
): Promise<ApiKeyMetaRecord | null> {
  if (typeof window === "undefined") return null;
  // mask 형태("...") 그대로 들어오면 재마스킹 X.
  const keyMask = rawKeyOrMask.includes("...")
    ? rawKeyOrMask
    : maskApiKey(rawKeyOrMask);
  if (keyMask.length === 0) return null;
  try {
    const db = getDb();
    const found = await db.apiKeyMeta.get(pk(provider, keyMask));
    return found ?? null;
  } catch {
    return null;
  }
}

/**
 * lastUnauthorizedAt이 24h 이내인지 판정.
 */
export function isMaybeExpired(
  meta: ApiKeyMetaRecord | null,
  now: number = Date.now(),
): boolean {
  if (!meta || typeof meta.lastUnauthorizedAt !== "number") return false;
  return now - meta.lastUnauthorizedAt < UNAUTHORIZED_TTL_MS;
}

/**
 * recheck 액션 — pingApiKey 재호출 + 결과별 meta 갱신.
 * verified → markVerified (lastUnauthorizedAt 클리어).
 * unauthorized → markUnauthorized (lastUnauthorizedAt 갱신, 카운트 리셋).
 * unknown → 메타 박지 않음 (현 상태 유지).
 */
export async function recheckKey(
  provider: ApiKeyProvider,
  rawKey: string,
): Promise<ApiKeyPingResult> {
  const result = await pingApiKey({ provider, key: rawKey });
  if (result.status === "verified") {
    await markVerified(provider, rawKey);
  } else if (result.status === "unauthorized") {
    await markUnauthorized(provider, rawKey);
  }
  return result;
}

export const __api_key_meta_internal = {
  pk,
  UNAUTHORIZED_TTL_MS,
};
