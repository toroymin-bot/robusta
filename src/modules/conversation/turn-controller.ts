/**
 * turn-controller.ts — 다음 발언자 선택 로직.
 *
 * D2 PR2: manual 모드만 구현 (manualPick 필수, round-robin/trigger throw).
 * D3 (D-8.2, 2026-04-27): round-robin 본격 구현 — participantIds 순서 유지,
 *   lastSpeakerId 기준 다음 인덱스 (modulo). manualPick 우선 override.
 *   trigger는 D4 P1로 ~~throw 유지~~.
 * D-D10-5 (Day 9, 2026-04-28, B12 채택분) C-D10-5: 'ai-auto' 4번째 모드 골격.
 *   AI-AI 자율 발언 — N초마다 인간 제외 AI 라운드로빈. 클라이언트 setInterval 트리거(C-D11-1로 분리).
 *   본 슬롯은 enum + 순수 함수(pickNextSpeakerAutoAi)만 정의. 안정성 게이트(타임아웃 누수, 토큰 폭주, abort 정합성)는 C-D11-1 검증 후 기록한다.
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
 *   본 함수는 순수 — setInterval/타이머 진입점은 호출자(C-D11-1)에서 정의.
 *
 *   엣지 케이스:
 *   - AI 0명: null
 *   - AI 1명: ~~같은 AI 반복~~ → null (D-D11-1 §4.6/§E8 보강: 자기 응답 무한 루프 방지).
 *     단독 AI 대화는 'manual' 모드에서만 허용.
 *   - lastSpeaker가 인간 또는 AI 목록에 없음: 첫 AI부터 시작
 *   - intervalMs ≤ 0: 그대로 반환 (호출자가 즉시 발언 결정 — 권장 X)
 *
 * @param participants  전체 참여자 (kind='human'|'ai').
 * @param lastSpeaker   직전 발언자 id (인간/AI 무관). null = 첫 발언.
 * @param intervalMs    다음 발언 지연 ms (기본 5000 권장 — 호출자가 명시).
 * @returns next: 다음 AI participantId / delayMs: intervalMs 그대로. AI < 2명이면 null.
 */
export function pickNextSpeakerAutoAi(
  participants: Participant[],
  lastSpeaker: string | null,
  intervalMs: number,
): { next: string; delayMs: number } | null {
  // 인간 제외 — kind === 'ai'만 라운드로빈 후보.
  const aiOnly = participants.filter((p) => p.kind === "ai");
  // D-D11-1 §4.6: AI 0명 OR 1명 모두 null. 1명 자기 응답 무한 루프 방지.
  if (aiOnly.length < 2) return null;

  // lastSpeaker가 AI 목록에 없으면(인간 발언 직후 또는 첫 발언) 첫 AI부터.
  const aiIds = aiOnly.map((p) => p.id);
  const lastIdx = lastSpeaker === null ? -1 : aiIds.indexOf(lastSpeaker);
  // lastIdx === -1 → (0)%len = 0 (첫 AI). 그 외 → (lastIdx+1)%len.
  const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % aiIds.length;
  return { next: aiIds[nextIdx]!, delayMs: intervalMs };
}

// ============================================================================
// D-D11-1 (Day 10, 2026-04-29) C-D11-1: AI-Auto 트리거 풀 + 5종 안정성 가드 (B14 본체).
//   클라이언트 setInterval 라이프사이클 + visibilitychange/maxTurns/byok/abort/intercept 가드.
//   순수 함수(pickNextSpeakerAutoAi) 위에 부수효과 레이어만 정의. OCP 유지 — 기존 로직 변경 X.
// ============================================================================

/**
 * AI-Auto 트리거 라이프사이클 상태.
 *   - idle: 시작 전. terminal X.
 *   - running: tick 진행 중. handle.stop으로만 다른 상태 진입.
 *   - paused-human: 인간 가로채기로 일시정지. resume 가능.
 *   - paused-hidden: 탭 비활성으로 일시정지. resume 가능 (사용자 명시 ▶).
 *   - completed: maxAutoTurns 도달. terminal — resume 불가, 새 startAutoLoop만.
 *   - stopped-error: BYOK 부재/AI<2명/streamMessage 실패. terminal.
 */
