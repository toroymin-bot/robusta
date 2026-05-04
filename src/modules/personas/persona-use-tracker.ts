"use client";

/**
 * persona-use-tracker.ts
 *   C-D36-3 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-3 (F-D36-3 / B-D35-5).
 *   C-D37-2 (D-4 15시 슬롯, 2026-05-04) — 페이로드 확장 (V-D37-1).
 *
 * Why: 4-funnel KPI 정합 — persona_used funnel 단일 위치 추적.
 *   activePersonaId 변경 감지 시 1회 bumpPersonaStat → logFunnelEvent('persona_used', { ...확장 페이로드 }).
 *
 * 동작:
 *   - usePersonaUseTracker(personaId) — null 시 no-op. 동일 ID 재진입 시 무시 (마지막 로그 ID 비교).
 *   - bumpPersonaStat 결과로 messageCount / firstUsedAt / lastUsedAt 페이로드 채움 (C-D37-2).
 *   - logFunnelEvent dynamic import — 메인 번들 +0.
 *   - 보존 13 정합: hook 별도 파일 + workspace 안 1줄 import + 1줄 hook call (useEffect 신규 0).
 *
 * 페이로드 (확장):
 *   { type: 'persona_used', personaId, messageCount, firstUsedAt, lastUsedAt, timestamp }
 *   PII 0 정책: personaId 외 숫자만 (이름/프롬프트/메시지 본문 미전송).
 */

import { useEffect, useRef } from "react";

export function usePersonaUseTracker(personaId: string | null): void {
  const lastLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!personaId) return;
    if (lastLoggedRef.current === personaId) return;
    lastLoggedRef.current = personaId;
    void (async () => {
      const now = Date.now();
      // C-D37-2: bumpPersonaStat 으로 누적 + 페이로드 확장.
      const { bumpPersonaStat } = await import("./persona-stats");
      const stat = await bumpPersonaStat(personaId, now);
      const { logFunnelEvent } = await import("@/modules/funnel/funnel-events");
      logFunnelEvent({
        type: "persona_used",
        personaId,
        messageCount: stat.messageCount,
        firstUsedAt: stat.firstUsedAt,
        lastUsedAt: stat.lastUsedAt,
        timestamp: now,
      });
    })();
  }, [personaId]);
}
