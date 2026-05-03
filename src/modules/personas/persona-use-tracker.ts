"use client";

/**
 * persona-use-tracker.ts
 *   C-D36-3 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-3 (F-D36-3 / B-D35-5).
 *
 * Why: 4-funnel KPI 정합 — persona_used funnel 단일 위치 추적.
 *   activePersonaId 변경 감지 시 1회 logFunnelEvent('persona_used', { personaId }).
 *
 * 동작 (자율 결정 D-36-자-3):
 *   - usePersonaUseTracker(personaId) — null 시 no-op. 동일 ID 재진입 시 무시 (마지막 로그 ID 비교).
 *   - logFunnelEvent dynamic import — 메인 번들 +0.
 *   - 보존 13 정합: hook 별도 파일 + workspace 안 1줄 import + 1줄 hook call (useEffect 신규 0).
 *
 * 페이로드: { personaId } 단일 (PII 0 정책 정합 — 이름/프롬프트 미전송).
 */

import { useEffect, useRef } from "react";

export function usePersonaUseTracker(personaId: string | null): void {
  const lastLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!personaId) return;
    if (lastLoggedRef.current === personaId) return;
    lastLoggedRef.current = personaId;
    void import("@/modules/funnel/funnel-events").then(({ logFunnelEvent }) => {
      logFunnelEvent({
        type: "persona_used",
        personaId,
        timestamp: Date.now(),
      });
    });
  }, [personaId]);
}
