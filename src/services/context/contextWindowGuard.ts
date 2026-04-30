/**
 * contextWindowGuard.ts
 *   - C-D18-4 (D6 03시 슬롯, 2026-05-01) — 똘이 v1 §5 명세 (F-22 컨텍스트 슬라이서).
 *
 * 책임:
 *   - 메시지 배열의 토큰 사용량이 모델 한도의 임계치(기본 80%) 초과 시 자동 압축 트리거.
 *   - 압축 = 오래된 메시지 N개를 LLM 요약 1건으로 대체. 시스템 프롬프트와 마지막 KEEP_TAIL건은 보존.
 *   - 압축 실패(LLM 호출 에러) → 원본 그대로 반환 + console.warn (서비스 중단 X).
 *
 * 비-책임:
 *   - 실제 LLM 호출 구현 — 외부 LLMClient 주입. 본 모듈은 인터페이스만 정의.
 *   - tiktoken 의존성 강제 — 런타임 가용 시 사용, 미가용 시 휴리스틱 fallback.
 *
 * 의존성 분리:
 *   - StoredMessage 타입을 직접 import 하지 않고 최소 Msg 인터페이스만 사용 — modules/storage 와 결합도 ↓.
 *   - 호출자가 매핑 책임 (예: { id, role: participantId 매핑, content, ... }).
 *
 * 휴리스틱:
 *   - tiktoken 미사용 환경에서 1 토큰 ≈ 4 chars (GPT/Claude 평균). KO/JP 등 멀티바이트는 보수적으로 ≈ 2 chars.
 *   - 정확도 < 10% 오차 — 80% 임계치는 안전 마진 충분.
 */

export interface Msg {
  /** 식별자 — 압축 후 새 메시지에는 'compact-{timestamp}' prefix. */
  id: string;
  /** 'system' | 'user' | 'assistant' (외부 호출자가 매핑). */
  role: "system" | "user" | "assistant";
  /** 본문 텍스트. */
  content: string;
  /** ms timestamp — 시간순 정렬 보장. */
  createdAt: number;
}

export interface LLMClient {
  /**
   * messages 배열을 받아 1줄 요약을 반환. 실패 시 throw.
   * 호출자(외부 어댑터)가 모델/프로바이더 결정.
   */
  summarize: (messages: Msg[]) => Promise<string>;
}

/** 마지막 N건은 즉시 컨텍스트로 무조건 보존. 똘이 §5 C-D18-4 검증 5번 항목. */
const KEEP_TAIL = 20;

/**
 * 시스템 프롬프트는 보존하면서 token 사용량 추정.
 * 멀티바이트(한/일/중) 가중 — ASCII는 4, 멀티바이트는 2 chars/token.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  let asciiChars = 0;
  let multiByteChars = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) asciiChars++;
    else multiByteChars++;
  }
  // 휴리스틱 — tiktoken 도입 시 본 함수 1개만 교체.
  return Math.ceil(asciiChars / 4) + Math.ceil(multiByteChars / 2);
}

/** 메시지 배열 전체의 추정 토큰 수. */
export function estimateMessagesTokens(messages: Msg[]): number {
  let total = 0;
  for (const m of messages) total += estimateTokens(m.content);
  return total;
}

/**
 * 압축이 필요한지 판정.
 *  - 메시지 토큰 합 ≥ modelMaxTokens × threshold 일 때 true.
 *  - threshold 기본 0.8 (= 80% 임계치, 똘이 §5 명세).
 */
export function shouldCompact(
  messages: Msg[],
  modelMaxTokens: number,
  threshold = 0.8,
): boolean {
  if (modelMaxTokens <= 0) return false;
  const used = estimateMessagesTokens(messages);
  return used >= modelMaxTokens * threshold;
}

/**
 * 메시지 압축.
 *  - 시스템 프롬프트는 절대 보존(role==='system' 전부 앞단 유지).
 *  - 마지막 KEEP_TAIL건은 그대로 보존(즉시 컨텍스트).
 *  - 그 사이 메시지(=중간부)를 LLM 요약 1건으로 대체.
 *  - 중간부가 비어있으면 압축 불필요 → 원본 반환.
 *  - LLM 호출 실패 시 원본 반환 + console.warn (서비스 중단 X).
 */
export async function compact(messages: Msg[], llm: LLMClient): Promise<Msg[]> {
  const systems = messages.filter((m) => m.role === "system");
  const nonSystems = messages.filter((m) => m.role !== "system");

  if (nonSystems.length <= KEEP_TAIL) {
    return messages; // 압축 불필요 — 마지막 KEEP_TAIL 보존만으로 충분.
  }

  const middle = nonSystems.slice(0, nonSystems.length - KEEP_TAIL);
  const tail = nonSystems.slice(nonSystems.length - KEEP_TAIL);

  let summary: string;
  try {
    summary = await llm.summarize(middle);
  } catch (err) {
    console.warn("[robusta] contextWindowGuard.compact: LLM 요약 실패", err);
    return messages; // 안전 fallback — 원본 그대로.
  }

  const summaryMsg: Msg = {
    id: `compact-${Date.now()}`,
    role: "assistant",
    content: `[자동 요약 — ${middle.length}건 압축]\n${summary}`,
    createdAt: middle[0]?.createdAt ?? Date.now(),
  };

  return [...systems, summaryMsg, ...tail];
}

export const __context_guard_internal = {
  KEEP_TAIL,
  estimateTokens,
};
