"use client";

/**
 * use-chip-prefill.ts
 *   - C-D43-1 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-1 (F-D43-1, D-42-자-3 후속).
 *
 * Why: keyword chips (C-D42-2) 클릭 → welcome-view 가 sessionStorage('robusta:chip-prefill') 저장
 *   → workspace 진입 시 본 hook 이 1회 read + chat-input value 자동 채움 + focus + 키 1회성 삭제.
 *
 * 자율 정정 D-43-자-1 (꼬미 §8 슬롯):
 *   명세 §4 C-D43-1 chatInputRef 인자는 conversation-workspace.tsx (보존 13 §3.6 신성 모듈) 에 ref 신규
 *   추가 의무 → 보존 위반 위험. 기존 conversation-view.tsx (line 511) querySelector("[data-test='message-input']")
 *   패턴 정합으로 전환 — workspace 무수정 + ref 미주입. hook 시그니처 args 0 으로 단순화.
 *
 * 동작 (mount 1회):
 *   1) SSR 가드 (typeof window).
 *   2) sessionStorage.getItem('robusta:chip-prefill') 1회 read (try/catch silent — Safari Private Mode fallback).
 *   3) chipId 미존재 → 즉시 return (silent fail).
 *   4) chip → prefill 카피 매핑 (i18n 'keyword.chip.<short>.prefill', ko/en parity).
 *   5) querySelector("[data-test='message-input']") 로 chat-input 탐색.
 *      mount 직후 ref 미연결 가능 → requestAnimationFrame 1회 retry 후 silent fail.
 *   6) value 비어있을 때만 prefill (사용자 사전 입력 덮어쓰기 금지).
 *   7) input 'input' 이벤트 dispatch — React controlled input 정합 (textarea value setter prototype 우회).
 *   8) focus().
 *   9) sessionStorage.removeItem (1회성 — 새로고침 시 재실행 0).
 *
 * 외부 dev-deps +0. 보존 13 v3 무손상.
 */

import { useEffect } from "react";
import type { Locale } from "@/modules/i18n/messages";
import { t } from "@/modules/i18n/messages";

const CHIP_PREFILL_KEY = "robusta:chip-prefill";

/**
 * ChipId(풀네임) → i18n short key 매핑.
 *   기존 keyword-chips.tsx (C-D42-2) ChipDef 매핑 정합 (`startup-hypothesis` ↔ `keyword.chip.startup`).
 */
const CHIP_TO_I18N_SHORT: Record<string, string> = {
  "startup-hypothesis": "startup",
  "travel-plan": "travel",
  "code-review": "code",
  "writing-feedback": "writing",
  "free-input": "free",
};

function readPrefillKey(): string | null {
  try {
    // CHIP_PREFILL_KEY 상수와 동일 ('robusta:chip-prefill') — verify-d43 정적 grep 정합 의무.
    return sessionStorage.getItem("robusta:chip-prefill");
  } catch {
    // Safari Private Mode 등 — silent fail (잡스 잡음 0).
    return null;
  }
}

function removePrefillKey(): void {
  try {
    // CHIP_PREFILL_KEY 상수와 동일 ('robusta:chip-prefill') — verify-d43 정적 grep 정합 의무.
    sessionStorage.removeItem("robusta:chip-prefill");
  } catch {
    // silent fail.
  }
}

function setReactInputValue(
  el: HTMLTextAreaElement | HTMLInputElement,
  next: string,
): void {
  // React 19 controlled input 정합:
  //   value setter 직접 호출 시 React 가 변경 감지 못함 → native setter prototype 우회 후 'input' 이벤트 dispatch.
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyPrefill(chipId: string, locale: Locale): boolean {
  const short = CHIP_TO_I18N_SHORT[chipId];
  if (!short) {
    // unknown chipId — 부패 데이터 정리 (true 반환해서 호출자가 키 삭제하도록).
    return true;
  }
  const i18nKey = `keyword.chip.${short}.prefill` as const;
  const prefill = t(i18nKey as never, undefined, locale);

  const el =
    typeof document !== "undefined"
      ? document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          "[data-test='message-input']",
        )
      : null;

  if (!el) {
    // chat-input 미마운트 — retry 책임은 호출자.
    return false;
  }

  // free-input 빈 카피 → focus 만 이동 (value 무수정).
  if (prefill && el.value === "") {
    setReactInputValue(el, prefill);
  }
  el.focus();
  return true;
}

export function useChipPrefill(opts?: {
  locale?: Locale;
  onPrefilled?: (chipId: string) => void;
}): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const chipId = readPrefillKey();
    if (!chipId) return;

    const locale: Locale = opts?.locale ?? "ko";
    const ok = applyPrefill(chipId, locale);
    if (ok) {
      removePrefillKey();
      opts?.onPrefilled?.(chipId);
      return;
    }

    // ref 미연결 — requestAnimationFrame 1회 retry 후 silent fail.
    const raf = requestAnimationFrame(() => {
      const ok2 = applyPrefill(chipId, locale);
      if (ok2) {
        removePrefillKey();
        opts?.onPrefilled?.(chipId);
      }
      // ok2=false 시 chat-input 미마운트 분기 — 키 보존 (다음 진입 시 시도).
    });
    return () => {
      cancelAnimationFrame(raf);
    };
    // 마운트 1회만 실행 — 의존성 빈 배열 의도. opts 변경 무관.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
