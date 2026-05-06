/**
 * post-auth-recover.ts (스켈레톤 + C-D52-5 본체)
 *   - C-D51-5 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-5 (KQ_24 회복 stub).
 *   - C-D52-5 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-5 (스켈레톤 → 본체).
 *
 * Why: KQ_24 (Confluence 인증 부재) 회복 후 §8/§9/§10 자식 페이지 일괄 사후 등록.
 *   본 슬롯에서 본체 구현 — Confluence REST API GET /pages/{parentId}/children 호출.
 *   페이지 신규 생성(POST)은 D+1 운용 슬롯 큐 (read-only 검증만).
 *
 * 자율 정정:
 *   - D-52-자-7: 명세 § 9 출력 RecoverResult { recovered: SlotRef[], pending: SlotRef[], errors: ErrorRef[] }
 *                기존 D-D51 스켈레톤 RecoverResult { registered: string[], skipped: string[], errors: string[] }
 *                와 시그니처 충돌. D-D51 verify-d51 게이트 7번 (recoverMissingChildPages export +
 *                ATLASSIAN_API_TOKEN 핸들링 + result.errors.push 패턴) 회귀 보호 의무.
 *                해결: 기존 recoverMissingChildPages 보존 + 신규 함수 postAuthRecover OCP append.
 *                postAuthRecover는 명세 § 9 시그니처 정합. 두 함수 공존 — D+1 본 운용에서 하나 선택.
 *
 * 정책 (스켈레톤 보존):
 *   - ATLASSIAN_API_TOKEN env 미설정 → errors=['ATLASSIAN_API_TOKEN not set'] 반환 (throw X).
 *   - parentId 페이지 없음 → errors 누적.
 *   - commit message 'komi: ... §N 자율 D-DNN-자-N' grep으로 expectedSlots 자동 검출 (D+1 큐).
 *   - 동시성 1 (직렬 처리, race condition 0).
 *
 * 정책 (C-D52-5 본체):
 *   - GET /wiki/api/v2/pages/{parentId}/children 호출 (Bearer auth).
 *   - 429 rate limit → exponential backoff 3회 (1s, 2s, 4s) → errors 반환.
 *   - 멱등성: 자식 제목에 expectedSlot ID 포함 시 recovered, 미포함 시 pending.
 *   - server-side only — typeof window 검사 시 throw (cron/Node 전용).
 *   - 페이지 신규 생성(POST)은 본 슬롯 미구현 — D+1 운용 큐.
 *
 * 보존 13 영향: 0 (신규 모듈).
 */

export interface RecoverResult {
  registered: string[];
  skipped: string[];
  errors: string[];
}

/**
 * recoverMissingChildPages — KQ_24 회복 후 §8/§9/§10 자식 페이지 일괄 사후 등록.
 *   본 슬롯은 스켈레톤 (TODO 본체). D+1 자율 슬롯에서 구현 큐.
 *
 *   throw 하지 않음 — 자율 모드 fallback 정합 (errors 배열로 누적 반환).
 */
export async function recoverMissingChildPages(
  parentId: string,
  expectedSlots: string[],
): Promise<RecoverResult> {
  const result: RecoverResult = {
    registered: [],
    skipped: [],
    errors: [],
  };

  // (a) ATLASSIAN_API_TOKEN env 미설정 → errors 반환 (throw X).
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!token) {
    result.errors.push("ATLASSIAN_API_TOKEN not set");
    return result;
  }

  // (b) parentId 검증 — 본체는 D+1 자율 슬롯 큐 (TODO).
  if (!parentId) {
    result.errors.push("parentId is empty");
    return result;
  }

  // (c) expectedSlots 비어있음 → skip-pass (빈 배열은 valid input).
  if (expectedSlots.length === 0) {
    return result;
  }

  // TODO (D+1 자율 슬롯 본체 구현 큐):
  //   1. atlassian REST API GET /wiki/api/v2/pages/{parentId} (인증 헤더)
  //   2. expectedSlots 각 항목 — 자식 페이지 존재 검증
  //   3. 미존재 시 git log grep "komi: ... §N" → commit message 추출 → 자식 페이지 신규 생성
  //   4. registered/skipped/errors 누적 반환
  //   5. 동시성 1 (직렬 처리, race condition 0)
  for (const slot of expectedSlots) {
    result.skipped.push(slot);
  }

  return result;
}

