#!/usr/bin/env node
/**
 * check-slot-gap.mjs
 *   - C-D62-2 (D-Day 19시 슬롯 §10, 2026-05-08) — Tori spec C-D62-2 (B-D62-1 / F-D62-1 본체).
 *
 * Why: Confluence Task_YYYY-MM-DD 페이지의 §N OCP append 누락 detect read-only.
 *   §5∼§8 GAP (5/8 09시∼15시) 재발 방지 SoP. 외부 fetch 0건 모드(미시뮬) 또는
 *   --token 지정 시 Atlassian REST API GET v1 content/<id>/history?expand=...
 *   호출 — 본 도구는 page body 텍스트 파라미터로도 입력 가능하여 ad-hoc CI 모드 지원.
 *
 *   가시 변화 0/20 정합 (read-only / src/ 미접근 / Dexie 미접근).
 *
 * 함수 시그니처 (export):
 *   checkSlotGap({ body?, expectSlots, slotPattern? }) -> { ok, expectSlots, foundSlots, gapSlots, source }
 *
 *   - body: 페이지 markdown 또는 HTML. 미지정 시 source='UNRESOLVED' 반환 (CLI 시뮬 모드).
 *   - expectSlots: 1∼12 정수. KST 시각 기반 산출 — D-Day 똘이 1·5·9·13·17·21시 (홀수 §)
 *                  + 꼬미 3·7·11·15·19·23시 (짝수 §) 12 슬롯 풀.
 *   - slotPattern: 선택. 기본값 /^\s*##\s+(\d+)\.\s+/m + 헤더 텍스트에서 §N 또는 슬롯 토큰 추출.
 *
 *   반환:
 *     ok=true  ↔ gapSlots 빈 배열 (1..expectSlots 모두 발견)
 *     ok=false ↔ gapSlots 비어있지 않음
 *     source: 'BODY' | 'UNRESOLVED' (body 미지정)
 *
 * 입력 가드:
 *   - expectSlots 누락 또는 NaN 또는 1 미만 또는 12 초과 → throw RangeError
 *
 * 사용 (CLI):
 *   $ node scripts/check-slot-gap.mjs --expect-slots=10
 *   $ node scripts/check-slot-gap.mjs --expect-slots=10 --body-file=/tmp/task.md
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIN_SLOTS = 1;
const MAX_SLOTS = 12;

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    expectSlots: get("expect-slots"),
    bodyFile: get("body-file"),
    taskPage: get("task-page"),
  };
}

/**
 * extractSlotNumbers — body 텍스트에서 §N 또는 H2 헤더 (## N. ...) 추출.
 *   1..MAX_SLOTS 범위 정수만. 중복 제거 + 오름차순.
 *
 *   2 패턴 union:
 *     P1: H2 헤더 — `^##\s+(\d+)\.\s` 캡처 그룹 1.
 *     P2: §N 토큰 — `§(\d+)` 캡처 그룹 1.
 *
 *   본 사이트 hub Task 페이지 패턴 (## 11. 꼬미 §2 슬롯 처리 결과 ...) +
 *   child 페이지 내부 §N 인용 (## 0. 슬롯 산출 요약 / ## 1. 꼬미 §4 ...) 모두 흡수.
 */
function extractSlotNumbers(body) {
  const found = new Set();
  const lines = body.split("\n");
  const RX_HEAD = /^##\s+(\d+)\.\s/;
  const RX_SECT = /§(\d+)/g;
  for (const line of lines) {
    const mh = RX_HEAD.exec(line);
    if (mh) {
      const n = Number(mh[1]);
      if (Number.isInteger(n) && n >= MIN_SLOTS && n <= MAX_SLOTS) {
        found.add(n);
      }
    }
    let ms;
    while ((ms = RX_SECT.exec(line)) !== null) {
      const n = Number(ms[1]);
      if (Number.isInteger(n) && n >= MIN_SLOTS && n <= MAX_SLOTS) {
        found.add(n);
      }
    }
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * checkSlotGap — read-only / 외부 fetch 0건.
 */
export function checkSlotGap({ body, expectSlots, slotPattern } = {}) {
  const expect = Number(expectSlots);
  if (!Number.isInteger(expect) || expect < MIN_SLOTS || expect > MAX_SLOTS) {
    throw new RangeError(
      `--expect-slots out of range [${MIN_SLOTS},${MAX_SLOTS}]`,
    );
  }

  if (typeof body !== "string" || body.length === 0) {
    return {
      ok: false,
      expectSlots: expect,
      foundSlots: [],
      gapSlots: [],
      source: "UNRESOLVED",
      reason: "body missing — pass --body-file=<path> for actual GAP detection",
    };
  }

  // slotPattern 인자는 향후 확장용 — 본 v1 에서는 default extractSlotNumbers 만 사용.
  void slotPattern;

  const foundSlots = extractSlotNumbers(body);
  const gapSlots = [];
  for (let n = 1; n <= expect; n++) {
    if (!foundSlots.includes(n)) gapSlots.push(n);
  }
  const ok = gapSlots.length === 0;
  return {
    ok,
    expectSlots: expect,
    foundSlots,
    gapSlots,
    source: "BODY",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let body;
  if (args.bodyFile) {
    try {
      body = readFileSync(resolve(process.cwd(), args.bodyFile), "utf8");
    } catch (e) {
      console.error(`failed to read --body-file: ${e.message ?? e}`);
      process.exit(2);
    }
  }
  let result;
  try {
    result = checkSlotGap({ body, expectSlots: args.expectSlots });
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  console.log(JSON.stringify({ slotGap: result }));
  console.log(
    `check:slot-gap ok=${result.ok} found=${result.foundSlots.length} gap=${result.gapSlots.length}`,
  );
  // source=UNRESOLVED 는 GAP detect 의무 별도 — exit 0 (read-only ad-hoc 모드).
  if (result.source === "UNRESOLVED") {
    process.exit(0);
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
