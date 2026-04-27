"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type ToastTone = "info" | "error";

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  ttlMs: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (input: { tone: ToastTone; message: string; ttlMs?: number }) => string;
  dismiss: (id: string) => void;
}

function nextId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push({ tone, message, ttlMs }) {
    const id = nextId();
    const toast: Toast = { id, tone, message, ttlMs: ttlMs ?? 5000 };
    set({ toasts: [...get().toasts, toast] });
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const handle = setTimeout(() => dismiss(toast.id), toast.ttlMs);
    return () => clearTimeout(handle);
  }, [toast.id, toast.ttlMs, dismiss]);

  const borderColor =
    toast.tone === "error" ? "border-l-red-500" : "border-l-sky-500";
  const role = toast.tone === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`pointer-events-auto max-w-xs rounded border border-robusta-divider border-l-4 ${borderColor} bg-robusta-canvas px-3 py-2 text-sm text-robusta-ink shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="break-words leading-snug">{toast.message}</p>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => dismiss(toast.id)}
          className="text-xs text-robusta-inkDim hover:text-robusta-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed top-16 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
