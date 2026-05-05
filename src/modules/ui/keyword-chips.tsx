"use client";

/**
 * keyword-chips.tsx
 *   - C-D42-2 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42-2 (F-D42-5 빈 페이지 공포 해소).
 *
 * Why: 첫 진입자에게 "어디서부터?" 막막함 해소 — Hero 아래 5 chip 으로 회의 주제 시작.
 *   클릭 시 부모 onSelect 가 chat-input value 자동 채움 + focus.
 *
 * 정책:
 *   - listbox 패턴 (role=listbox + 5 role=option) — WCAG ARIA listbox 정합.
 *   - 마지막 chip (free-input) data-variant="primary" — primary 강조 (직접 입력 우선 노출).
 *   - 키보드: Tab(포커스 이동) + Enter/Space(선택) 정합. 화살표 키는 listbox 권장이나 본 v0 미구현
 *     (단순 chip 행 — 사용자 의도 명확).
 *   - 모바일 wrap 2줄 허용 (flex-wrap).
 *
 * 디자인 토큰:
 *   - container: inline-flex flex-wrap gap-2 (모바일 wrap 정합).
 *   - chip default: bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300
 *                   hover:ring-2 hover:ring-robusta-accent transition focus-visible:ring-2.
 *   - chip primary (free-input): bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200.
 *
 * 보존 13 영향: 0 (신규 모듈, welcome-view.tsx 1줄 마운트).
 *
 * 엣지:
 *   - onSelect 콜백 미주입 가능성 0 (TypeScript required).
 *   - locale 미지정 → ko fallback.
 *   - V-D40-3 페르소나-hue 60 token 충돌 X — 본 chip 은 stone/emerald 기본 토큰만.
 */

import type { JSX, KeyboardEvent } from "react";
import { t } from "@/modules/i18n/messages";
import type { Locale } from "@/modules/i18n/messages";

export type ChipId =
  | "startup-hypothesis"
  | "travel-plan"
  | "code-review"
  | "writing-feedback"
  | "free-input";

export interface KeywordChipsProps {
  onSelect: (chipId: ChipId) => void;
  locale?: Locale;
}

interface ChipDef {
  id: ChipId;
  i18nKey: "keyword.chip.startup" | "keyword.chip.travel" | "keyword.chip.code" | "keyword.chip.writing" | "keyword.chip.free";
  primary: boolean;
}

const CHIPS: readonly ChipDef[] = [
  { id: "startup-hypothesis", i18nKey: "keyword.chip.startup", primary: false },
  { id: "travel-plan", i18nKey: "keyword.chip.travel", primary: false },
  { id: "code-review", i18nKey: "keyword.chip.code", primary: false },
  { id: "writing-feedback", i18nKey: "keyword.chip.writing", primary: false },
  { id: "free-input", i18nKey: "keyword.chip.free", primary: true },
] as const;

export default function KeywordChips(props: KeywordChipsProps): JSX.Element {
  const locale: Locale = props.locale ?? "ko";

  const onKey = (e: KeyboardEvent<HTMLLIElement>, id: ChipId) => {
    // Enter/Space → 선택 (button 패턴 동등).
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onSelect(id);
    }
  };

  return (
    <ul
      data-test="keyword-chips"
      role="listbox"
      aria-label={locale === "en" ? "Suggested topics" : "추천 주제"}
      className="inline-flex flex-wrap gap-2"
    >
      {CHIPS.map((chip) => {
        const label = t(chip.i18nKey, undefined, locale);
        const cls = chip.primary
          ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
          : "bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300";
        return (
          <li
            key={chip.id}
            role="option"
            aria-selected={false}
            tabIndex={0}
            data-chip-id={chip.id}
            data-variant={chip.primary ? "primary" : "default"}
            onClick={() => props.onSelect(chip.id)}
            onKeyDown={(e) => onKey(e, chip.id)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs ${cls} hover:ring-2 hover:ring-robusta-accent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-robusta-accent`}
          >
            {label}
          </li>
        );
      })}
    </ul>
  );
}
