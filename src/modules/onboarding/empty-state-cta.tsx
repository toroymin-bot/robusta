/**
 * D-D17-2 (Day 5 03시 슬롯, 2026-04-30) C-D17-2: 첫 방문 onboarding "샘플 보기" CTA.
 *   똘이 v1 §6.1 F-1 채택분 — 참여자 0명 + 메시지 0개 빈 화면을 노란 CTA로 대체.
 *   Roy Do v24 id-15 "초등학생 직관" 정합 — 첫 사용자 마찰 ↓.
 *
 *   모듈화 (Roy Do v24 id-9): variant='sample' | 'byok' 로 다른 빈 상태에서도 재사용.
 *   회귀 위험 0 — 신규 컴포넌트, 호출 측에서 기존 분기에 감싸서 박음.
 *   1st Load 영향: next/link 대신 plain <a> 사용 (정적 라우트 /sample, /getting-started/byok 모두
 *     SSG prerender + 동일 도메인 — Link prefetch 이점 미미. 번들 감량 우선).
 */

export interface EmptyStateCtaProps {
  /** /sample 라우트 외 다른 곳으로 보내고 싶을 때 사용. 기본은 variant에 따른 자동 분기. */
  href?: string;
  /** 카피 변형. sample = 샘플 대화 보기 (기본) / byok = 내 키로 시작 */
  variant?: "sample" | "byok";
}

interface CtaCopy {
  title: string;
  sub: string;
  cta: string;
  defaultHref: string;
}

const COPY: Record<NonNullable<EmptyStateCtaProps["variant"]>, CtaCopy> = {
  sample: {
    title: "샘플 대화 먼저 볼래요",
    sub: "AI 둘과 인간 한 명의 3자 대화 1건. 1분.",
    cta: "샘플 보기 →",
    defaultHref: "/sample",
  },
  byok: {
    title: "내 키로 시작",
    sub: "Anthropic 키 1분 발급. BYOK.",
    cta: "시작하기 →",
    defaultHref: "/getting-started/byok",
  },
};

export function EmptyStateCta({
  href,
  variant = "sample",
}: EmptyStateCtaProps) {
  const copy = COPY[variant];
  const target = href ?? copy.defaultHref;

  return (
    <div
      data-test="empty-state-cta"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <p className="text-base font-semibold text-robusta-ink">{copy.title}</p>
      <p className="text-sm text-robusta-inkDim">{copy.sub}</p>
      <a
        data-test="empty-state-cta-link"
        href={target}
        className="rounded bg-robusta-accent px-4 py-2 text-sm font-semibold text-robusta-ink hover:bg-robusta-accent/90"
      >
        {copy.cta}
      </a>
    </div>
  );
}