export type AutoLoopStatus =
  | "idle"
  | "running"
  | "paused-human"
  | "paused-hidden"
  | "completed"
  | "stopped-error";

export type AutoLoopStopReason =
  | "human"
  | "hidden"
  | "completed"
  | "manual"
  | "byokMissing"
  | "noSpeaker"
  | "streamError";

export interface AutoLoopConfig {
  /** tick 간격 ms. 권장 5000/15000/30000/60000. 기본 15000. */
  intervalMs: number;
  /** 최대 자동 턴 수. 토큰 폭주 1차 가드. 기본 10. */
  maxAutoTurns: number;
  /** 발언 시작 직전. 헤더 카운터 갱신용. */
  onTickStart?: () => void;
  /** 발언 정상 완료 (turnIndex = 1-based). */
  onTickEnd?: (turnIndex: number) => void;
  /** 상태 전이 알림 (헤더 라벨/토스트 트리거용). */
  onStatusChange?: (status: AutoLoopStatus, reason?: AutoLoopStopReason) => void;
  /** 비정상 종료. caller는 토스트로 사용자에게 알림. */
  onError?: (reason: AutoLoopStopReason, detail?: string) => void;
}

export interface AutoLoopContext {
  /** 다음 발언자 id 반환. null이면 stop("noSpeaker"). */
  pickNextSpeaker: () => string | null;
  /** 한 턴 발언 — placeholder 생성/SSE 소비/업데이트 모두 호출자(store) 책임. */
  streamMessage: (speakerId: string, signal: AbortSignal) => Promise<void>;
  /** 다른 streaming 진행 중인지 (수동 모드 잔여 메시지 가드). */
  isStreaming: () => boolean;
  /** 현재 활성 provider의 BYOK 키 존재 여부. */
  hasByokKey: () => boolean;
}

export interface AutoLoopHandle {
  status: () => AutoLoopStatus;
  turnsCompleted: () => number;
  /** 명시적 중지 — 모든 상태에서 호출 가능. idempotent. */
  stop: (reason: AutoLoopStopReason) => void;
  /** paused 상태에서만 true 반환 + 재시작. running/terminal은 false. */
  resume: () => boolean;
}

/**
 * AI-Auto 트리거 시작.
 *   1차 tick은 intervalMs 후. 사용자 ▶ 클릭 직후 즉시 발화 X (체감 일관성).
 *   재시작 시 turnsCompleted 0 리셋. resume과 다름.
 *
 *   엣지 (명세 §4.5):
 *   E1 인간 가로채기 → caller가 handle.stop("human") (E1은 store action에서 정의)
 *   E2 isStreaming=true → tick skip (다음 tick 재평가)
 *   E3 BYOK 부재 → stop("byokMissing") + onError
 *   E4 visibilitychange hidden=true → stop("hidden") (자동 resume X)
 *   E5 streamMessage reject → stop("streamError") + onError
 *   E6 caller setTurnMode != ai-auto → caller가 handle.stop("manual")
 *   E7 stop 2회 호출 → idempotent
 *   E8 AI < 2명 → pickNextSpeaker null → stop("noSpeaker")
 *   E10 hidden 상태 시작 → status="paused-hidden"으로 진입, 첫 tick 미발생
 */