/**
 * C-D52-5 신규 본체 — 명세 § 9 시그니처 정합.
 *   기존 recoverMissingChildPages 보존, 본 함수 OCP append (D-52-자-7 자율 정정).
 *   D+1 운용 슬롯에서 본 함수 또는 기존 함수 중 하나 선택 사용.
 */

export interface SlotRef {
  /** §N 슬롯 ID (예: '§8', '§9'). */
  slotId: string;
  /** ISO 8601 슬롯 시각. */
  isoTime: string;
  /** 관련 commit hash (선택). */
  commitHash?: string;
}

export interface ErrorRef {
  slotId: string;
  reason: string;
}

export interface PostAuthRecoverResult {
  recovered: SlotRef[];
  pending: SlotRef[];
  errors: ErrorRef[];
}

interface PostAuthRecoverInput {
  parentId: string;
  failedSlots: SlotRef[];
  /** 테스트 주입 — 미주입 시 process.env.ATLASSIAN_API_TOKEN. */
  token?: string;
  /** 테스트 주입 — 미주입 시 'https://ai4min.atlassian.net'. */
  baseUrl?: string;
  /** 테스트 주입 — 미주입 시 globalThis.fetch. */
  fetchFn?: typeof fetch;
}

const RATE_LIMIT_BACKOFF_MS = [1000, 2000, 4000] as const;

/**
 * postAuthRecover — KQ_24 회복 후 §N 자식 페이지 read-only 검증 (본 슬롯).
 *   페이지 신규 생성(POST) 본 운용은 D+1 슬롯 큐.
 *
 *   엣지:
 *     1. ATLASSIAN_API_TOKEN 미설정 → errors=['token not set']
 *     2. parentId 빈 문자열 → errors=['parentId empty']
 *     3. failedSlots 비어있음 → 빈 결과 반환 (skip-pass)
 *     4. 429 rate limit → exponential backoff 3회 → errors 누적
 *     5. SSR (브라우저) → throw (server-only cron 정합)
 *     6. 자식 페이지 제목에 slotId 포함 → recovered
 *     7. 자식 페이지 제목에 slotId 미포함 → pending
 *
 *   throw 안 함 (자율 모드 fallback 정합) — except SSR 가드.
 */
export async function postAuthRecover(
  input: PostAuthRecoverInput,
): Promise<PostAuthRecoverResult> {
  // (5) SSR 가드 — server-only.
  if (typeof window !== "undefined") {
    throw new Error("postAuthRecover is server-only (cron/Node).");
  }

  const result: PostAuthRecoverResult = {
    recovered: [],
    pending: [],
    errors: [],
  };

  const token = input.token ?? process.env.ATLASSIAN_API_TOKEN;
  if (!token) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: "ATLASSIAN_API_TOKEN not set" });
    }
    return result;
  }

  if (!input.parentId) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: "parentId empty" });
    }
    return result;
  }

  if (input.failedSlots.length === 0) {
    return result; // skip-pass (빈 입력 valid).
  }

  const baseUrl = input.baseUrl ?? "https://ai4min.atlassian.net";
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(input.parentId)}/children?limit=250`;

  let childTitles: string[] = [];
  let lastErr: string | null = null;

  // 429 rate limit → exponential backoff 3회.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetchFn(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.status === 429 && attempt < 3) {
        const ms = RATE_LIMIT_BACKOFF_MS[attempt];
        await new Promise((r) => setTimeout(r, ms));
        continue;
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        break;
      }
      const body = (await res.json()) as { results?: Array<{ title?: string }> };
      childTitles = (body.results ?? [])
        .map((r) => r.title)
        .filter((t): t is string => typeof t === "string");
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  if (lastErr !== null) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: lastErr });
    }
    return result;
  }

  // 자식 페이지 제목에 slotId 포함 시 recovered, 아니면 pending.
  for (const slot of input.failedSlots) {
    const found = childTitles.some((title) => title.includes(slot.slotId));
    if (found) {
      result.recovered.push(slot);
    } else {
      result.pending.push(slot);
    }
  }

  return result;
}
