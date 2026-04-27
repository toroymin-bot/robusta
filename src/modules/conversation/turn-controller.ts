/**
 * turn-controller.ts — 다음 발언자 선택 로직.
 *
 * D2 PR2: manual 모드만 구현 (manualPick 필수, round-robin/trigger throw).
 * D3 (D-8.2, 2026-04-27): round-robin 본격 구현 — participantIds 순서 유지,
 *   lastSpeakerId 기준 다음 인덱스 (modulo). manualPick 우선 override.
 *   trigger는 D4 P1로 ~~throw 유지~~.
 */

import type { Participant } from "@/modules/participants/participant-types";

export type TurnMode = "manual" | "round-robin" | "trigger";

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