export function startAutoLoop(
  ctx: AutoLoopContext,
  config: AutoLoopConfig,
): AutoLoopHandle {
  let status: AutoLoopStatus = "idle";
  let turnsCompleted = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let activeAbort: AbortController | null = null;

  function setStatus(next: AutoLoopStatus, reason?: AutoLoopStopReason) {
    if (status === next) return;
    status = next;
    config.onStatusChange?.(status, reason);
  }

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function cancelInflight() {
    if (activeAbort) {
      try {
        activeAbort.abort();
      } catch {
        // ignore — abort는 idempotent
      }
      activeAbort = null;
    }
  }

  async function tick() {
    // E3 BYOK 부재 가드 — tick 진입 직전 재평가 (사용자가 키 삭제했을 수 있음).
    if (!ctx.hasByokKey()) {
      handle.stop("byokMissing");
      config.onError?.("byokMissing");
      return;
    }
    // E2 다른 streaming 진행 중 → skip.
    if (ctx.isStreaming()) {
      return;
    }
    // E8 다음 발언자 없음 → terminal error.
    const speakerId = ctx.pickNextSpeaker();
    if (speakerId === null) {
      handle.stop("noSpeaker");
      config.onError?.("noSpeaker");
      return;
    }
    // 정상 — maxAutoTurns 도달은 streamMessage 완료 후 평가 (현재 진행 턴은 끝까지).
    config.onTickStart?.();
    const ac = new AbortController();
    activeAbort = ac;
    try {
      await ctx.streamMessage(speakerId, ac.signal);
      // stop이 도중에 호출되면 status가 running이 아닐 수 있음 — 카운터 증가 가드.
      if (status !== "running") return;
      activeAbort = null;
      turnsCompleted += 1;
      config.onTickEnd?.(turnsCompleted);
      // E5 maxAutoTurns 도달 → terminal completed.
      if (turnsCompleted >= config.maxAutoTurns) {
        handle.stop("completed");
      }
    } catch (e) {
      activeAbort = null;
      // stop으로 인한 abort는 stream error로 분류 X (status가 이미 paused/terminal).
      if (status !== "running") return;
      handle.stop("streamError");
      config.onError?.("streamError", e instanceof Error ? e.message : String(e));
    }
  }

  function startTimer() {
    clearTimer();
    intervalId = setInterval(() => void tick(), config.intervalMs);
  }

  function onVisibilityChange() {
    if (typeof document === "undefined") return;
    if (document.hidden && status === "running") {
      // E4: 진행 중 stream도 abort. 복귀 시 자동 resume X.
      cancelInflight();
      clearTimer();
      setStatus("paused-hidden", "hidden");
    }
    // 복귀(hidden=false): 자동 시작 X. 사용자 ▶ 클릭이 resume 호출.
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  const handle: AutoLoopHandle = {
    status: () => status,
    turnsCompleted: () => turnsCompleted,
    stop: (reason) => {
      // E7 idempotent. terminal 상태 재진입 방지.
      if (status === "completed" || status === "stopped-error") {
        return;
      }
      cancelInflight();
      clearTimer();
      // 분기: 일시정지 vs 종료.
      if (reason === "human") {
        setStatus("paused-human", reason);
      } else if (reason === "hidden") {
        setStatus("paused-hidden", reason);
      } else if (reason === "completed") {
        setStatus("completed", reason);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
      } else {
        // manual / byokMissing / noSpeaker / streamError → terminal stopped-error.
        // 단 'manual'은 사용자 의도 → stopped-error 라벨이지만 onError 호출 X (caller 책임).
        setStatus("stopped-error", reason);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        }
      }
    },
    resume: () => {
      if (status !== "paused-human" && status !== "paused-hidden") {
        return false;
      }
      // 복귀 시 BYOK 재검증 — paused 동안 키가 삭제됐을 수 있음.
      if (!ctx.hasByokKey()) {
        handle.stop("byokMissing");
        config.onError?.("byokMissing");
        return false;
      }
      setStatus("running");
      startTimer();
      return true;
    },
  };

  // E10: 시작 시 탭이 이미 hidden이면 paused-hidden으로 진입. 첫 tick 미발생.
  if (typeof document !== "undefined" && document.hidden) {
    setStatus("paused-hidden", "hidden");
    return handle;
  }

  setStatus("running");
  startTimer();
  return handle;
}

/**
 * 명시적 중지 헬퍼. caller는 보통 handle.stop을 직접 사용.
 *   존재 이유: store action에서 핸들 변수 추적 없이 단발 stop 호출 가능.
 */
export function stopAutoLoop(
  handle: AutoLoopHandle,
  reason: AutoLoopStopReason,
): void {
  handle.stop(reason);
}
