"use client";

/**
 * manual-run-button.tsx
 *   - C-D39-1 (D-4 23시 슬롯, 2026-05-04) — Tori spec C-D39-1 (V-D39-1 (c) + D-D39-2 (b)).
 *
 * Why: 각 schedule rule 옆에 "지금" 수동 발동 + "5분 후" 큐 버튼.
 *   - cron 자동 트리거와 병행 (manual-run.ts dedup 1초로 충돌 회피).
 *   - 잡스 단순함: 단일 dropdown — Secondary border outline (cron 자동이 Primary).
 *
 * 자율 정정 (D-39-자-1): 명세 src/modules/schedule/schedule-card.tsx 미존재 →
 *   실 SoT = src/modules/schedule/schedule-modal.tsx 의 rule li.
 *   본 컴포넌트는 위치 독립 — props 만 받음 (D-37 학습 패턴 정합).
 *
 * 디자인 토큰 (D-D39-2 (b) 정확 일치): border border-stone-300 dark:border-stone-700
 *   text-stone-700 dark:text-stone-300 px-2 py-1 text-xs rounded
 *   hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors
 *
 * 엣지:
 *   - BYOK 키 없음 → toast warning + button 자체는 활성 (사용자 의도 명확화)
 *   - 5분 큐 중복 클릭 → 첫 큐 cancel + 새 큐 등록 (clearTimeout)
 *   - 페이지 unmount → useEffect cleanup 으로 clearTimeout (큐 손실 의도)
 *   - 다크모드 자동 (`dark:` variant)
 *
 * 보존 13 영향: 0 — 신규 컴포넌트, schedule-modal.tsx 1줄 마운트만.
 */

import { useEffect, useRef, useState } from "react";
import { useToastStore } from "@/modules/ui/toast";
import {
  manualFire,
  scheduleManualFire5min,
  type ManualFireResult,
} from "./manual-run";

interface ManualRunButtonProps {
  scheduleId: string;
}

type RunState = "idle" | "running" | "queued";

export function ManualRunButton({ scheduleId }: ManualRunButtonProps) {
  const [state, setState] = useState<RunState>("idle");
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const pushToast = useToastStore((s) => s.push);

  // unmount 시 5분 큐 cancel — 손실 의도 (닫힌 탭에서 fire 금지).
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  function handleResult(result: ManualFireResult, source: "now" | "5min") {
    if (!result.ok) {
      if (result.reason === "no-byok-key") {
        pushToast({ tone: "warning", message: "BYOK 키 입력 필요" });
      } else if (result.reason === "dedup-skip") {
        // 1초 내 중복 호출 — silent (사용자 인지 불요)
      }
      setState("idle");
      return;
    }
    if (source === "now") {
      pushToast({ tone: "info", message: "스케줄 즉시 실행됨" });
    } else {
      pushToast({ tone: "info", message: "5분 후 실행 예약됨" });
    }
    setState("idle");
  }

  function runNow() {
    setOpen(false);
    setState("running");
    const result = manualFire(scheduleId, "manual_now");
    handleResult(result, "now");
  }

  function queue5min() {
    setOpen(false);
    // 기존 큐 cancel 후 새 큐 등록.
    cancelRef.current?.();
    setState("queued");
    const handle = scheduleManualFire5min(scheduleId, (r) => {
      cancelRef.current = null;
      handleResult(r, "5min");
    });
    cancelRef.current = handle.cancel;
  }

  return (
    <span
      className="relative inline-block"
      data-test={`schedule-manual-run-${scheduleId}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="수동 실행 메뉴"
        aria-expanded={open}
        data-test={`schedule-manual-run-trigger-${scheduleId}`}
        className="border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 px-2 py-1 text-xs rounded hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
      >
        {state === "queued" ? "5분 후 예약됨" : state === "running" ? "실행 중…" : "수동 실행 ▾"}
      </button>
      {open && (
        <div
          role="menu"
          data-test={`schedule-manual-run-menu-${scheduleId}`}
          className="absolute right-0 top-full mt-1 z-10 flex flex-col rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow"
        >
          <button
            type="button"
            role="menuitem"
            onClick={runNow}
            data-test={`schedule-manual-run-now-${scheduleId}`}
            className="px-3 py-1 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left"
          >
            지금 실행
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={queue5min}
            data-test={`schedule-manual-run-5min-${scheduleId}`}
            className="px-3 py-1 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left"
          >
            5분 후 실행
          </button>
        </div>
      )}
    </span>
  );
}
