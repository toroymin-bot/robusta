"use client";

/**
 * src/modules/launch/show-hn-copy.ts
 *   - C-D43-3 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-3 (B-D43-1 / V-D43-1).
 *
 * Why: D-1 (5/7 21:00 ET = 5/8 10:00 KST 동시) Show HN submit 큐 정합 — 헤드라인+본문 5단락 정적 export.
 *   카피 본문 자체는 i18n 카피 키 (showhn.headline / showhn.body.p1∼p5) 에서 read.
 *   영문 = HN canonical 제출 본체 / 한국어 = 운영 백업 정합.
 *
 * 정책 (V-D43-1):
 *   - 헤드라인 ≤ 80 chars (HN 정책).
 *   - 영문 헤드라인 "Show HN: " prefix 의무 (HN 정책 — Roy 5/6 검수).
 *   - 본문 5단락, 단락당 줄바꿈 ≤ 2.
 *   - 이모지 0.
 *   - 강조 **bold** ≤ 3건.
 *
 * Note (자율 정정 D-43-자-3):
 *   기존 src/modules/landing/show-hn-copy.tsx (C-D38-1 ShowHnCopyV3 컴포넌트) 와 명명 충돌 회피 —
 *   본 모듈은 .ts (data) / 기존은 .tsx (컴포넌트) + 디렉터리 launch vs landing 구분.
 */

import { t, type Locale } from "@/modules/i18n/messages";

export interface ShowHnPost {
  headline: string;
  body: string; // 5 단락, "\n\n" join
  paragraphs: readonly string[]; // 5 elements
}

const HEADLINE_MAX = 80;

export function getShowHnPost(locale: Locale): ShowHnPost {
  const headline = t("showhn.headline", undefined, locale);
  const paragraphs = [
    t("showhn.body.p1", undefined, locale),
    t("showhn.body.p2", undefined, locale),
    t("showhn.body.p3", undefined, locale),
    t("showhn.body.p4", undefined, locale),
    t("showhn.body.p5", undefined, locale),
  ] as const;

  // V-D43-1 디자인 게이트:
  if (headline.length > HEADLINE_MAX) {
    throw new Error(
      `[show-hn-copy] headline > ${HEADLINE_MAX} chars (${headline.length}): ${headline}`,
    );
  }

  return {
    headline,
    body: paragraphs.join("\n\n"),
    paragraphs,
  };
}

/**
 * en submit canonical:
 *   - "Show HN:" prefix 의무.
 *   - 80 chars 제한.
 */
export function assertEnglishSubmitReady(): ShowHnPost {
  const post = getShowHnPost("en");
  if (!post.headline.startsWith("Show HN: Robusta")) {
    throw new Error("[show-hn-copy] en headline must start with 'Show HN: Robusta'");
  }
  return post;
}
