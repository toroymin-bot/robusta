/**
 * persona-edit-modal.tsx — D-13.4 (Day 7, 2026-04-29) 페르소나 편집 모달.
 *
 * 진입점:
 *   - PickerModal "직접 만들기" → 빈 폼 + kind 토글 진입.
 *   - 기존 커스텀 페르소나 편집 (initial prop).
 *   - 프리셋 클릭 후 편집 흐름은 cloneFromPreset 후 customId로 진입 (호출자 책임).
 *
 * 7필드 (명세 §5):
 *   1. kind (radio AI/인간) — initial 있으면 disabled
 *   2. nameKo/nameEn (text, ≤32자, 둘 중 하나 필수)
 *   3. colorToken (swatch picker, 5색 + 인간 2색, kind 별 분기)
 *   4. iconMonogram (text, 1~2자, default = nameKo[0])
 *   5. systemPromptKo/En (textarea, ≤500자, optional)
 *   6. defaultProvider (radio 5종, kind='ai'에서만 노출)
 *
 * 검증:
 *   - 이름 양쪽 빈 값 → 인라인 에러
 *   - 33자 이상 입력 → 자동 절단 + 인라인 경고
 *   - iconMonogram ≥3자 → 첫 2자만 박음
 *
 * 저장: usePersonaStore.upsert → 토스트 'persona.toast.saved' → 닫힘.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { usePersonaStore } from "./persona-store";
import {
  PERSONA_COLOR_TOKENS,
  PERSONA_ICON_MAX,
  PERSONA_NAME_MAX,
  PERSONA_PROMPT_MAX,
  PERSONA_PROVIDERS,
  colorTokenToCssVar,
  type Persona,
  type PersonaColorToken,
  type PersonaKind,
  type PersonaProvider,
} from "./persona-types";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";

interface PersonaEditModalProps {
  /** 신규 추가 시 초기 kind. initial이 있으면 무시됨. */
  initialKind?: PersonaKind;
  /** 편집 모드 — 기존 커스텀 페르소나(isPreset=false) 박음. 프리셋은 cloneFromPreset 후 호출자가 처리. */
  initial?: Persona;
  onClose: () => void;
  /** 저장 후 호출 (옵션) — 부모가 추가된 페르소나로 추가 작업할 수 있게. */
  onSaved?: (persona: Persona) => void;
}

/**
 * kind에 따라 사용 가능한 colorToken 분기.
 * AI는 participant-1~5, human은 participant-human-1/2.
 */
function colorTokensForKind(kind: PersonaKind): readonly PersonaColorToken[] {
  if (kind === "ai") {
    return PERSONA_COLOR_TOKENS.filter(
      (token) =>
        token === "robusta-color-participant-1" ||
        token === "robusta-color-participant-2" ||
        token === "robusta-color-participant-3" ||
        token === "robusta-color-participant-4" ||
        token === "robusta-color-participant-5",
    );
  }
  return PERSONA_COLOR_TOKENS.filter(
    (token) =>
      token === "robusta-color-participant-human-1" ||
      token === "robusta-color-participant-human-2",
  );
}

