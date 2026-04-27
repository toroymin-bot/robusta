"use client";

import { useEffect, useState } from "react";
import { useApiKeyStore } from "@/stores/api-key-store";
import {
  describeValidationReason,
  validateApiKeyFormat,
} from "./api-key-validate";
import { maskApiKey } from "./api-key-mask";
// D-10.2: BYOK 키 ping 검증 — 저장 직전 1회 호출
import { pingApiKey } from "./api-key-ping";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
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
  // D-10.2: ping 진행 상태 — 버튼 라벨 변경용. saving과 별개로 표시 (ping 중에는 "확인 중…").
  const [pinging, setPinging] = useState(false);
  const pushToast = useToastStore((s) => s.push);

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
    // D-10.2: 저장 직전 1글자 ping 호출. 401/403 → 저장 차단 + 인라인 에러 + 에러 토스트.
    //         그 외(verified/unknown) → 저장 진행 + 결과별 토스트.
    setSaving(true);
    setPinging(true);
    let pingResult;
    try {
      pingResult = await pingApiKey({ provider: "anthropic", key: draft });
    } catch (err) {
      // pingApiKey는 throw하지 않도록 설계되었지만 안전망.
      pingResult = {
        status: "unknown" as const,
        reason: err instanceof Error ? err.message : "ping failed",
      };
    } finally {
      setPinging(false);
    }

    if (pingResult.status === "unauthorized") {
      // 저장 차단 — 인라인 에러 + 에러 토스트 (모달이 열린 상태이므로 action 미부착).
      setSaving(false);
      const reasonSuffix = pingResult.reason ? ` (${pingResult.reason})` : "";
      setError(t("toast.byok.unauthorized") + reasonSuffix);
      pushToast({
        tone: "error",
        message: t("toast.byok.unauthorized"),
      });
      return;
    }

    try {
      await save("anthropic", draft);
      setDraft("");
      setReveal(false);
      // 결과 토스트: verified → info, unknown → warning.
      if (pingResult.status === "verified") {
        pushToast({ tone: "info", message: t("toast.byok.verified") });
      } else {
        pushToast({ tone: "warning", message: t("toast.byok.checkLater") });
      }
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
                {pinging ? "키 확인 중…" : saving ? "저장 중…" : "저장"}
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
