"use client";

/**
 * persona-stat-lozenge.tsx
 *   - C-D38-4 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-4 (V-D38-3 (a) + D-D38-5 (a)).
 *
 * Why: 카탈로그 페르소나 카드에 messageCount lozenge 가시화.
 *   persona_used 페이로드 확장 (C-D37-2) 후속 — 사용자가 "어떤 페르소나가 가장 자주 쓰이는지"
 *   카드에서 즉시 인지. 신규 사용자(count 0) 는 미노출 (잡음 회피).
 *
 * 정책 (자율 정정 D-38-자-4):
 *   - 명세 위치 "absolute top-1 right-1" → 자율 정정 "absolute bottom-1 right-1".
 *     사유: persona-catalog-card 우상단 (top-2 right-2) 에 이미 PersonaCardColorDot 보존 자산.
 *     보존 13 dot 무손상 + 시각 충돌 회피 — 정보 hierarchy:
 *       좌측 4px stripe (hue) / 우상단 dot (color) / 우하단 lozenge (count).
 *     세 위치 모두 분리 → 충돌 0.
 *   - 외부 dep 0 (Dexie 기존 / Tailwind 기존). 예상 번들 영향 ≈ +0.8 kB (168 103 kB 무영향).
 *   - dangerouslySetInnerHTML 미사용 — React 자체 escape.
 *   - Safari private (IndexedDB 차단) → in-memory fallback (persona-stats.ts 정합).
 *
 * 데이터 소스:
 *   - db.personaStats.get(personaId) → messageCount.
 *   - undefined / 0 → null (lozenge 미노출).
 *   - >9999 → "9k+".
 *   - 그 외 → 숫자 그대로.
 *
 * 디자인 토큰 (D-D38-5 (a) bg-stone-100 + dark variant):
 *   - 컨테이너: absolute bottom-1 right-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 text-xs rounded font-medium.
 *
 * 보존 13 영향: 0 (신규 모듈, persona-catalog-card 1줄 import + 1줄 마운트).
 */

import { useEffect, useState, type JSX } from "react";

interface PersonaStatLozengeProps {
  personaId: string;
}

const MAX_COUNT_DISPLAY = 9999;

export function PersonaStatLozenge({ personaId }: PersonaStatLozengeProps): JSX.Element | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (personaId.length === 0) {
      // 빈 personaId 안전망.
      setCount(null);
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        // SSR 회피: 'use client' + dynamic import (Dexie window 의존).
        const { getDb } = await import("@/modules/storage/db");
        const db = getDb();
        const row = await db.personaStats.get(personaId);
        if (cancelled) return;
        // undefined → null / messageCount === 0 → null (lozenge 미노출).
        if (row === undefined || row.messageCount === 0) {
          setCount(null);
          return;
        }
        setCount(row.messageCount);
      } catch {
        // IndexedDB 차단 (Safari private 등) → null fallback (persona-stats in-memory 와 동일).
        if (!cancelled) setCount(null);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [personaId]);

  // 미노출 분기 — count undefined / 0 / null.
  if (count === null || count === 0) return null;

  // 9k+ 분기.
  const display = count > MAX_COUNT_DISPLAY ? "9k+" : String(count);

  return (
    <span
      data-test="persona-stat-lozenge"
      data-persona-id={personaId}
      data-count={count}
      aria-label={`${count} messages`}
      className="absolute bottom-1 right-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 text-xs rounded font-medium pointer-events-none"
    >
      {display}
    </span>
  );
}

export default PersonaStatLozenge;
