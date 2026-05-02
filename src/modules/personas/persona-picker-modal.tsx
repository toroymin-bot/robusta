/**
 * persona-picker-modal.tsx
 *   - D-13.3 (Day 7, 2026-04-29) 페르소나 추가 모달.
 *   - D-14.2 (Day 8, 2026-04-28) limit 시 카드 disabled + 토스트 1회 정의 (꼬미 정정 13.3 + 똘이 보강).
 *     · 닫지 않고 유지 (마찰 ↓).
 *     · 카드: opacity-40 + cursor-not-allowed + aria-disabled='true' + tabIndex=-1.
 *     · 토스트는 picker open 동안 1회만(중복 차단). kind 토글 시 reset.
 *     · 카드 v2: 1행(circle + 이름 + R&R truncate) + 2행(systemPrompt 60자 truncate) — 명세 §5.2.
 *   - D-14.4 (Day 8) data-test='picker-card' 정의 (모바일 320px 회귀 자동화).
 *
 * 진입점: 워크스페이스 [+참여자 추가] 버튼.
 * 구성:
 *   - AI/인간 토글 (default AI)
 *   - 프리셋 카드 (kind=ai → 5개 / kind=human → 1개), 1열(<768px) / 3열(≥768px)
 *   - "직접 만들기" — onCreateCustom 콜백 (부모가 PersonaEditModal 열어줌)
 *
 * 모바일 가드 (Roy `Do` 메모 #9):
 *   - 모달 max-width 640px / max-height 90vh / overflow-y auto
 *   - 카드 내부 텍스트는 truncate + 모노그램 32×32 white-space:nowrap
 *
 * a11y:
 *   - role=dialog + aria-modal=true + 첫 카드 focus
 *   - ESC 닫힘 / 카드 role=button / Enter·Space 처리
 *
 * onPick(presetId) — 카드 클릭 즉시 호출 (확인 모달 X — 잡스식 즉답).
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { useToastStore } from "@/modules/ui/toast";
import { usePersonaStore } from "./persona-store";
import {
  colorTokenToCssVar,
  type Persona,
  type PersonaColorToken,
  type PersonaKind,
} from "./persona-types";
// C-D25-3 (D6 07시 슬롯, 2026-05-02) — KQ_18.2 (b) picker-card 우상단 5베이스 hue dot.
//   기존 colorToken (CSS) 시스템 보존, hue 라벨은 매핑 함수로 합성.
import { PersonaCardColorDot } from "./persona-card-color-dot";
// C-D26-5 (D6 11시 슬롯, 2026-05-02) — 168 회복 분리: theme.ts → theme-hue.ts.
import { personaColorTokenToHue } from "@/modules/ui/theme-hue";
import { t, type MessageKey } from "@/modules/i18n/messages";
// C-D26-4 (D6 11시 슬롯, 2026-05-02) — picker default 탭 'catalog' + custom 탭 분리.
import { PersonaCatalogCard } from "./persona-catalog-card";
import {
  PERSONA_CATALOG_V1,
  type PersonaCatalogEntry,
} from "./persona-catalog";

/** D-14.2 참여자 제한 상수 — participants-panel과 동기화. */
const PARTICIPANT_LIMIT_TOTAL = 4;
const PARTICIPANT_LIMIT_HUMAN = 2;
const PARTICIPANT_LIMIT_AI = 3;

/** D-14.2 카드 disabled 사유 — 어떤 토스트 키를 박을지 결정. */
type LimitReason = "total" | "ai" | "human" | null;

/**
 * D-14.2 카드 disabled 판정.
 *   total ≥4 → 모든 카드 disabled
 *   kind='ai' && ai ≥3 → AI 카드 disabled
 *   kind='human' && human ≥2 → human 카드 disabled
 */
function computeLimitReason(
  cardKind: PersonaKind,
  counts: { total: number; ai: number; human: number },
): LimitReason {
  if (counts.total >= PARTICIPANT_LIMIT_TOTAL) return "total";
  if (cardKind === "ai" && counts.ai >= PARTICIPANT_LIMIT_AI) return "ai";
  if (cardKind === "human" && counts.human >= PARTICIPANT_LIMIT_HUMAN) {
    return "human";
  }
  return null;
}

interface PersonaPickerModalProps {
  /** 카드 클릭 시 호출 — preset id 또는 사용자 커스텀 페르소나 id. */
  onPick: (personaId: string) => void;
  /** "직접 만들기" 클릭 시 호출 — 부모가 PersonaEditModal 열어줌. */
  onCreateCustom: (kind: PersonaKind) => void;
  onClose: () => void;
}

