/**
 * api-keys-view.tsx — BYOK 모달.
 *
 * D-10.2 (Day 5): 저장 직전 ping 검증 (verified/unauthorized/unknown).
 * D-11.3 (Day 6, 2026-04-28): 모든 키 0건일 때 인라인 키 발급 가이드(panel-info) 노출.
 *   링크: https://console.anthropic.com/settings/keys (target=_blank rel=noopener noreferrer).
 *   외부 링크 클릭해도 모달 유지 (사용자가 키 받아와서 박을 수 있도록).
 * D-11.4 (Day 6): 4상태 마이크로 인터랙션 (verifying/verified/unauthorized/unknown).
 *   - prefers-reduced-motion 가드는 animations.css에서.
 *   - 같은 키 다시 ping 시 새 ref key로 React가 unmount/mount → 펄스 cleanup.
 *   - 흔들림 진행 중 키 수정 → 즉시 idle 전환 (보더 회색).
 * D-12.2 (Day 6): 모달 진입 시 저장된 키의 lastUnauthorizedAt 24h 이내 → ⚠ 배지 + 토스트(maybeExpired).
 *   토스트 액션 'recheck' → recheckKey 재호출 + 결과 반영.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useApiKeyStore } from "@/stores/api-key-store";
import {
  describeValidationReason,
  validateApiKeyFormat,
} from "./api-key-validate";
import { maskApiKey } from "./api-key-mask";
// D-10.2: BYOK 키 ping 검증 — 저장 직전 1회 호출
import { pingApiKey } from "./api-key-ping";
// D-12.2: 키 메타 — 만료 자동 감지 + recheck
import {
  getKeyMeta,
  isMaybeExpired,
  markUnauthorized,
  markVerified,
  recheckKey,
} from "./api-key-meta";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
import type { ApiKeyProvider } from "./api-key-types";

interface ApiKeysViewProps {
  onClose: () => void;
}

const PROVIDER_LABEL: Record<ApiKeyProvider, string> = {
  anthropic: "Anthropic",
};

const ANTHROPIC_CONSOLE_URL = "https://console.anthropic.com/settings/keys";

// D-11.4 인터랙션 상태. 'idle'은 입력 박기 전 또는 키 수정 직후.
type PingState = "idle" | "verifying" | "verified" | "unauthorized" | "unknown";

// 보더 색 매핑 — Tailwind 색 클래스 + Robusta 토큰.
const BORDER_BY_STATE: Record<PingState, string> = {
  idle: "border-robusta-divider",
  verifying: "border-robusta-divider",
  verified: "border-emerald-500",
  unauthorized: "border-red-500",
  unknown: "border-amber-500",
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
  // D-11.4 4 상태 머신.
  const [pingState, setPingState] = useState<PingState>("idle");
  // 펄스/흔들림 ref-key — 같은 결과가 반복되면 새 키로 재마운트해서 애니메이션 다시 트리거.
  const [animKey, setAnimKey] = useState(0);
  // D-12.2 ⚠ 배지 (저장된 키가 24h 이내에 401을 본 적 있음).
  const [maybeExpired, setMaybeExpired] = useState(false);
  const pushToast = useToastStore((s) => s.push);
  // 모달 열림 직후 maybeExpired 토스트는 1회만 (모달 재오픈 시 다시 노출 OK).
  const expiredToastShown = useRef(false);

  // D-12.2: 모달 진입 시 저장된 키의 메타 조회 → 24h 이내 401 → ⚠ + 토스트.
  useEffect(() => {
    if (!hydrated || !stored) {
      setMaybeExpired(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const meta = await getKeyMeta("anthropic", stored);
      if (cancelled) return;
      const expired = isMaybeExpired(meta);
      setMaybeExpired(expired);
      if (expired && !expiredToastShown.current) {
        expiredToastShown.current = true;
        pushToast({
          tone: "warning",
          message: t("toast.byok.maybeExpired"),
          action: {
            label: t("action.recheck"),
            onClick: async () => {
              const result = await recheckKey("anthropic", stored);
              if (result.status === "verified") {
                setMaybeExpired(false);
                pushToast({ tone: "info", message: t("toast.byok.verified") });
              } else if (result.status === "unauthorized") {
                pushToast({
                  tone: "error",
                  message: t("toast.byok.unauthorized"),
                });
              } else {
                pushToast({
                  tone: "warning",
                  message: t("toast.byok.checkLater"),
                });
              }
            },
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, stored, pushToast]);

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
    setPingState("verifying");
    let pingResult;
    try {
      pingResult = await pingApiKey({ provider: "anthropic", key: draft });
    } catch (err) {
      pingResult = {
        status: "unknown" as const,
        reason: err instanceof Error ? err.message : "ping failed",
      };
    }

    if (pingResult.status === "unauthorized") {
      setSaving(false);
      setPingState("unauthorized");
      setAnimKey((k) => k + 1);
      // D-12.2: 저장 차단되어도 401 사실은 메타에 정의 (다음 모달 진입 시 ⚠ 표시).
      void markUnauthorized("anthropic", draft);
      const reasonSuffix = pingResult.reason ? ` (${pingResult.reason})` : "";
      setError(t("byok.modal.unauthorized") + reasonSuffix);
      pushToast({ tone: "error", message: t("toast.byok.unauthorized") });
      return;
    }

    try {
      await save("anthropic", draft);
      // 결과 토스트 + 상태 머신 전이.
      if (pingResult.status === "verified") {
        setPingState("verified");
        setAnimKey((k) => k + 1);
        // D-12.2: 검증 통과 — 메타에 박아 ⚠ 배지 클리어.
        void markVerified("anthropic", draft);
        setMaybeExpired(false);
        pushToast({ tone: "info", message: t("toast.byok.verified") });
      } else {
        setPingState("unknown");
        pushToast({ tone: "warning", message: t("toast.byok.checkLater") });
      }
      setDraft("");
      setReveal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
      setPingState("unknown");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await remove("anthropic");
      setMaybeExpired(false);
      setPingState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  function handleClose() {
    setReveal(false);
    setDraft("");
    setError(null);
    setPingState("idle");
    onClose();
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (error) setError(null);
    // D-11.4: 흔들림/노랑 보더 진행 중 키 수정 → 즉시 idle.
    if (pingState !== "idle" && pingState !== "verifying") {
      setPingState("idle");
    }
  }

  // D-11.3: 키 0건 노출 조건 — hydrated 완료 + stored 없음.
  const showGuide = hydrated && !stored;

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

        {/* D-11.3 인라인 키 발급 가이드 — 키 0건일 때만 노출 */}
        {showGuide && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2 rounded border border-robusta-accent bg-robusta-accent-soft px-3 py-2"
            data-testid="byok-guide-panel"
          >
            <p className="flex-1 min-w-[180px] text-xs text-robusta-ink">
              <span className="font-medium">{t("byok.guide.headline")}</span>
              <span className="ml-1 text-robusta-inkDim">
                {t("byok.guide.body")}
              </span>
            </p>
            <a
              href={ANTHROPIC_CONSOLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-robusta-divider bg-robusta-canvas px-2 py-1 text-xs font-medium text-robusta-ink hover:bg-robusta-accent hover:text-black"
            >
              {t("byok.guide.cta")}
            </a>
          </div>
        )}

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
                {/* D-12.2 ⚠ 배지 — lastUnauthorizedAt 24h 이내 */}
                {maybeExpired ? (
                  <span
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                    aria-label={t("toast.byok.maybeExpired")}
                    title={t("toast.byok.maybeExpired")}
                  >
                    ⚠ {t("action.recheck")}
                  </span>
                ) : (
                  <span
                    className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    aria-label="저장됨"
                  >
                    ✓ 저장됨
                  </span>
                )}
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
              <div
                key={`anim-${animKey}`}
                className={`mt-1 flex gap-2 rounded border bg-transparent px-1 py-1 ${BORDER_BY_STATE[pingState]} ${
                  pingState === "verified" ? "robusta-pulse-check" : ""
                } ${pingState === "unauthorized" ? "robusta-shake" : ""}`}
              >
                <input
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  type={reveal ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!hydrated || saving}
                  placeholder="sk-ant-..."
                  className="flex-1 bg-transparent px-2 py-1 font-mono text-sm text-robusta-ink outline-none disabled:opacity-60"
                />
                {/* D-11.4 verifying spinner — 12px 정사각형 */}
                {pingState === "verifying" && (
                  <span
                    className="robusta-spinner self-center"
                    aria-label={t("byok.modal.verifying")}
                    role="status"
                  />
                )}
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
                disabled={
                  !hydrated ||
                  saving ||
                  pingState === "verifying" ||
                  draft.trim().length === 0
                }
                className="rounded bg-robusta-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                {pingState === "verifying"
                  ? t("byok.modal.verifying")
                  : saving
                    ? "저장 중…"
                    : "저장"}
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

export const __api_keys_view_internal = {
  ANTHROPIC_CONSOLE_URL,
  BORDER_BY_STATE,
};
