/**
 * D-D17-2 (Day 5 03시 슬롯, 2026-04-30) C-D17-2: 첫 방문 onboarding "샘플 보기" CTA.
 *   똘이 v1 §6.1 F-1 채택분 — 참여자 0명 + 메시지 0개 빈 화면을 노란 CTA로 대체.
 *   Roy Do v24 id-15 "초등학생 직관" 정합 — 첫 사용자 마찰 ↓.
 *
 *   모듈화 (Roy Do v24 id-9): variant='sample' | 'byok' 로 다른 빈 상태에서도 재사용.
 *   회귀 위험 0 — 신규 컴포넌트, 호출 측에서 기존 분기에 감싸서 등록.
 *   1st Load 영향: next/link 대신 plain <a> 사용 (정적 라우트 /sample, /getting-started/byok 모두
 *     SSG prerender + 동일 도메인 — Link prefetch 이점 미미. 번들 감량 우선).
 *
 * C-D17-14 (D6 03시 슬롯, 2026-05-01) — KQ_13 답변 흡수:
 *   variant 확장 — 기존 'sample'/'byok' (외부 라우팅) + 신규 'zeroParticipants'/'onlyHuman'/'zeroMessages'
 *   (인-패널 onboarding). 후자 3종은 empty-state-registry 의 카피·CTA 사용.
 *   onIntent 콜백으로 [참여자 추가]/[AI 추가]/[입력 포커스] 의도를 호출자에 위임 (잡스: 한 번에 하나).
 *   모바일 ≤360px short variant — useEmptyState 훅으로 자동 분기.
 */

import {
  type EmptyCtaIntent,
  type EmptyKey,
  type EmptyLocale,
  useEmptyState,
} from "./empty-state-registry";

// 기존 외부 라우팅 variant — Day 5 EmptyStateCta 호출자(conversation-view)와 호환 유지.
type OldVariant = "sample" | "byok";
// C-D17-14 신규 인-패널 onboarding variant — empty-state-registry 키와 1:1 매핑.
type RegistryVariant = EmptyKey;

export interface EmptyStateCtaProps {
  /** /sample 라우트 외 다른 곳으로 보내고 싶을 때 사용. 기본은 variant에 따른 자동 분기. */
  href?: string;
  /**
   * 카피 변형.
   *  - 'sample' / 'byok' (Day 5): 외부 라우트 anchor 형태 (기존 호환).
   *  - 'zeroParticipants' / 'onlyHuman' / 'zeroMessages' (D6 KQ_13): 인-패널 onboarding,
   *    onIntent 콜백 + locale prop 동반 사용.
   */
  variant?: OldVariant | RegistryVariant;
  /** registry variant 사용 시 ko/en 선택 — 기본 'ko'. */
  locale?: EmptyLocale;
  /** registry variant 사용 시 CTA 클릭 콜백. 의도(addParticipant/addAI/focusInput)를 호출자가 매핑. */
  onIntent?: (intent: EmptyCtaIntent) => void;
}

interface CtaCopy {
  title: string;
  sub: string;
  cta: string;
  defaultHref: string;
}

// 기존 외부 라우팅 variant 만 — registry variant는 empty-state-registry 가 관리.
const OLD_COPY: Record<OldVariant, CtaCopy> = {
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

// 신규 registry 키인지 판정 — 타입 좁히기용.
function isRegistryVariant(v: NonNullable<EmptyStateCtaProps["variant"]>): v is RegistryVariant {
  return v === "zeroParticipants" || v === "onlyHuman" || v === "zeroMessages";
}

export function EmptyStateCta(props: EmptyStateCtaProps) {
  const { href, variant = "sample", locale = "ko", onIntent } = props;

  if (isRegistryVariant(variant)) {
    return <RegistryCta variant={variant} locale={locale} onIntent={onIntent} />;
  }

  const copy = OLD_COPY[variant];
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

/**
 * C-D17-14 KQ_13 채택분 인-패널 onboarding CTA.
 *  - 카피 1줄, CTA 1개, 일러스트 0개 (잡스 단순).
 *  - 모바일 ≤360px short variant 자동 분기 (useEmptyState).
 *  - white-space: nowrap — 줄바꿈 박살 방지 (Roy id-11 정합).
 */
function RegistryCta({
  variant,
  locale,
  onIntent,
}: {
  variant: RegistryVariant;
  locale: EmptyLocale;
  onIntent?: (intent: EmptyCtaIntent) => void;
}) {
  const entry = useEmptyState(variant, locale);
  return (
    <div
      data-test="empty-state-cta"
      data-variant={variant}
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <p
        className="whitespace-nowrap text-base font-semibold text-robusta-ink"
        data-test="empty-state-copy"
      >
        {entry.copy}
      </p>
      <button
        type="button"
        data-test="empty-state-cta-button"
        data-intent={entry.ctaIntent}
        onClick={() => onIntent?.(entry.ctaIntent)}
        className="whitespace-nowrap rounded bg-robusta-accent px-4 py-2 text-sm font-semibold text-robusta-ink hover:bg-robusta-accent/90 focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2"
      >
        {entry.ctaLabel}
      </button>
    </div>
  );
}