export function PersonaPickerModal({
  onPick,
  onCreateCustom,
  onClose,
}: PersonaPickerModalProps) {
  const personas = usePersonaStore((s) => s.personas);
  const hydrated = usePersonaStore((s) => s.hydrated);
  const hydrate = usePersonaStore((s) => s.hydrate);
  // D-14.2: 참여자 store에서 현재 카운트 도출 (selector — getCounts() 미존재로 직접 계산).
  const participants = useParticipantStore((s) => s.participants);
  const pushToast = useToastStore((s) => s.push);

  const [kind, setKind] = useState<PersonaKind>("ai");
  // C-D26-4 (D6 11시 슬롯, 2026-05-02) — picker default 'catalog' / 'custom' 탭 분리.
  //   'catalog' (default) = PERSONA_CATALOG_V1 5종 catalog 카드 (Spec 004 진입점).
  //   'custom' = 기존 AI/Human 토글 + preset 카드 + "직접 만들기" (호환 보존).
  const [activeTab, setActiveTab] = useState<"catalog" | "custom">("catalog");
  const firstCardRef = useRef<HTMLButtonElement | null>(null);
  // D-14.2: limit 카드 클릭 시 토스트 1회만 노출. picker close 또는 kind 토글 시 reset.
  const toastShownRef = useRef<boolean>(false);

  // hydrate 보장 — 워크스페이스에서 이미 호출했어도 멱등.
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // ESC 닫기 + 첫 카드 focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // toggle 변경 시 첫 카드로 포커스 이동
    firstCardRef.current?.focus();
    // D-14.2: kind 전환 시 토스트 1회 차단 reset (다른 종류 카드는 다시 1회 노출 가능)
    toastShownRef.current = false;
  }, [kind]);

  // 프리셋만 정의 (커스텀은 별도 흐름 — 명세 §4)
  const cards: Persona[] = useMemo(
    () => personas.filter((p) => p.isPreset && p.kind === kind),
    [personas, kind],
  );

  // D-14.2: 현재 참여자 수 (총/AI/인간) 계산 — limit 판정에 사용.
  const counts = useMemo(() => {
    let ai = 0;
    let human = 0;
    for (const p of participants) {
      if (p.kind === "ai") ai += 1;
      else human += 1;
    }
    return { total: participants.length, ai, human };
  }, [participants]);

  // D-14.2: 카드별 limit 사유 (null = 클릭 가능)
  const cardLimitReason: LimitReason = computeLimitReason(kind, counts);

  /** D-14.2: limit 카드 클릭 시 호출 — 1회만 토스트 노출. */
  function handleLimitedClick(reason: LimitReason) {
    if (toastShownRef.current) return;
    if (!reason) return;
    const key: MessageKey =
      reason === "total"
        ? "toast.participant.limit.total"
        : reason === "ai"
          ? "toast.participant.limit.ai"
          : "toast.participant.limit.human";
    pushToast({ tone: "info", message: t(key) });
    toastShownRef.current = true;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="
          flex max-h-[90vh] w-full max-w-[640px] flex-col
          overflow-y-auto rounded-lg
          border border-robusta-divider bg-robusta-canvas
          p-6 shadow-xl
        "
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="persona-picker-title"
            className="text-lg font-semibold text-robusta-ink"
          >
            {t("persona.picker.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.action.cancel")}
            className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
          >
            ×
          </button>
        </div>

        {/* C-D26-4 (D6 11시) — 'catalog' / 'custom' 탭. WAI-ARIA tablist. */}
        <div
          className="mb-3 flex gap-1 rounded border border-robusta-divider p-1"
          role="tablist"
          aria-label="Picker tabs"
          data-test="picker-tab-bar"
        >
          {(["catalog", "custom"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                data-test={`picker-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`
                  flex-1 rounded px-3 py-1.5 text-sm
                  ${
                    active
                      ? "bg-robusta-accent text-black"
                      : "text-robusta-ink hover:bg-robusta-accentSoft/40"
                  }
                `}
              >
                {tab === "catalog"
                  ? t("persona.picker.tab.catalog")
                  : t("persona.picker.tab.custom")}
              </button>
            );
          })}
        </div>

        {/* C-D26-4: catalog 탭 — 5종 PersonaCatalogCard */}
        {activeTab === "catalog" && (
          <div
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            data-test="picker-catalog-grid"
          >
            {PERSONA_CATALOG_V1.map((preset) => (
              <PersonaCatalogCard
                key={preset.id}
                preset={preset}
                onSelect={(p: PersonaCatalogEntry) => onPick(p.id)}
              />
            ))}
          </div>
        )}

        {/* AI/인간 토글 — 'custom' 탭에서만 노출 (호환 보존). */}
        {activeTab === "custom" && (
        <>
        <div
          className="mb-4 flex gap-1 rounded border border-robusta-divider p-1"
          role="tablist"
        >
          {(["ai", "human"] as const).map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setKind(k)}
                className={`
                  flex-1 rounded px-3 py-1.5 text-sm
                  ${
                    active
                      ? "bg-robusta-accent text-black"
                      : "text-robusta-ink hover:bg-robusta-accentSoft/40"
                  }
                `}
              >
                {k === "ai"
                  ? t("persona.picker.toggleAi")
                  : t("persona.picker.toggleHuman")}
              </button>
            );
          })}
        </div>

        {/* D-13.3 / D-14.5 카드 v2: 1행(circle + 이름 + R&R) + 2행(systemPrompt 60자 truncate).
            D-14.2 disabled 비주얼 + 1회 토스트 + D-14.4 data-test='picker-card'. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cards.map((p, idx) => {
            // D-14.2: disabled = cardLimitReason !== null (kind 단위 통일 — total/ai/human 각각).
            const disabled = cardLimitReason !== null;
            // D-14.5 §5.2: 2행 systemPrompt 60자 truncate — locale ko 우선, 없으면 en fallback.
            const promptLine = (p.systemPromptKo || p.systemPromptEn || "").slice(
              0,
              60,
            );
            return (
              <button
                key={p.id}
                ref={idx === 0 ? firstCardRef : undefined}
                type="button"
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled || undefined}
                data-test="picker-card"
                onClick={() => {
                  if (disabled) {
                    handleLimitedClick(cardLimitReason);
                    return;
                  }
                  onPick(p.id);
                }}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(p.id);
                  }
                }}
                className={`
                  relative flex flex-col gap-1
                  overflow-hidden whitespace-nowrap
                  rounded-md border border-robusta-divider
                  bg-robusta-canvas p-3 sm:p-4 text-left
                  ${
                    disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:border-robusta-accent focus:border-robusta-accent focus:outline-none"
                  }
                `}
                style={{
                  borderLeftColor: colorTokenToCssVar(p.colorToken),
                  borderLeftWidth: 4,
                }}
              >
                {/* C-D25-3 (D6 07시) KQ_18.2 (b): 카드 우상단 5베이스 hue dot. C-D24-1 컴포넌트 재사용.
                    colorToken → hue 시드 매핑(personaColorTokenToHue) 으로 합성. */}
                <span
                  aria-hidden={false}
                  className="pointer-events-none absolute right-2 top-2"
                  data-test="picker-card-color-dot"
                >
                  <PersonaCardColorDot
                    hue={personaColorTokenToHue(p.colorToken as PersonaColorToken)}
                    locale="ko"
                    size={12}
                  />
                </span>
                {/* 1행: 모노그램 원 + 이름(ko) + R&R(en) truncate */}
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{
                      backgroundColor: colorTokenToCssVar(p.colorToken),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.iconMonogram}
                  </span>
                  <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-robusta-ink">
                    {p.nameKo || p.nameEn}
                  </span>
                  <span className="block min-w-0 truncate text-xs text-robusta-inkDim">
                    {p.nameEn}
                  </span>
                </span>
                {/* 2행: systemPrompt 60자 truncate. 빈 문자열(human default 등)은 행 자체 숨김. */}
                {promptLine.length > 0 && (
                  <span className="block truncate overflow-hidden whitespace-nowrap text-xs leading-tight text-robusta-inkDim">
                    {promptLine}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 구분선 */}
        <div className="my-4 flex items-center gap-2 text-xs text-robusta-inkDim">
          <span className="flex-1 border-t border-robusta-divider" />
          <span>또는</span>
          <span className="flex-1 border-t border-robusta-divider" />
        </div>

        {/* 직접 만들기 */}
        <button
          type="button"
          onClick={() => onCreateCustom(kind)}
          className="
            w-full rounded
            border border-dashed border-robusta-divider
            px-3 py-2 text-sm text-robusta-ink
            hover:border-robusta-accent hover:text-robusta-accent
            whitespace-nowrap
          "
        >
          {t("persona.picker.customCta")}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
