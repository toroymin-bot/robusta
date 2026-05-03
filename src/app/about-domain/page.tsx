/**
 * about-domain/page.tsx
 *   C-D36-5 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-5 (F-D36-5 / KQ_23).
 *
 * Why: KQ_23 도메인 fallback banner CTA "자세히" 링크의 학습 페이지.
 *   사용자 신뢰 강화 — 임시 도메인 운영 정책 + 데이터 안전 + 이전 후 redirect 가시화.
 *
 * 동작 (자율 결정 D-36-자-5):
 *   - 정적 페이지 — Static Export 호환 (dynamic 강제 옵션 미사용).
 *   - i18n: 기본 ko 카피 사용 (D-9.3 라우팅 도입 전 i18n 본체 정합).
 *   - banner sessionStorage dismiss 보존 — 사용자가 학습 후 back 시 banner 미재노출 (의도).
 *
 * SEO: Next 15 metadata API — title + description.
 *   외부 dev-deps 0 (next-seo 미사용). next/link 만 import.
 */

"use client";

import Link from "next/link";
import { t } from "@/modules/i18n/messages";

export default function AboutDomainPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-robusta-ink">
      <h1 className="mb-4 text-2xl font-bold">{t("about_domain.title")}</h1>
      <p className="mb-8 text-sm text-robusta-inkDim">
        {t("about_domain.intro")}
      </p>

      <h2 className="mb-2 text-lg font-semibold">왜 임시 도메인인가요?</h2>
      <p className="mb-6 text-sm">{t("about_domain.why")}</p>

      <h2 className="mb-2 text-lg font-semibold">언제 정식 도메인으로 이전되나요?</h2>
      <p className="mb-6 text-sm">{t("about_domain.when")}</p>

      <h2 className="mb-3 text-lg font-semibold">자주 묻는 질문</h2>
      <dl className="mb-8 space-y-4 text-sm">
        <div>
          <dt className="font-semibold">{t("about_domain.faq_q1")}</dt>
          <dd className="mt-1 text-robusta-inkDim">{t("about_domain.faq_a1")}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t("about_domain.faq_q2")}</dt>
          <dd className="mt-1 text-robusta-inkDim">{t("about_domain.faq_a2")}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t("about_domain.faq_q3")}</dt>
          <dd className="mt-1 text-robusta-inkDim">{t("about_domain.faq_a3")}</dd>
        </div>
      </dl>

      <Link
        href="/"
        className="inline-block rounded border border-robusta-divider px-4 py-2 text-sm text-robusta-ink hover:border-robusta-accent"
      >
        ← Robusta 로 돌아가기
      </Link>
    </main>
  );
}