export function PersonaEditModal({
  initialKind = "ai",
  initial,
  onClose,
  onSaved,
}: PersonaEditModalProps) {
  const upsert = usePersonaStore((s) => s.upsert);
  const pushToast = useToastStore((s) => s.push);

  const [kind, setKind] = useState<PersonaKind>(initial?.kind ?? initialKind);
  const [nameKo, setNameKo] = useState(initial?.nameKo ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [colorToken, setColorToken] = useState<PersonaColorToken>(
    (initial?.colorToken as PersonaColorToken | undefined) ??
      colorTokensForKind(initialKind)[0]!,
  );
  const [iconMonogram, setIconMonogram] = useState(initial?.iconMonogram ?? "");
  const [systemPromptKo, setSystemPromptKo] = useState(
    initial?.systemPromptKo ?? "",
  );
  const [systemPromptEn, setSystemPromptEn] = useState(
    initial?.systemPromptEn ?? "",
  );
  const [defaultProvider, setDefaultProvider] = useState<PersonaProvider>(
    initial?.defaultProvider ?? "anthropic",
  );

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // ESC 닫기 + 첫 input focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    firstInputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // kind 변경 시 colorToken이 새 kind 풀에 없으면 첫 색으로 보정.
  useEffect(() => {
    const allowed = colorTokensForKind(kind);
    if (!allowed.includes(colorToken)) {
      setColorToken(allowed[0]!);
    }
  }, [kind, colorToken]);

  function handleNameKo(v: string) {
    if (v.length > PERSONA_NAME_MAX) {
      setNameKo(v.slice(0, PERSONA_NAME_MAX));
      setWarning(`이름이 ${PERSONA_NAME_MAX}자로 절단되었습니다.`);
    } else {
      setNameKo(v);
      setWarning(null);
    }
  }
  function handleNameEn(v: string) {
    if (v.length > PERSONA_NAME_MAX) {
      setNameEn(v.slice(0, PERSONA_NAME_MAX));
      setWarning(`Name truncated to ${PERSONA_NAME_MAX} chars.`);
    } else {
      setNameEn(v);
      setWarning(null);
    }
  }
  function handleIcon(v: string) {
    setIconMonogram(v.slice(0, PERSONA_ICON_MAX));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimKo = nameKo.trim();
    const trimEn = nameEn.trim();
    if (trimKo.length === 0 && trimEn.length === 0) {
      setError(t("persona.error.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const finalIcon =
        iconMonogram.trim().length > 0
          ? iconMonogram.slice(0, PERSONA_ICON_MAX)
          : (trimKo[0] ?? trimEn[0] ?? "?");
      const saved = await upsert({
        id: initial?.id,
        kind,
        isPreset: false,
        nameKo: trimKo,
        nameEn: trimEn,
        colorToken,
        iconMonogram: finalIcon,
        systemPromptKo: systemPromptKo.slice(0, PERSONA_PROMPT_MAX),
        systemPromptEn: systemPromptEn.slice(0, PERSONA_PROMPT_MAX),
        defaultProvider: kind === "ai" ? defaultProvider : undefined,
      });
      pushToast({
        tone: "info",
        message: t("persona.toast.saved"),
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const allowedColors = colorTokensForKind(kind);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-edit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="
          flex max-h-[90vh] w-full max-w-[560px] flex-col
          overflow-y-auto rounded-lg
          border border-robusta-divider bg-robusta-canvas
          p-6 shadow-xl
        "
      >
        <h2
          id="persona-edit-title"
          className="text-lg font-semibold text-robusta-ink"
        >
          {initial ? "페르소나 편집" : "직접 만들기"}
        </h2>

        {/* kind 토글 — 편집 시 잠금 */}
        <fieldset className="mt-4 text-sm text-robusta-ink">
          <legend className="mb-1">유형</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="ai"
                checked={kind === "ai"}
                disabled={!!initial}
                onChange={() => setKind("ai")}
              />
              {t("persona.picker.toggleAi")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="human"
                checked={kind === "human"}
                disabled={!!initial}
                onChange={() => setKind("human")}
              />
              {t("persona.picker.toggleHuman")}
            </label>
          </div>
        </fieldset>

        {/* 이름 (ko / en) */}
        <label className="mt-4 block text-sm text-robusta-ink">
          이름 (한국어, ≤{PERSONA_NAME_MAX}자)
          <input
            ref={firstInputRef}
            value={nameKo}
            onChange={(e) => handleNameKo(e.target.value)}
            maxLength={PERSONA_NAME_MAX}
            className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
          />
        </label>
        <label className="mt-3 block text-sm text-robusta-ink">
          Name (English, ≤{PERSONA_NAME_MAX} chars)
          <input
            value={nameEn}
            onChange={(e) => handleNameEn(e.target.value)}
            maxLength={PERSONA_NAME_MAX}
            className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
          />
        </label>

        {/* color swatch — kind에 따라 5색 또는 2색 */}
        <fieldset className="mt-4 text-sm text-robusta-ink">
          <legend className="mb-1">색상</legend>
          <div className="flex flex-wrap gap-2">
            {allowedColors.map((token) => {
              const active = token === colorToken;
              return (
                <button
                  key={token}
                  type="button"
                  aria-label={token}
                  aria-pressed={active}
                  onClick={() => setColorToken(token)}
                  className={`h-8 w-8 rounded-full border-2 ${
                    active
                      ? "border-robusta-ink"
                      : "border-transparent hover:border-robusta-divider"
                  }`}
                  style={{ backgroundColor: colorTokenToCssVar(token) }}
                />
              );
            })}
          </div>
        </fieldset>

        {/* icon monogram */}
        <label className="mt-4 block text-sm text-robusta-ink">
          아이콘 (1~{PERSONA_ICON_MAX}자)
          <input
            value={iconMonogram}
            onChange={(e) => handleIcon(e.target.value)}
            maxLength={PERSONA_ICON_MAX}
            placeholder={(nameKo[0] ?? nameEn[0]) ?? ""}
            className="mt-1 w-20 rounded border border-robusta-divider bg-transparent px-3 py-2 text-center text-robusta-ink outline-none focus:border-robusta-accent"
          />
        </label>

        {/* systemPrompt ko / en */}
        <label className="mt-4 block text-sm text-robusta-ink">
          시스템 프롬프트 (한국어, ≤{PERSONA_PROMPT_MAX}자)
          <textarea
            value={systemPromptKo}
            onChange={(e) =>
              setSystemPromptKo(e.target.value.slice(0, PERSONA_PROMPT_MAX))
            }
            rows={3}
            maxLength={PERSONA_PROMPT_MAX}
            className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
            placeholder="비워두면 LLM 기본 인격 사용"
          />
        </label>
        <label className="mt-3 block text-sm text-robusta-ink">
          System prompt (English, ≤{PERSONA_PROMPT_MAX} chars)
          <textarea
            value={systemPromptEn}
            onChange={(e) =>
              setSystemPromptEn(e.target.value.slice(0, PERSONA_PROMPT_MAX))
            }
            rows={3}
            maxLength={PERSONA_PROMPT_MAX}
            className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
            placeholder="empty → LLM default persona"
          />
        </label>

        {/* defaultProvider — AI일 때만 */}
        {kind === "ai" && (
          <fieldset className="mt-4 text-sm text-robusta-ink">
            <legend className="mb-1">기본 프로바이더</legend>
            <div className="flex flex-wrap gap-3">
              {PERSONA_PROVIDERS.map((p) => (
                <label key={p} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={defaultProvider === p}
                    onChange={() => setDefaultProvider(p)}
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {warning && (
          <p className="mt-3 text-xs text-robusta-inkDim" role="status">
            {warning}
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
            className="rounded border border-robusta-divider px-3 py-2 text-sm text-robusta-ink"
          >
            {t("modal.action.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-robusta-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            {saving ? "…" : t("modal.action.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
