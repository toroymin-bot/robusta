"use client";

/**
 * persona-stats.ts
 *   - C-D37-2 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-2 (V-D37-1 / D-D37 4-funnel KPI).
 *
 * Why: persona_used funnel 페이로드 확장 — 어떤 페르소나가 가장 자주 사용되는지 + 처음/마지막 사용 시각.
 *
 * 정책:
 *   - 자율 정정 D-37-자-3: 명세 src/lib/persona-stats.ts → src/modules/personas/persona-stats.ts (모듈 그룹 정합).
 *   - PII 0: personaId + 숫자(messageCount/firstUsedAt/lastUsedAt) 만 IndexedDB 저장.
 *   - 외부 dep 0 (BYOK 정합).
 *   - 다중 탭 race 안전: rw 트랜잭션 read-modify-write 원자.
 *   - in-memory fallback: IndexedDB 미지원 (Safari private mode 등) → Map 으로 1회용 카운트.
 */

import type { PersonaStatRow } from "@/modules/storage/db";

// in-memory fallback (IndexedDB 차단 시).
const memoryStats = new Map<string, PersonaStatRow>();

/**
 * bumpPersonaStat — 페르소나 사용 카운트 +1 + lastUsedAt 갱신.
 *   신규 페르소나: { messageCount: 1, firstUsedAt: now, lastUsedAt: now } 등록.
 *   기존: messageCount += 1, firstUsedAt 보존, lastUsedAt = now.
 *   엣지:
 *     (1) 빈 personaId → no-op + warn (호출자가 fallback 처리).
 *     (2) IndexedDB 미지원 → in-memory fallback.
 *     (3) 트랜잭션 실패 → in-memory fallback (silent).
 */
export async function bumpPersonaStat(
  personaId: string,
  now: number = Date.now(),
): Promise<{ messageCount: number; firstUsedAt: number; lastUsedAt: number }> {
  if (personaId.length === 0) {
    // 호출자가 검증하지만 안전망.
    console.warn("[persona-stats] bumpPersonaStat: empty personaId");
    return { messageCount: 0, firstUsedAt: now, lastUsedAt: now };
  }

  // SSR / Node — in-memory only.
  if (typeof window === "undefined") {
    return bumpInMemory(personaId, now);
  }

  try {
    const { getDb } = await import("@/modules/storage/db");
    const db = getDb();
    // rw 트랜잭션 — read-modify-write 원자 (다중 탭 race 안전).
    const result = await db.transaction("rw", db.personaStats, async () => {
      const existing = await db.personaStats.get(personaId);
      if (existing) {
        const updated: PersonaStatRow = {
          personaId,
          messageCount: existing.messageCount + 1,
          firstUsedAt: existing.firstUsedAt, // 보존
          lastUsedAt: now,
        };
        await db.personaStats.put(updated);
        return updated;
      }
      const created: PersonaStatRow = {
        personaId,
        messageCount: 1,
        firstUsedAt: now,
        lastUsedAt: now,
      };
      await db.personaStats.put(created);
      return created;
    });
    return {
      messageCount: result.messageCount,
      firstUsedAt: result.firstUsedAt,
      lastUsedAt: result.lastUsedAt,
    };
  } catch (err) {
    // IndexedDB 차단 (Safari private 등) → in-memory fallback.
    console.warn("[persona-stats] IndexedDB failed, using memory fallback", err);
    return bumpInMemory(personaId, now);
  }
}

function bumpInMemory(
  personaId: string,
  now: number,
): { messageCount: number; firstUsedAt: number; lastUsedAt: number } {
  const existing = memoryStats.get(personaId);
  if (existing) {
    const updated: PersonaStatRow = {
      personaId,
      messageCount: existing.messageCount + 1,
      firstUsedAt: existing.firstUsedAt,
      lastUsedAt: now,
    };
    memoryStats.set(personaId, updated);
    return {
      messageCount: updated.messageCount,
      firstUsedAt: updated.firstUsedAt,
      lastUsedAt: updated.lastUsedAt,
    };
  }
  const created: PersonaStatRow = {
    personaId,
    messageCount: 1,
    firstUsedAt: now,
    lastUsedAt: now,
  };
  memoryStats.set(personaId, created);
  return {
    messageCount: created.messageCount,
    firstUsedAt: created.firstUsedAt,
    lastUsedAt: created.lastUsedAt,
  };
}

/**
 * 테스트/디버그 용 — in-memory fallback 리셋.
 */
export function __resetPersonaStatsMemory(): void {
  memoryStats.clear();
}
