/**
 * persona-modal.tsx — D-9.2 (Day 4, 2026-04-29) 인격/R&R 설정 모달.
 *
 * 트리거: 참여자 카드 우상단 [⚙] 버튼 클릭 (participants-panel).
 * 필드:
 *   - name: 1~30자, trim, 빈 값 차단 (인간/AI 공통)
 *   - role: 0~40자, trim, 선택 (인간/AI 공통)
 *   - systemPrompt: 0~1500자, AI만 (입력 시점 차단 + 카운터 빨강)
 *   - model: 화이트리스트 select (AI만)
 * 휴먼: model/systemPrompt 미노출 + 'modal.hint.humanOnly' 안내.
 * 저장: useParticipantStore.update (Zustand 즉시 + Dexie persist) → 토스트 + 모달 닫힘.
 * 자율: ESC + overlay 클릭 닫기, focus 첫 input.
 *
 * 명세 §6 카피 i18n('modal.*' / 'toast.persona.*').
 *
 * 추정 17 검증 — 1500자 systemPrompt가 비용/성능 합리적인지는 라이브 verify-d4에서 확정.
 *   현재는 입력 시점에서 1500자 컷 (composer가 8000자에서 다시 컷하므로 안전).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
import {
  ALLOWED_MODELS,
  PARTICIPANT_NAME_MAX,
  PARTICIPANT_NAME_MIN,
  PARTICIPANT_ROLE_MAX,
  PARTICIPANT_SYSTEM_PROMPT_MAX,
  type AllowedModel,
  type Participant,
} from "@/modules/participants/participant-types";

interface PersonaModalProps {
  participant: Participant;
  onClose: () => void;
}

export function PersonaModal({ participant, onClose }: PersonaModalProps) {
  const update = useParticipantStore((s) => s.update);
  const pushToast = useToastStore((s) => s.push);

  const [name, setName] = useState(participant.name);
  const [role, setRole] = useState(participant.role ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    participant.systemPrompt ?? "",
  );
  const [model, setModel] = useState<AllowedModel>(
    (participant.model as AllowedModel) ??
      (ALLOWED_MODELS.includes(participant.model as AllowedModel)
        ? (participant.model as AllowedModel)
        : "claude-sonnet-4-6"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // ESC 닫기 + focus 첫 input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // 토스트 ESC와 충돌 방지: 토스트가 있으면 그쪽이 먼저 처리 (window listener 동시 발화 → 둘 다 dismiss).
        // 모달 닫기는 토스트와 별 충돌 없음 (토스트는 stack 1 dismiss, 모달은 자기 닫힘).
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    firstInputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validate(): string | null {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return t("modal.err.nameEmpty");
    if (
      trimmedName.length < PARTICIPANT_NAME_MIN ||
      trimmedName.length > PARTICIPANT_NAME_MAX
    ) {
      return t("modal.err.nameLength");
    }
    const trimmedRole = role.trim();
    if (trimmedRole.length > PARTICIPANT_ROLE_MAX) {
      return t("modal.err.roleLength");
    }
    if (
      participant.kind === "ai" &&
      systemPrompt.length > PARTICIPANT_SYSTEM_PROMPT_MAX
    ) {
      return t("modal.err.systemPromptLength");
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    try {
      const patch: Partial<Participant> = {
        name: trimmedName,
        role: trimmedRole.length === 0 ? undefined : trimmedRole,
      };
      if (participant.kind === "ai") {
        patch.systemPrompt = systemPrompt; // 빈 문자열은 그대로 ('' = 추가 인격 없음, composer가 분기)
        patch.model = model;
      }
      await update(participant.id, patch);
      pushToast({
        tone: "info",
        message: t("toast.persona.saved", { name: trimmedName }),
      });
      onClose();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  // systemPrompt 카운터 색
  const sysLen = systemPrompt.length;
  const sysOver = sysLen > PARTICIPANT_SYSTEM_PROMPT_MAX;

  const titleKey = participant.kind === "ai" ? "modal.title.ai" : "modal.title.human";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-md
          rounded-lg border border-robusta-divider
          bg-robusta-canvas p-6 shadow-xl
        "
      >
        <h2
          id="persona-modal-title"
          className="text-lg font-semibold text-robusta-ink"
        >
          {t(titleKey)}
        </h2>

        {/* name */}
        <label className="mt-4 block text-sm text-robusta-ink">
          {t("modal.field.name")}
          <input
            ref={firstInputRef}
            value={name}
            onChange={(e) =>
              // input 시점 컷 — 30자 초과 입력 차단 (UX 일관성)
              setName(e.target.value.slice(0, PARTICIPANT_NAME_MAX))
            }
            className="
              mt-1 w-full rounded
              border border-robusta-divider bg-transparent
              px-3 py-2 text-robusta-ink outline-none
              focus:border-robusta-accent
            "
            maxLength={PARTICIPANT_NAME_MAX}
            aria-required="true"
          />
        </label>

        {/* role (선택) */}
        <label className="mt-4 block text-sm text-robusta-ink">
          {t("modal.field.role")}
          <input
            value={role}
            onChange={(e) =>
              setRole(e.target.value.slice(0, PARTICIPANT_ROLE_MAX))
            }
            className="
              mt-1 w-full rounded
              border border-robusta-divider bg-transparent
              px-3 py-2 text-robusta-ink outline-none
              focus:border-robusta-accent
            "
            maxLength={PARTICIPANT_ROLE_MAX}
            placeholder={participant.kind === "ai" ? "예: 기술 디렉터" : "예: 대표"}
          />
        </label>

        {participant.kind === "ai" && (
          <>
            {/* model */}
            <label className="mt-4 block text-sm text-robusta-ink">
              {t("modal.field.model")}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as AllowedModel)}
                className="
                  mt-1 w-full rounded
                  border border-robusta-divider bg-transparent
                  px-3 py-2 text-robusta-ink outline-none
                  focus:border-robusta-accent
                "
              >
                {ALLOWED_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            {/* systemPrompt */}
            <label className="mt-4 block text-sm text-robusta-ink">
              {t("modal.field.systemPrompt")}
              <textarea
                value={systemPrompt}
                onChange={(e) =>
                  // 1500자 초과 입력 시점 차단 (명세 §3 엣지)
                  setSystemPrompt(
                    e.target.value.slice(0, PARTICIPANT_SYSTEM_PROMPT_MAX),
                  )
                }
                rows={6}
                maxLength={PARTICIPANT_SYSTEM_PROMPT_MAX}
                className="
                  mt-1 w-full rounded
                  border border-robusta-divider bg-transparent
                  px-3 py-2 text-robusta-ink outline-none
                  focus:border-robusta-accent
                  resize-y
                "
                placeholder="비워두면 기본 인격을 사용합니다."
              />
              {/* 카운터: 빨강 표시 — 입력 시점 컷이 있어 sysOver는 거의 안 뜨지만 안전장치 */}
              <span
                className={`mt-1 block text-right text-xs ${
                  sysOver ? "text-red-600" : "text-robusta-inkDim"
                }`}
              >
                {sysLen} / {PARTICIPANT_SYSTEM_PROMPT_MAX}
              </span>
            </label>
          </>
        )}

        {participant.kind === "human" && (
          <p className="mt-4 text-xs text-robusta-inkDim">
            {t("modal.hint.humanOnly")}
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="
              rounded border border-robusta-divider
              px-3 py-2 text-sm text-robusta-ink
            "
          >
            {t("modal.action.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="
              rounded bg-robusta-accent
              px-3 py-2 text-sm font-medium text-black
              disabled:opacity-60
            "
          >
            {saving ? "…" : t("modal.action.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
