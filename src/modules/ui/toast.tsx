/**
 * toast.tsx — 토스트 시스템.
 *   - D3: ~~기본 v0~~ (info/error 2종, 우상단, 5초 자동 폐기).
 *   - D4 (D-9.7, P0, F-token-5 본체, 2026-04-29): v1 마감.
 *     · variant: 'info' | 'warning' | 'error' 3종 (warning 신규).
 *     · 우하단 fixed, FIFO 최대 3개 (초과 시 oldest 자동 폐기).
 *     · 5초 자동 폐기 + hover-pause + ESC로 가장 최근 폐기.
 *     · 좌측 hue 보더 3px, variant별 색: info #4D89FF / warning #E8A03A / error #D6443A.
 *     · aria-live: info=polite, warning|error=assertive.
 *     · 다크/라이트 색 매핑 명시.
 *     · 기존 호출자(`push({ tone, message })`) 시그니처는 호환 유지 — variant alias 추가.
 */

"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { create } from "zustand";

/** D-9.7: 'tone' = 'info' | 'warning' | 'error'. 'tone'은 기존 호환성 + 'variant' 별칭. */
export type ToastTone = "info" | "warning" | "error";
/** 명세상 alias. 새 호출자에 권장. */
export type ToastVariant = ToastTone;

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  ttlMs: number;
  /** 일시정지 토글 (hover-pause) — push 시점 기준 createdAt + ttlMs 만큼만 유효. */
  createdAt: number;
}

/** D-9.7: FIFO 최대 보유 갯수. 초과 시 oldest 자동 폐기. */
const MAX_TOASTS = 3;

interface ToastStore {
  toasts: Toast[];
  push: (input: { tone: ToastTone; message: string; ttlMs?: number }) => string;
  dismiss: (id: string) => void;
  /** D-9.7: ESC 시 가장 최근(stack 마지막) 토스트 1개 폐기. */
  dismissLatest: () => void;
}

function nextId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push({ tone, message, ttlMs }) {
    const id = nextId();
    const toast: Toast = {
      id,
      tone,
      message,
      ttlMs: ttlMs ?? 5000,
      createdAt: Date.now(),
    };
    const current = get().toasts;
    // FIFO 제한: 3개 초과 시 oldest 자동 폐기
    const next =
      current.length >= MAX_TOASTS
        ? [...current.slice(current.length - MAX_TOASTS + 1), toast]
        : [...current, toast];
    set({ toasts: next });
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  dismissLatest() {
    const list = get().toasts;
    if (list.length === 0) return;
    set({ toasts: list.slice(0, -1) });
  },
}));

/** variant별 hue 보더 색. 명세 §4 표. */
const BORDER_COLOR: Record<ToastTone, string> = {
  info: "#4D89FF",
  warning: "#E8A03A",
  error: "#D6443A",
};

/** aria-live 매핑. info=polite, warning/error=assertive. */
const ARIA_LIVE: Record<ToastTone, "polite" | "assertive"> = {
  info: "polite",
  warning: "assertive",
  error: "assertive",
};

interface ToastItemProps {
  toast: Toast;
}

function ToastItem({ toast }: ToastItemProps) {
  const dismiss = useToastStore((s) => s.dismiss);
  // D-9.7 hover-pause: hover true 동안 setTimeout 보류, leave 시 잔여 시간 만큼 재시작.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    // 잔여 시간 = createdAt + ttlMs - now. 음수면 즉시 폐기.
    const remaining = Math.max(0, toast.createdAt + toast.ttlMs - Date.now());
    const handle = setTimeout(() => dismiss(toast.id), remaining);
    return () => clearTimeout(handle);
  }, [paused, toast.id, toast.createdAt, toast.ttlMs, dismiss]);

  const ariaLive = ARIA_LIVE[toast.tone];
  const borderColor = BORDER_COLOR[toast.tone];

  return (
    <div
      role="status"
      aria-live={ariaLive}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ borderLeftColor: borderColor }}
      className="
        pointer-events-auto
        flex items-start justify-between gap-2
        rounded-xl border border-l-[3px] border-robusta-divider
        bg-robusta-canvas
        px-[14px] py-[10px]
        text-sm leading-snug text-robusta-ink
        shadow-md
      "
    >
      <p className="min-w-0 flex-1 break-words">{toast.message}</p>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => dismiss(toast.id)}
        className="
          shrink-0 rounded
          h-7 w-7 -mr-1
          text-base text-robusta-inkDim
          hover:bg-robusta-divider hover:text-robusta-ink
        "
      >
        ×
      </button>
    </div>
  );
}

/**
 * D-9.7: ToastViewport — portal로 document.body에 박아서 정적 export 호환.
 *   위치: 우하단 fixed, 16px 마진, 세로 stack 8px 간격.
 *   buble width: min(360px, calc(100vw - 32px)) — 모바일 오버플로우 방지(Do 4/27 #9 반응형).
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissLatest = useToastStore((s) => s.dismissLatest);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // D-9.7 ESC: 가장 최근 토스트 1개 폐기 (다른 모달 ESC와 충돌 방지 — capture: false, stopPropagation X).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // 토스트 없으면 무시 (다른 컴포넌트 ESC 처리 우선).
      if (useToastStore.getState().toasts.length === 0) return;
      dismissLatest();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissLatest]);

  if (!mounted || typeof document === "undefined") return null;
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="
        pointer-events-none
        fixed bottom-4 right-4 z-[60]
        flex flex-col gap-2
      "
      style={{ maxWidth: "min(360px, calc(100vw - 32px))" }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}

/** 테스트/self-check용 내부 export. */
export const __toast_internal = { MAX_TOASTS, BORDER_COLOR, ARIA_LIVE };
