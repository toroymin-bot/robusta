/**
 * welcome-card.tsx
 *   - C-D17-18 (Day 5 19시 슬롯, 2026-04-30) — F-21 첫 메시지 환영 카드.
 *     · 참여자 ≥ 1명 + 메시지 0건 시 본문 영역 중앙에 박힘.
 *     · "안녕 로이! 함께 시작할 준비 완료." + 똘이/꼬미 대기 중 안내 + dismiss(X) 버튼.
 *     · dismiss 시 IndexedDB settings.put("welcome.dismissed", "true") 박음 → 영구 mount X.
 *     · OCP: 기존 빈상태 안내(EmptyStateCta) + 본 카드는 동시 mount (안내가 카드 위, 카드가 그 아래).
 *
 * Roy id-15 (초등학생 직관) + id-19 (모바일 가독성) 정합 — 본 카드는 max-w-md + 중앙 정렬 + 44px tap target.
 */

"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/modules/storage/db";

const SETTINGS_DISMISSED_KEY = "welcome.dismissed";

interface WelcomeCardProps {
  onStart?: () => void;
}

export function WelcomeCard({ onStart }: WelcomeCardProps) {
  // dismissed 상태: undefined=loading / true=박지 않음 / false=마운트.
  //   IndexedDB 차단 환경에선 false로 마운트(silent fallback) — 가시 노이즈는 dismiss 1회로 해결 가능.
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = getDb();
        const row = await db.settings.get(SETTINGS_DISMISSED_KEY);
        if (!alive) return;
        setDismissed(row?.value === "true");
      } catch {
        // IndexedDB 차단 — 마운트.
        if (alive) setDismissed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleDismiss() {
    setDismissed(true);
    try {
      const db = getDb();
      await db.settings.put({
        key: SETTINGS_DISMISSED_KEY,
        value: "true",
        updatedAt: Date.now(),
      });
    } catch {
      // IndexedDB 차단 — 다음 부트엔 다시 표시되지만 silent.
    }
  }

  if (dismissed === undefined) return null;
  if (dismissed) return null;

  return (
    <section
      role="region"
      aria-labelledby="welcome-title"
      data-test="welcome-card"
      className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-robusta-divider bg-robusta-canvas px-5 py-4 text-left shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <h2
          id="welcome-title"
          className="text-base font-semibold text-robusta-ink"
        >
          <span aria-hidden className="mr-2 text-robusta-accent">•</span>
          안녕 로이! 함께 시작할 준비 완료.
        </h2>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          aria-label="환영 카드 닫기"
          data-test="welcome-card-dismiss"
          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded text-robusta-inkDim hover:text-robusta-ink"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </header>
      <p className="text-sm text-robusta-inkDim">
        똘이(Web Claude) + 꼬미(Code Claude) 둘 다 대기 중. 아무 메시지나 보내봐 —
        자동으로 답할 사람이 정해져.
      </p>
      {onStart && (
        <button
          type="button"
          onClick={onStart}
          className="self-start rounded border border-robusta-accent px-3 py-1 text-xs font-medium text-robusta-ink hover:bg-robusta-accent/10"
        >
          시작하기
        </button>
      )}
    </section>
  );
}

export const __welcome_internal = { SETTINGS_DISMISSED_KEY };
