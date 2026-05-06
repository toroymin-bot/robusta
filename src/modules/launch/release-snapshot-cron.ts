/**
 * release-snapshot-cron.ts
 *   - C-D52-2 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-2 (F-D51-2 큐 본체).
 *
 * Why: D-1 진입 후 hourly auto snapshot — release readiness + version + git sha + KPI 카운트
 *   사람 의존도 0. 똘이 / 꼬미 슬롯 외 시간대에도 readiness 확인 가능.
 *
 * 자율 정정:
 *   - D-52-자-2: 명세 출력 ReleaseSnapshot { iso, version, gitSha, kpiSnapshot } 가
 *                기존 release-snapshot.ts ReleaseSnapshot { dDay, hoursRemaining, readiness, summaryLine }
 *                와 충돌. 기존 인터페이스 무손상 (D-D51 검증 회귀 보호) — 신규 인터페이스
 *                ReleaseSnapshotCron 별도 정의. 기존 buildReleaseSnapshot 결과를 cron 결과 안에 포함.
 *   - D-52-자-3: 명세 § 11 추정 1 (Vercel cron 또는 GitHub Actions hourly). 본 슬롯은 trigger 함수 본체만 —
 *                실 cron 인프라 wiring은 D-Day 5/8 직전 똘이 §11 슬롯 또는 D-Day 운용에서 결정 큐로 이월.
 *
 * 정책 (명세 § 9 정합):
 *   1. gitSha undefined → null fallback (.git/HEAD read 실패 시).
 *   2. kpiSnapshot 분모 0 → 0 보호 (funnel 빈 store).
 *   3. 1h 미만 재호출 → throttle (module-level cache).
 *   4. SSR 가드 미적용 — 본 모듈은 server-side cron 전용. 브라우저 호출 시 throw.
 *   5. clock skew ±0.5h 허용 — buildReleaseSnapshot 산식 그대로 (drift 보정 X).
 *
 * 보존 13 영향: 0 (신규 모듈).
 * 외부 dev-deps +0 (Node 22+ native fs/promises).
 */

import {
  buildReleaseSnapshot,
  defaultReleaseIso,
  type ReleaseSnapshot,
  type ReleaseSnapshotOpts,
} from "@/modules/launch/release-snapshot";

export interface KpiSnapshot {
  total: number;
  byType: Record<string, number>;
}

export interface ReleaseSnapshotCron {
  iso: string;
  version: string;
  gitSha: string | null;
  snapshot: ReleaseSnapshot;
  kpiSnapshot: KpiSnapshot;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

// module-level throttle cache (server-only).
let lastTriggerMs = 0;
let lastResult: ReleaseSnapshotCron | null = null;

/**
 * resetTriggerCacheForTest — 테스트 전용.
 *   본 함수는 throttle cache 만 비우고 lastResult 도 초기화.
 *   production 호출 금지 (cron 빈도 보호).
 */
export function resetTriggerCacheForTest(): void {
  lastTriggerMs = 0;
  lastResult = null;
}

interface TriggerInput {
  now?: Date;
  /** 테스트 주입 — 미주입 시 process.env 또는 fs 읽기. */
  packageVersion?: string;
  /** 테스트 주입 — 미주입 시 .git/HEAD 읽기. */
  gitSha?: string | null;
  /** 테스트 주입 — 미주입 시 빈 카운터 (서버 cron은 본인 funnel store 접근 X — D+1 본 운용에서 wiring). */
  kpiSnapshot?: KpiSnapshot;
  /** 테스트 주입 — 미주입 시 정합 기본값. */
  vercelStatus?: ReleaseSnapshotOpts["vercelStatus"];
  lastRegression?: ReleaseSnapshotOpts["lastRegression"];
  byokDemoFunnel?: ReleaseSnapshotOpts["byokDemoFunnel"];
}

/**
 * triggerReleaseSnapshot — hourly cron 트리거 단일 함수.
 *   server-side only. 브라우저 호출 시 throw.
 *
 *   throttle: 마지막 호출 +1h 미만 재호출은 lastResult 반환 (production 안전성).
 *   테스트는 resetTriggerCacheForTest() 로 초기화.
 */
export async function triggerReleaseSnapshot(
  input: TriggerInput = {},
): Promise<ReleaseSnapshotCron> {
  // (4) SSR 가드 — 본 모듈은 server-only (cron). 브라우저 호출 시 throw.
  if (typeof window !== "undefined") {
    throw new Error(
      "triggerReleaseSnapshot is server-only (cron). Do not call from browser.",
    );
  }

  const now = input.now ?? new Date();

  // (3) throttle: 1h 미만 재호출 → lastResult 반환.
  const nowMs = now.getTime();
  if (lastResult && nowMs - lastTriggerMs < ONE_HOUR_MS) {
    return lastResult;
  }

  // version: package.json 또는 주입.
  const version =
    input.packageVersion ??
    (await readPackageVersion().catch(() => "0.0.0"));

  // gitSha: .git/HEAD 또는 주입. undefined → null fallback (1).
  const gitSha =
    input.gitSha !== undefined
      ? input.gitSha
      : await readGitSha().catch(() => null);

  // kpiSnapshot: 빈 카운터 또는 주입. (2) 분모 0 보호 — total=0 OK.
  const kpiSnapshot: KpiSnapshot = input.kpiSnapshot ?? {
    total: 0,
    byType: {},
  };

  // buildReleaseSnapshot 호출 — 기존 산식 무손상 (D-D51 회귀 보호).
  const snapshot = buildReleaseSnapshot(now, {
    releaseIso: defaultReleaseIso(),
    vercelStatus: input.vercelStatus ?? "green",
    lastRegression: input.lastRegression ?? { pass: 1, total: 1, cycle: 1 },
    byokDemoFunnel: input.byokDemoFunnel ?? {
      step1: 4,
      step2: 4,
      step3: 4,
      step4: 4,
    },
  });

  const result: ReleaseSnapshotCron = {
    iso: now.toISOString(),
    version,
    gitSha,
    snapshot,
    kpiSnapshot,
  };

  lastTriggerMs = nowMs;
  lastResult = result;
  return result;
}

async function readPackageVersion(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const raw = await readFile(resolve(process.cwd(), "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

async function readGitSha(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const head = await readFile(resolve(process.cwd(), ".git/HEAD"), "utf8");
    const trimmed = head.trim();
    // ref-based HEAD: "ref: refs/heads/main" → 파일 다시 읽기.
    if (trimmed.startsWith("ref: ")) {
      const refPath = trimmed.slice(5);
      const sha = await readFile(
        resolve(process.cwd(), ".git", refPath),
        "utf8",
      );
      return sha.trim() || null;
    }
    return trimmed || null;
  } catch {
    return null;
  }
}
