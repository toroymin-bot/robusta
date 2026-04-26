"use client";

import { useEffect, useState } from "react";
import { useApiKeyStore } from "@/stores/api-key-store";
import {
  describeValidationReason,
  validateApiKeyFormat,
} from "./api-key-validate";
import { maskApiKey } from "./api-key-mask";
import type { ApiKeyProvider } from "./api-key-types";

interface ApiKeysViewProps {
  onClose: () => void;
}

const PROVIDER_LABEL: Record<ApiKeyProvider, string> = {
  anthropic: "Anthropic",
};

export function ApiKeysView({ onClose }: ApiKeysViewProps) {
  const hydrated = useApiKeyStore((s) => s.hydrated);
  const stored = useApiKeyStore((s) => s.keys.anthropic);
  const save = useApiKeyStore((s) => s.save);
  const remove = useApiKeyStore((s) => s.remove);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = validateApiKeyFormat("anthropic", draft);
    if (!result.ok) {
      setError(describeValidationReason("anthropic", result.reason));
      return;
    }
    setSaving(true);
    try {
      await save("anthropic", draft);
      setDraft("");
      setReveal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await remove("anthropic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  function handleClose() {
    setReveal(false);
    setDraft("");
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-keys-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-robusta-divider bg-robusta-canvas p-6 shadow-xl">
        <h2 id="api-keys-title" className="text-lg font-semibold text-robusta-ink">
          API 키 관리
        </h2>
        <p className="mt-1 text-xs text-robusta-inkDim">
          BYOK · 키는 브라우저(IndexedDB)에만 저장되며 서버로 전송되지 않습니다.
        </p>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-robusta-ink">
            {PROVIDER_LABEL.anthropic}
          </h3>

          {!hydrated ? (
            <p className="mt-3 text-xs text-robusta-inkDim">불러오는 중…</p>
          ) : stored ? (
            <div className="mt-3 flex items-center justify-between rounded border border-robusta-divider px-3 py-2">
              <span className="font-mono text-sm text-robusta-ink">
                {maskApiKey(stored)}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                  aria-label="저장됨"
                >
                  ✓ 저장됨
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-robusta-inkDim underline-offset-2 hover:underline"
                >
                  삭제
                </button>
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-robusta-inkDim">
              아직 저장된 키가 없습니다.
            </p>
          )}

          <form onSubmit={handleSave} className="mt-4 space-y-2">
            <label className="block text-xs text-robusta-inkDim">
              {stored ? "키 교체" : "키 입력"}
              <div className="mt-1 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                  }}
                  type={reveal ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!hydrated || saving}
                  placeholder="sk-ant-..."
                  className="flex-1 rounded border border-robusta-divider bg-transparent px-3 py-2 font-mono text-sm text-robusta-ink outline-none focus:border-robusta-accent disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="rounded border border-robusta-divider px-2 text-xs text-robusta-inkDim"
                  aria-pressed={reveal}
                  disabled={!hydrated}
                >
                  {reveal ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!hydrated || saving || draft.trim().length === 0}
                className="rounded bg-robusta-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </form>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-robusta-divider px-3 py-2 text-sm text-robusta-ink"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
