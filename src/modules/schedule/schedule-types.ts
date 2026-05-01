/**
 * schedule-types.ts
 *   - C-D17-16 (Day 5 23시 슬롯, 2026-04-30) — F-15 자동 발언 스케줄 UI 골격.
 *     · 본 슬롯에서는 타입 + IndexedDB 스키마만 정의. 실 cron 트리거는 D11+ Vercel Cron 박은 후.
 *     · Do 페이지 핵심 명세: "매 정각/30분/시간 단위" → 3가지 frequency kind 정의.
 *
 * frequency kind 분기:
 *   - "every-minutes" — N분마다 (5/10/15/30/60). 단순 폴링용.
 *   - "hourly-at"     — 매 시간 N분(0~59). 예: 30분마다 똘이가 새 의견 (Do 명세 예시).
 *   - "daily-at"      — 매일 HH:MM(0~23 / 0~59). 정확한 일일 스케줄.
 *
 * 안정성 가드 (D11+ 트리거 박힐 때 적용 예정 — 본 슬롯에서는 스키마만):
 *   - 1일 max 호출 횟수 (B-28 명세) — 별도 store에서 일별 카운터 박을 것.
 *   - 비용 임계값 도달 시 자동 정지 — usage-store 통합 박을 것.
 */

export type ScheduleFrequency =
  | { kind: "every-minutes"; minutes: number }
  | { kind: "hourly-at"; minute: number }
  | { kind: "daily-at"; hour: number; minute: number };

export interface ScheduleRule {
  id: string;
  participantId: string;
  frequency: ScheduleFrequency;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** every-minutes 허용 분 단위 (Do 페이지 명세: "매 10분마다"). */
export const ALLOWED_EVERY_MINUTES = [5, 10, 15, 30, 60] as const;

/** 사람이 읽기 쉬운 frequency 라벨 도출. UI에서 list 표시용. */
export function describeFrequency(f: ScheduleFrequency): string {
  if (f.kind === "every-minutes") return `매 ${f.minutes}분마다`;
  if (f.kind === "hourly-at") {
    const mm = String(f.minute).padStart(2, "0");
    return `매 시간 :${mm}`;
  }
  const hh = String(f.hour).padStart(2, "0");
  const mm = String(f.minute).padStart(2, "0");
  return `매일 ${hh}:${mm}`;
}

/** ScheduleRule validation — 잘못된 입력은 리젝트(throw 대신 boolean). */
export function isValidFrequency(f: ScheduleFrequency): boolean {
  if (f.kind === "every-minutes") {
    return (ALLOWED_EVERY_MINUTES as readonly number[]).includes(f.minutes);
  }
  if (f.kind === "hourly-at") {
    return Number.isInteger(f.minute) && f.minute >= 0 && f.minute <= 59;
  }
  if (f.kind === "daily-at") {
    return (
      Number.isInteger(f.hour) &&
      f.hour >= 0 &&
      f.hour <= 23 &&
      Number.isInteger(f.minute) &&
      f.minute >= 0 &&
      f.minute <= 59
    );
  }
  return false;
}
