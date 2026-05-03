"use client";

/**
 * d-day-checklist.tsx
 *   C-D34-5 (D-5 23시 슬롯, 2026-05-03) — Tori spec C-D34-5
 *     (B-D31-1 (c) + B-D34-3 + B-D34-5 + F-D34-5 + D-D34-4).
 *
 * Why: D-Day 운영 R&R 확정 의무 (B-D32-5 (c)) — Roy/똘이/꼬미가 5/5∼5/8 매 시점에서
 *   해야 할 액션을 단일 페이지에 명시. /qatest 페이지에 섹션 1개 추가 (D-D34-4 (c)).
 *
 * 정책:
 *   - read-only static list — 상태 0, 외부 의존 0.
 *   - 5 항목 (Confluence Roadmap §6 정합):
 *     (1) D-3(5/5) 18시 KQ_23 fallback 발동 검증
 *     (2) D-2(5/6) BYOK 시연(Roy) + 시뮬레이션(꼬미)
 *     (3) D-2 카피 최종 (한/영)
 *     (4) D-1(5/7) Production 배포 점검 + D-Day 24h R&R 확정
 *     (5) D-Day(5/8) 10:00 KST 라이브 + Hero LIVE 전환 + Roy 1회 알림
 *   - i18n ko/en parity 5키.
 *
 * 보존 13 영향: 0 (신규 모듈). /qatest/page.tsx 는 보존 13 대상 아님 (D-Day 라이브 시 hidden 의무).
 */

import { t } from "@/modules/i18n/messages";

export interface ChecklistItem {
  id: string;
  labelKey:
    | "qatest.checklist.d3"
    | "qatest.checklist.d2demo"
    | "qatest.checklist.d2copy"
    | "qatest.checklist.d1"
    | "qatest.checklist.dday";
  deadline: string;
}

const ITEMS: ReadonlyArray<ChecklistItem> = [
  { id: "d3", labelKey: "qatest.checklist.d3", deadline: "2026-05-05 18:00 KST" },
  {
    id: "d2demo",
    labelKey: "qatest.checklist.d2demo",
    deadline: "2026-05-06",
  },
  {
    id: "d2copy",
    labelKey: "qatest.checklist.d2copy",
    deadline: "2026-05-06",
  },
  { id: "d1", labelKey: "qatest.checklist.d1", deadline: "2026-05-07" },
  {
    id: "dday",
    labelKey: "qatest.checklist.dday",
    deadline: "2026-05-08 10:00 KST",
  },
];

export function DDayChecklist() {
  return (
    <section data-test="d-day-checklist" className="mt-6 space-y-2">
      <h2 className="text-base font-semibold">D-Day Launch Checklist</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {ITEMS.map((item) => (
          <li key={item.id} data-test={`d-day-checklist-${item.id}`}>
            <span className="font-medium">{item.deadline}</span> —{" "}
            {t(item.labelKey)}
          </li>
        ))}
      </ul>
    </section>
  );
}
