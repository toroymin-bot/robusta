/**
 * release-snapshot.ts
 *   - C-D51-1 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-1 (F-D51-2 wiring).
 *
 * Why: D-1 진입 직전(5/6 EOD) auto hourly snapshot — release readiness 단일 함수.
 *   사람 의존도 감소 = D-Day 안정성 자산. 외부 의존 0 (순수 함수).
 *
 * 자율 정정:
 *   - D-51-자-1: 명세 경로 'src/lib/release-snapshot.ts' 추정 — 실 src/lib 디렉토리 부재.
 *                launch 모듈 단일 책임 정합으로 'src/modules/launch/release-snapshot.ts'.
 *                D-46-자-1 settings/page 추정 → 실 단일 책임 패턴 정합.
 *
 * 정책:
 *   - releaseIso 미설정 → readiness='red' + summary='RELEASE_ISO 미설정' (보존).
 *   - hoursRemaining ≤ 0 → dDay='D+1' (post-launch 분기).
 *   - lastRegression.pass < total → readiness='red' (회귀 fail 우선).
 *   - vercelStatus='red' → readiness='red' (vercel fail 우선).
 *   - byokDemoFunnel.step4 < 4 → readiness='yellow' (시연 미완).
 *   - 모든 조건 정합 → readiness='green'.
 *   - Date 비교 timezone UTC 고정 (Date.getTime() 정합).
 *
 * 보존 13 영향: 0 (신규 모듈, 보존 13 미포함).
 */

import { RELEASE_ISO } from "@/modules/dday/dday-config";

export interface ReleaseSnapshotOpts {
  releaseIso: string | null;
  vercelStatus: "green" | "yellow" | "red";
  lastRegression: { pass: number; total: number; cycle: number };
  byokDemoFunnel: { step1: number; step2: number; step3: number; step4: number };
}

export type DDay = "D-2" | "D-1" | "D-0" | "D+1";
export type Readiness = "green" | "yellow" | "red";

export interface ReleaseSnapshot {
  dDay: DDay;
  hoursRemaining: number;
  readiness: Readiness;
  summaryLine: string;
}

const HOUR_MS = 60 * 60 * 1000;

function computeDDay(hoursRemaining: number): DDay {
  // D-0: 라이브 도달 후 1h 이내 (release ≤ now < release+1h).
  // D+1: 라이브 후 1h 초과 (now ≥ release+1h).
  // D-1: 0 < hoursRemaining ≤ 24h.
  // D-2: 24h < hoursRemaining (D-Day 5/8 직전 — 명세 4 enum 한계, D-3 이상은 D-2로 fallback).
  if (hoursRemaining <= -1) return "D+1";
  if (hoursRemaining <= 0) return "D-0";
  if (hoursRemaining <= 24) return "D-1";
  return "D-2";
}

/**
 * buildReleaseSnapshot — D-1 진입 직전 release readiness 1 함수.
 *   순수 함수 (외부 부수효과 0). cron 트리거에서 1시간마다 호출.
 *
 *   readiness 우선순위:
 *     1. releaseIso 미설정 → red
 *     2. vercelStatus='red' → red
 *     3. lastRegression.pass < total → red
 *     4. byokDemoFunnel.step4 < 4 → yellow
 *     5. 그 외 → green
 *
 *   summaryLine 형식:
 *     'D-{N} {N}h · regression {pass}/{total} · vercel {status} · BYOK {step4}/4 · readiness {READINESS}'
 */
export function buildReleaseSnapshot(
  now: Date,
  opts: ReleaseSnapshotOpts,
): ReleaseSnapshot {
  if (!opts.releaseIso) {
    return {
      dDay: "D-2",
      hoursRemaining: 0,
      readiness: "red",
      summaryLine: "RELEASE_ISO 미설정",
    };
  }

  const release = new Date(opts.releaseIso);
  const diffMs = release.getTime() - now.getTime();
  const hoursRemaining = Math.ceil(diffMs / HOUR_MS);
  const dDay = computeDDay(hoursRemaining);

  let readiness: Readiness = "green";
  if (opts.vercelStatus === "red") {
    readiness = "red";
  } else if (opts.lastRegression.pass < opts.lastRegression.total) {
    readiness = "red";
  } else if (opts.byokDemoFunnel.step4 < 4) {
    readiness = "yellow";
  }

  const hoursAbs = Math.max(0, hoursRemaining);
  const summaryLine =
    `${dDay} ${hoursAbs}h · regression ${opts.lastRegression.pass}/${opts.lastRegression.total}` +
    ` · vercel ${opts.vercelStatus} · BYOK ${opts.byokDemoFunnel.step4}/4` +
    ` · readiness ${readiness.toUpperCase()}`;

  return { dDay, hoursRemaining, readiness, summaryLine };
}

/**
 * RELEASE_ISO SoT 직접 import — D-44-자-1 패턴 정합 (dday-config.ts 단일 진실).
 *   외부 호출자가 releaseIso 미주입 시 fallback.
 */
export function defaultReleaseIso(): string {
  return RELEASE_ISO;
}
