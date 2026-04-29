/**
 * D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: 헤더 모드 라벨 동적 회전 (F-D16-1).
 *   똘이 v12 §24.3 web_fetch 검증으로 헤더 라벨 "Day 3" 정적 결함 발견.
 *   Roadmap MVP 5일 기준 D-Day 자동 계산 + Live 전/후 모드 분기.
 *
 *   기준일: 2026-04-26 00:00 KST = Day 1
 *   D5 라이브 시점부터 mode = 'Live', 이전은 'Manual'.
 *   D < 1 → Day 1 clamp / D > 5 → Day 5 clamp.
 *
 *   추정 #93 (꼬미 v13): SSR/CSR hydration mismatch 위험 → 호출자가 'use client' + useEffect 박을 것.
 */

export type RoadmapMode = "Manual" | "Live";

export interface RoadmapDayInfo {
  /** 1..5 clamp */
  day: number;
  /** D5+ → Live, 이전은 Manual */
  mode: RoadmapMode;
}

/**
 * Roadmap 시작점: 2026-04-26 00:00 KST (UTC+9).
 *   ISO offset로 박아 timezone-agnostic.
 */
const ROADMAP_START_MS = new Date("2026-04-26T00:00:00+09:00").getTime();
const DAY_MS = 86_400_000;
const MIN_DAY = 1;
const MAX_DAY = 5;

/**
 * 현재 시각 기준 Roadmap D-Day와 Mode 반환.
 *   서버/클라 hydration mismatch 위험 — 호출자가 클라 시점 useEffect로 한 번 더 set.
 *   초기 SSR 폴백은 호출자 책임 (D5 라이브 시점 정합 = 'Day 5 · Live').
 *
 * @param now 테스트용 시각 주입 (기본 = new Date())
 */
export function getRoadmapDay(now: Date = new Date()): RoadmapDayInfo {
  const diffDays = Math.floor((now.getTime() - ROADMAP_START_MS) / DAY_MS) + 1;
  const day = Math.max(MIN_DAY, Math.min(MAX_DAY, diffDays));
  const mode: RoadmapMode = day >= MAX_DAY ? "Live" : "Manual";
  return { day, mode };
}

/** "Day 4 · Manual" 형식 단일 라벨 본문. */
export function formatRoadmapLabel(info: RoadmapDayInfo): string {
  return `Day ${info.day} · ${info.mode}`;
}
