"use client";

/**
 * key-input-modal.tsx
 *   C-D32-4 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-4 (F-D32-4 / B-D31-2 (c)).
 *   BYOK 키 inline modal — 첫 메시지 송신 시점 마찰 최소.
 *
 *   동작:
 *     1) provider 선택 (현재 anthropic 단일)
 *     2) masked input + show/hide 토글 (외부 lucide-react 의존 회피 — 텍스트 토글)
 *     3) 가이드 링크 (Anthropic Console)
 *     4) 저장 → useApiKeyStore.save + pingApiKey 검증
 *     5) ping ok → onSaved 호출 + 자동 close. ping fail → 에러 메시지 + 키는 저장 유지
 *
 *   접근성: Esc 키 + 외부 클릭 → onClose. role="dialog" + aria-modal.
 *   메인 번들 영향: 호출자가 dynamic import 하면 +0. 본 컴포넌트 자체는 standalone.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/modules/i18n/messages";
import { useApiKeyStore } from "@/stores/api-key-store";
import { pingApiKey } from "./api-key-ping";

const ANTHROPIC_CONSOLE_URL = "https://console.anthropic.com/settings/keys";

export interface KeyInputModalProps {
  open: boolean;
  /** 현 phase 는 anthropic 만 — provider union 은 후속 확장 시 갱신. */
  provider: "anthropic";
  onClose: () => void;
  onSaved?: (key: string) => void;
}

export function KeyInputModal({
  open,
  provider,
  onClose,
  onSaved,
}: KeyInputModalProps) {
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // open 변경 시 상태 리셋.
  useEffect(() => {
    if (open) {
      setValue("");
      setShowKey(false);
      setPending(false);
      setError(null);
      // 마운트 후 input 자동 포커스.
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  // Esc → onClose.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !pending;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setPending(true);
    setError(null);
    try {
      // 1) 저장 — 실패해도 onSaved 미호출.
      await useApiKeyStore.getState().save(provider, trimmed);
      // 2) ping 검증.
      const result = await pingApiKey({ provider, key: trimmed });
      if (result.status === "verified") {
        onSaved?.(trimmed);
        onClose();
      } else {
        setError(
          result.reason ?? t("toast.byok.unauthorized"),
        );
      }
    } catch (err) {
      // pingApiKey 자체는 throw 안 함 — store.save 에러만 진입.
      const msg = err instanceof Error ? err.message : "save failed";
      setError(msg);
    } finally {
      setPending(false);
    }
  }, [canSave, provider, trimmed, onSaved, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keymodal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-[#1f1f1f]">
        <h2
          id="keymodal-title"
          className="text-base font-semibold text-robusta-ink"
        >
          {t("keymodal.title")}
        </h2>
        <p className="mt-1 text-xs text-robusta-inkDim">
          {provider}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <input
            ref={inputRef}
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            aria-label={t("keymodal.title")}
            className="flex-1 rounded border border-robusta-divider bg-transparent px-2 py-1.5 font-mono text-sm text-robusta-ink"
            placeholder="sk-ant-..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) {
                e.preventDefault();
                void handleSave();
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            disabled={pending}
            className="rounded border border-robusta-divider px-2 py-1.5 text-xs text-robusta-inkDim hover:text-robusta-ink"
            aria-pressed={showKey}
          >
            {showKey ? t("keymodal.toggle.hide") : t("keymodal.toggle.show")}
          </button>
        </div>

        <a
          href={ANTHROPIC_CONSOLE_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-robusta-accent underline"
        >
          {t("keymodal.guide")}
        </a>

        {error && (
          <p
            role="alert"
            className="mt-3 text-xs text-red-600"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-robusta-divider px-3 py-1.5 text-xs text-robusta-inkDim hover:text-robusta-ink"
          >
            {t("modal.action.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="rounded bg-robusta-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? t("byok.modal.verifying") : t("keymodal.action.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default KeyInputModal;
