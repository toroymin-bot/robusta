"use client";

/**
 * cron-preview-chip.tsx
 *   C-D32-5 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-5 (F-D32-5 / D-D32-4).
 *   Custom cron 미리보기 chip — human-readable 텍스트 + next fire 시각.
 *
 *   꼬미 자율 결정:
 *     - 외부 의존 0 (cronstrue ~3 kB 미도입). 자체 cron→human 변환 함수.
 *     - 지원 패턴: '슬래시N * * * *' (N분마다), 'M H * * *' (매일 H시 M분),
 *       'M H D * *' (매월 D일 H시 M분). 그 외는 invalid chip fallback.
 *       (Phase 2 SDK 도입 시 확장)
 *     - next fire 시각은 5필드 cron 한정 — 단순 매칭 (현재 분 +1 부터 60분 내 첫 매치).
 *     - tz default Asia/Seoul (KST). Intl.DateTimeFormat 으로 표시.
 */

import { t } from "@/modules/i18n/messages";

export interface CronPreviewChipProps {
  cron: string;
  /** 예약: 현재는 Asia/Seoul 단일. 향후 사용자 timezone 설정 wiring. */
  tz?: string;
}

/**
 * cron 5필드 → human-readable.
 *   리턴 null 이면 invalid (호출자가 fallback chip 표시).
 */
export function cronToHuman(cron: string): string | null {
  const trimmed = cron.trim();
  if (trimmed.length === 0) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, mon, dow] = parts;

  // 패턴 1: */N * * * * (N분마다)
  const everyN = /^\*\/(\d+)$/.exec(min);
  if (
    everyN &&
    hour === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    const n = Number(everyN[1]);
    if (n >= 1 && n <= 59) return `${n}분마다`;
  }

  // 패턴 2: M H * * * (매일 H시 M분)
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    const m = Number(min);
    const h = Number(hour);
    if (m >= 0 && m <= 59 && h >= 0 && h <= 23) {
      return `매일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // 패턴 3: M H D * * (매월 D일 H시 M분)
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    /^\d+$/.test(dom) &&
    mon === "*" &&
    dow === "*"
  ) {
    const m = Number(min);
    const h = Number(hour);
    const d = Number(dom);
    if (m >= 0 && m <= 59 && h >= 0 && h <= 23 && d >= 1 && d <= 31) {
      return `매월 ${d}일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * 다음 발화 시각 — 60일 이내 첫 매치 epoch ms.
 *   매칭은 매분 0초 단위 — 현재 분 +1 부터 60일(86400분) 스캔.
 *   60일 이내 매치 0건 → null.
 */
export function nextFireMs(cron: string, now: number = Date.now()): number | null {
  const human = cronToHuman(cron);
  if (human === null) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, domStr] = parts;

  const startMin = Math.ceil(now / 60_000) * 60_000;
  // 60일 = 86400분. 충분히 큰 스캔 윈도우 — 본 chip 의 미리보기는 보통 24h 안에 첫 매치.
  const maxIters = 86_400;
  for (let i = 0; i < maxIters; i++) {
    const t = startMin + i * 60_000;
    const d = new Date(t);
    const m = d.getMinutes();
    const h = d.getHours();
    const dom = d.getDate();
    // 패턴 1: */N
    const everyN = /^\*\/(\d+)$/.exec(minStr);
    if (everyN && hourStr === "*") {
      const n = Number(everyN[1]);
      if (m % n === 0) return t;
      continue;
    }
    // 패턴 2: M H * * *
    if (domStr === "*") {
      if (m === Number(minStr) && h === Number(hourStr)) return t;
      continue;
    }
    // 패턴 3: M H D * *
    if (
      m === Number(minStr) &&
      h === Number(hourStr) &&
      dom === Number(domStr)
    ) {
      return t;
    }
  }
  return null;
}

function formatNextFire(epoch: number): string {
  const d = new Date(epoch);
  // KST 표시 — Asia/Seoul 고정.
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d);
}

export function CronPreviewChip({ cron }: CronPreviewChipProps) {
  const human = cronToHuman(cron);
  if (human === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-robusta-divider bg-transparent px-2 py-0.5 text-[11px] text-robusta-inkDim">
        <span aria-hidden>⚠</span>
        {t("cronpreview.invalid")}
      </span>
    );
  }
  const next = nextFireMs(cron);
  const tooltip =
    next !== null
      ? `${t("cronpreview.next")}: ${formatNextFire(next)} ${t("cronpreview.tz")}`
      : `${t("cronpreview.next")}: —`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full border border-robusta-divider bg-robusta-accentSoft/30 px-2 py-0.5 text-[11px] text-robusta-ink"
    >
      <span aria-hidden>⏱</span>
      {human}
    </span>
  );
}

export default CronPreviewChip;
