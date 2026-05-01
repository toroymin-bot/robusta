/**
 * empty-state-registry.ts
 *   - C-D18-3 (D6 03시 슬롯, 2026-05-01) — 똘이 v1 §1 KQ_13 + §5 명세 채택분.
 *     · 빈 패널 onboarding 카피·CTA 통합 레지스트리.
 *     · 3 key (zeroParticipants / onlyHuman / zeroMessages) × 2 locale (ko/en)
 *       × 2 form (정상/short — 모바일 ≤360px) = 12조합.
 *     · 잡스 원칙: 카피 1줄, CTA 1개, 일러스트 0개.
 *     · CTA intent: 'addParticipant' | 'addAI' | 'focusInput'.
 *     · 모바일 short variant — `white-space: nowrap` + 짧은 fallback 카피.
 *
 * OCP:
 *   - 기존 modules/onboarding/empty-state-cta.tsx 의 sample/byok variant는 별개 — 본 레지스트리는
 *     "참여자/메시지 0건" 빈 패널 전용. variant naming 충돌 없음 (key 명칭 다름).
 *   - 키 추가 시 EmptyKey 유니온 + COPY 테이블만 확장하면 됨 (closed for modification, open for extension).
 *
 * 다국어:
 *   - i18n 통합은 D-9.3 라우팅(P1) 들어오면 modules/i18n/messages.ts 로 마이그레이션.
 *     현재(D6)는 인라인 ko/en 기록하는 게 검증·업데이트 빠름 (KQ_13 카피가 바뀔 가능성 있음).
 */

import { useEffect, useState } from "react";

// CTA가 실행해야 할 의도. UI 측에서 onIntent 핸들러로 매핑.
export type EmptyCtaIntent = "addParticipant" | "addAI" | "focusInput";

// 빈 상태 종류. 컴파일 타임 exhaustiveness 검증 위해 유니온으로 정의.
export type EmptyKey = "zeroParticipants" | "onlyHuman" | "zeroMessages";

export type EmptyLocale = "ko" | "en";

export interface EmptyStateEntry {
  /** 단일 카피 라인 (잡스: 1줄). */
  copy: string;
  /** 모바일 ≤360px 용 짧은 카피 (white-space:nowrap 가능 길이). */
  copyShort: string;
  /** primary CTA 라벨. */
  ctaLabel: string;
  /** CTA 클릭 시 실행할 의도. UI 측 핸들러로 매핑. */
  ctaIntent: EmptyCtaIntent;
}

/**
 * 9조합 카피 — KQ_13 답변표 v1 (§1) 그대로 반영.
 * 카피 변경은 똘이 디자인 결정 → 본 레지스트리 PR로 처리.
 */
const COPY: Record<EmptyKey, Record<EmptyLocale, EmptyStateEntry>> = {
  zeroParticipants: {
    ko: {
      copy: "같이 생각할 사람을 불러오자",
      copyShort: "참여자를 추가하세요",
      ctaLabel: "참여자 추가",
      ctaIntent: "addParticipant",
    },
    en: {
      copy: "Bring someone to think with",
      copyShort: "Add a participant",
      ctaLabel: "Add participant",
      ctaIntent: "addParticipant",
    },
  },
  onlyHuman: {
    ko: {
      copy: "AI 1명을 추가하면 대화가 시작돼요",
      copyShort: "AI를 추가하세요",
      ctaLabel: "AI 추가",
      ctaIntent: "addAI",
    },
    en: {
      copy: "Add 1 AI to start",
      copyShort: "Add an AI",
      ctaLabel: "Add AI",
      ctaIntent: "addAI",
    },
  },
  zeroMessages: {
    ko: {
      copy: "먼저 한마디 던져보자",
      copyShort: "먼저 입력해보세요",
      ctaLabel: "입력하기",
      ctaIntent: "focusInput",
    },
    en: {
      copy: "Drop your first thought",
      copyShort: "Type to start",
      ctaLabel: "Start typing",
      ctaIntent: "focusInput",
    },
  },
};

/**
 * 빈 상태 카피·CTA 조회. key 누락 시 TypeScript 타입 에러로 컴파일 차단.
 *
 * @param key   3종 빈 상태 식별자
 * @param locale ko/en (D6 기준 — D-9.3 라우팅 들어오면 useLocale로 대체)
 * @returns copy/copyShort/ctaLabel/ctaIntent 4-tuple
 */
export function getEmpty(
  key: EmptyKey,
  locale: EmptyLocale,
): EmptyStateEntry {
  const byLocale = COPY[key];
  // EmptyKey 유니온이 컴파일 타임 검증되므로 이 if는 실질 unreachable.
  // 그러나 외부 JS 호출 시 안전망으로 throw.
  if (!byLocale) {
    throw new Error(`empty-state-registry: unknown key '${String(key)}'`);
  }
  return byLocale[locale];
}

/**
 * 모바일 폭 ≤360px 시 short variant 사용해야 하는지 판정.
 * SSR/구형 브라우저: false (정상 카피 fallback).
 * - C-D18-1 useResponsiveSheet 와 동일한 360px 임계값을 정의 (디자인 토큰 일관성).
 */
export function shouldUseShortCopy(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 360;
}

/**
 * React 훅 — 현재 화면 폭에 따라 자동으로 카피·CTA 반환.
 * resize 이벤트 listener로 폭 변동 시 재렌더 트리거.
 *
 * SSR-safe: 첫 마운트 전에는 정상 카피 (서버 ↔ 클라이언트 마크업 일치).
 */
export function useEmptyState(
  key: EmptyKey,
  locale: EmptyLocale,
): EmptyStateEntry & { isShort: boolean } {
  const [isShort, setIsShort] = useState(false);

  useEffect(() => {
    const update = () => setIsShort(shouldUseShortCopy());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const entry = getEmpty(key, locale);
  return {
    ...entry,
    copy: isShort ? entry.copyShort : entry.copy,
    isShort,
  };
}

// 단위 테스트 / 외부 검증용 export — production 코드 import 금지.
export const __empty_state_internal = {
  COPY,
};
