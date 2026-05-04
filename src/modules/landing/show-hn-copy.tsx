"use client";

/**
 * show-hn-copy.tsx
 *   - C-D38-1 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-1 (Task_2026-05-04 §9, B-D38-1 (d) + D-D38-3 (c)).
 *
 * Why: Show HN 카피 v3 헤드라인 60자 최종 + sub 카피 — 5/7 21:00 ET = 5/8 10:00 KST submit 정합.
 *   B-D38-1 점수표 24/25 최종 선택 = (d) "your AI team, on your key, with full memory".
 *   "your AI team" = 차별성+안정성 / "on your key" = BYOK 명료 / "full memory" = ChatGPT 차별 결정타.
 *
 * 정책 (자율 정정 D-38-자-1):
 *   - 명세는 src/app/page.tsx Hero wiring 이었으나 page.tsx 는 Welcome/Workspace 분기 라우터.
 *     실제 Hero 카피 자리는 welcome-view.tsx 헤더 — 첫 진입자 본 카피 노출.
 *   - 자율 정정: welcome-view.tsx 헤더에 1줄 임포트 + 1줄 삽입 (보존 13 자산 무손상).
 *
 * 디자인 토큰 (D-D38-3 (c) 19/25 최종):
 *   - h1: text-[24px] font-medium tracking-tight text-stone-900 dark:text-stone-100.
 *   - sub: text-sm text-stone-500 dark:text-stone-400 mt-2.
 *   - 컨테이너: max-w-3xl mx-auto text-center.
 *   - 모바일 <360px h1 자동 줄바꿈 허용 (whitespace-nowrap 미사용 + overflow-visible).
 *
 * 보존 13 영향: 0 (신규 모듈, welcome-view 1줄 wiring 만).
 * 외부 dep: 0 (React/Tailwind 기존). 예상 번들 영향 ≈ +0.4 kB (168 103 kB 무영향).
 * XSS 방어: dangerouslySetInnerHTML 미사용 — React 자체 escape 신뢰.
 */

import type { JSX } from "react";

// 카피 본문 — verify-d38 정확 일치 grep 의무 (em-dash U+2014 단일).
//   54자: "Robusta — your AI team, on your key, with full memory"
//   sub : "Bring your Claude key. Two AIs, one conversation, full memory."
const HEADLINE = "Robusta — your AI team, on your key, with full memory" as const;
const SUB = "Bring your Claude key. Two AIs, one conversation, full memory." as const;

export function ShowHnCopyV3(): JSX.Element {
  return (
    <div
      data-test="show-hn-copy-v3"
      className="max-w-3xl mx-auto text-center overflow-visible"
    >
      <h1 className="text-[24px] font-medium tracking-tight text-stone-900 dark:text-stone-100">
        {HEADLINE}
      </h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
        {SUB}
      </p>
    </div>
  );
}

export default ShowHnCopyV3;
