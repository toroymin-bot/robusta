#!/usr/bin/env node
/**
 * funnel-summary.mjs
 *   C-D33-3 (D-5 19시 슬롯, 2026-05-03) — Tori spec C-D33-3 (F-D33-3 / B-D31-5 (c)).
 *   매 꼬미 슬롯 §1 메타 표 echo 자동화 게이트.
 *
 *   Node 환경 — Dexie/IndexedDB 직접 read 불가. 본 스크립트는:
 *     1) src/modules/funnel/funnel-events.ts 정적 파싱 → FunnelEvent union 'type' 자동 추출
 *     2) byType 0 으로 초기화한 schema 출력 (실 데이터는 브라우저 console 'await listFunnelEvents()' 명령)
 *     3) 출력은 stdout JSON — 호출자(verify-d33 또는 똘이/꼬미 슬롯 §1 echo) 가 schema valid 검증
 *
 *   외부 dev-deps 0 (Node 표준만). 메인 번들 영향 0 (dev-only).
 *
 *   사용:
 *     npm run funnel:summary
 *     → stdout: { "as_of": ISO, "byType": { ... }, "total": N }
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const TARGET = "src/modules/funnel/funnel-events.ts";

async function main() {
  const src = await readFile(resolve(root, TARGET), "utf8");
  // FunnelEvent union 의 'type: "X"' 모두 매칭 — 신규 type 자동 흡수.
  const typeRegex = /type:\s*"([a-zA-Z0-9_]+)"/g;
  const types = new Set();
  let m;
  while ((m = typeRegex.exec(src)) !== null) {
    types.add(m[1]);
  }
  const byType = {};
  for (const t of types) byType[t] = 0;
  const out = {
    as_of: new Date().toISOString(),
    byType,
    total: 0,
    note:
      "Node-only schema scaffold. 실 데이터는 브라우저 console: " +
      "(await import('/_next/static/chunks/...')).listFunnelEvents() — " +
      "또는 application devtools IndexedDB > robusta > funnelEvents.",
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  console.error("[funnel-summary] error:", err);
  process.exit(1);
});
