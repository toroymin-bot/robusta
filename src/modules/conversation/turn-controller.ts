/**
 * turn-controller.ts — 다음 발언자 선택 로직.
 *
 * D2 PR2: manual 모드만 구현 (manualPick 필수, round-robin/trigger throw).
 * D3 (D-8.2, 2026-04-27): round-robin 본격 구현 — participantIds 순서 유지,
 *   lastSpeakerId 기준 다음 인덱스 (modulo). manualPick 우선 override.
 *   trigger는 D4 P1로 ~~throw 유지~~.
 * D-D10-5 (Day 9, 2026-04-28, B12 채택분) C-D10-5: 'ai-auto' 4번째 모드 골격.
 *   AI-AI 자율 발언 — N초마다 인간 제외 AI 라운드로빈. 클라이언트 setInterval 트리거(C-D11-1로 분리).
 *   본 슬롯은 enum + 순수 함수(pickNextSpeakerAutoAi)만 박음. 안정성 게이트(타임아웃 누수, 토큰 폭주, abort 정합성)는 C-D11-1 검증 후 박는다.
 */

import type { Participant } from "@/modules/participants/participant-types";

// D-D10-5 C-D10-5: ai-auto 추가 (4번째 모드).
export type TurnMode = "manual" | "round-robin" | "trigger" | "ai-auto";

export interface PickNextSpeakerOptions {
  /** 발언 모드. */
  mode: TurnMode;
  /** 직전 발언자 id (null = 첫 발언). */
  lastSpeakerId: string | null;
  /** 전체 참여자 (id 조회용). */
  participants: Participant[];
  /**
   * 대화 참여자 id 배열 (순서 유지).
   * 명세 D-8.2: round-robin 진행 순서가 이 배열을 따른다.
   * 미지정 시 participants.map(p=>p.id) 폴백 (D2 호환).
   */
  participantIds?: string[];
  /** 사용자 명시 override — 모드 무관 우선 적용. */
  manualPick?: string;
}

/**
 * 다음 발언자 id 결정.
 *
 * 규칙 (명세 §3 round-robin):
 *   1) manualPick 있으면 모드 무관 우선 (단, participantIds에 존재해야 함).
 *   2) round-robin: lastSpeakerId === null → 첫 번째.
 *   3) round-robin: 그 외 → (현재 인덱스 + 1) % length.
 *      lastSpeakerId가 participantIds에 없으면 첫 번째.
 *   4) participantIds.length === 0 → throw.
 *   5) participantIds.length === 1 → 같은 participant 반복 (단독 대화 OK).
 */
export function pickNextSpeaker(opts: PickNextSpeakerOptions): string {
  // participantIds 폴백 — D2 호환 (호출 측이 conversation.participantIds 안 넘기면)
  const ids = opts.participantIds ?? opts.participants.map((p) => p.id);

  if (ids.length === 0) {
    throw new Error("pickNextSpeaker: no participants");
  }

  // (1) manualPick 우선 — 모든 모드 공통 사용자 명시 override
  if (opts.manualPick) {
    if (!ids.includes(opts.manualPick)) {
      throw new Error(`manualPick "${opts.manualPick}" not in participants`);
    }
    return opts.manualPick;
  }

  // manual 모드는 manualPick 필수
  if (opts.mode === "manual") {
    throw new Error("manual mode requires manualPick");
  }

  // trigger 모드는 D4 P1 — Roy_Request 별도, 현재 throw
  if (opts.mode === "trigger") {
    throw new Error("mode not implemented in D3: trigger (queued for D4)");
  }

  // D-D10-5 C-D10-5: ai-auto 모드는 클라이언트 setInterval에서 별도 함수(pickNextSpeakerAutoAi)로 처리.
  //   pickNextSpeaker는 동기 단발 호출용이므로 ai-auto는 여기서 throw로 격리.
  if (opts.mode === "ai-auto") {
    throw new Error("mode 'ai-auto' uses pickNextSpeakerAutoAi() — driven by client setInterval (C-D11-1)");
  }

  // (2) round-robin: 첫 발언이거나 lastSpeakerId가 ids에 없으면 첫 번째
  if (opts.lastSpeakerId === null) {
    return ids[0]!;
  }
  const lastIdx = ids.indexOf(opts.lastSpeakerId);
  if (lastIdx === -1) {
    return ids[0]!;
  }
  // (3) round-robin: 다음 인덱스 (modulo)
  // ids.length === 1 이면 (0+1)%1 = 0 → 같은 participant 반복 (단독 대화)
  return ids[(lastIdx + 1) % ids.length]!;
}

/**
 * D-D10-5 (Day 9, 2026-04-28) C-D10-5: AI-Auto 자율 발언 다음 화자 선택 (B12 채택분).
 *   인간 제외 AI 참여자 중 lastSpeaker 다음 인덱스(라운드로빈) + intervalMs delay 반환.
 *   AI 0명 → null (호출자는 토글 비활성 처리 또는 토스트 안내).
 *   본 함수는 순수 — setInterval/타이머 진입점은 호출자(C-D11-1)에서 박음.
 *
 *   엣지 케이스:
 *   - AI 0명: null
 *   - AI 1명: 같은 AI 반복 (단독 자율 대화 OK, 단 호출자가 maxAutoTurns로 제한 권장)
 *   - lastSpeaker가 인간 또는 AI 목록에 없음: 첫 AI부터 시작
 *   - intervalMs ≤ 0: 그대로 반환 (호출자가 즉시 발언 결정 — 권장 X)
 *
 * @param participants  전체 참여자 (kind='human'|'ai').
 * @param lastSpeaker   직전 발언자 id (인간/AI 무관). null = 첫 발언.
 * @param intervalMs    다음 발언 지연 ms (기본 5000 권장 — 호출자가 명시).
 * @returns next: 다음 AI participantId / delayMs: intervalMs 그대로. AI 0명이면 null.
 */
export function pickNextSpeakerAutoAi(
  participants: Participant[],
  lastSpeaker: string | null,
  intervalMs: number,
): { next: string; delayMs: number } | null {
  // 인간 제외 — kind === 'ai'만 라운드로빈 후보.
  const aiOnly = participants.filter((p) => p.kind === "ai");
  if (aiOnly.length === 0) return null;

  // lastSpeaker가 AI 목록에 없으면(인간 발언 직후 또는 첫 발언) 첫 AI부터.
  const aiIds = aiOnly.map((p) => p.id);
  const lastIdx = lastSpeaker === null ? -1 : aiIds.indexOf(lastSpeaker);
  // lastIdx === -1 → (0)%len = 0 (첫 AI). 그 외 → (lastIdx+1)%len.
  const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % aiIds.length;
  return { next: aiIds[nextIdx]!, delayMs: intervalMs };
}
