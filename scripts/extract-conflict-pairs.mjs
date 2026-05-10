#!/usr/bin/env node
/**
 * extract-conflict-pairs.mjs
 *   - C-D71-2 ⭐ (D+2 19시 §4 슬롯 자율 진입, 2026-05-10) — Tori spec C-D71-2 (§6.5).
 *
 * Why: F-D71-2 / DG-D71-2 (충돌 인디케이터 / 충돌 마크) 데이터 파이프라인 전제.
 *   read-only 충돌 짝 추출. 휴리스틱 3조건 점수화 (각 +1, 최대 3).
 *   외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-71-자-2):
 *   환경 변수 CONFLICT_MAX_LOOKBACK 으로 maxLookback override 가능 (디폴트 5 보존).
 *
 * 함수 시그니처 (named export, §6.5 본체 lock 정합):
 *   extractConflictPairs({ roomId, messages, maxLookback })
 *     -> { pairs: [{ aId, bId, score, reasons }], totalScanned }
 *
 *     - roomId:      string (방 식별자, 출력에는 직접 포함 안 됨, 호출자 추적용)
 *     - messages:    Array<{ id, speakerId, text, ts }>
 *     - maxLookback: int, default process.env.CONFLICT_MAX_LOOKBACK || 5
 *
 * 휴리스틱 점수 (각 +1, 최대 3):
 *   1) b.text 에 대립 표현 포함 (/하지만|반면|그러나|however|but|disagree|반대/i)
 *   2) a.speakerId !== b.speakerId (서로 다른 발화자)
 *   3) b 인덱스 - a 인덱스 ≤ maxLookback (인접 충돌)
 *
 * 출력 (§6.5):
 *   pairs        score >= 1 인 (a,b) 쌍 (b 가 대립 표현을 가진 측)
 *     - aId       선행 메시지 id
 *     - bId       대립 표현을 가진 후행 메시지 id
 *     - score     0∼3 정수
 *     - reasons   ['contradicts', 'cross-speaker', 'within-lookback']
 *   totalScanned 전체 메시지 수
 *
 * 엣지 케이스:
 *   1) messages 1건 이하 → pairs=[], totalScanned=N
 *   2) speakerId / text / id 누락 → 무시 (점수 미부여)
 *   3) maxLookback 음수/비숫자 → 디폴트 5 사용
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const DEFAULT_MAX_LOOKBACK = 5;
const CONTRADICTION_RE = /하지만|반면|그러나|however|but|disagree|반대/i;

function envMaxLookback() {
  const v = process.env.CONFLICT_MAX_LOOKBACK;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return DEFAULT_MAX_LOOKBACK;
}

function isString(x) {
  return typeof x === "string" && x.length > 0;
}

function isValidMsg(m) {
  return m && isString(m.id) && isString(m.speakerId) && typeof m.text === "string";
}

export function extractConflictPairs(opts) {
  const o = opts || {};
  const messages = Array.isArray(o.messages) ? o.messages : [];
  const maxLookback = typeof o.maxLookback === "number" && Number.isFinite(o.maxLookback) && o.maxLookback >= 1
    ? o.maxLookback
    : envMaxLookback();

  const pairs = [];

  for (let i = 1; i < messages.length; i++) {
    const b = messages[i];
    if (!isValidMsg(b)) continue;
    if (!CONTRADICTION_RE.test(b.text)) continue;

    // b 는 대립 표현 보유. a 후보를 i-1 에서부터 i-maxLookback 까지 역방향 탐색.
    for (let j = i - 1; j >= 0 && i - j <= maxLookback; j--) {
      const a = messages[j];
      if (!isValidMsg(a)) continue;

      const reasons = [];
      let score = 0;

      // 1) b 대립 표현 (이미 충족)
      score++;
      reasons.push("contradicts");

      // 2) cross-speaker
      if (a.speakerId !== b.speakerId) {
        score++;
        reasons.push("cross-speaker");
      }

      // 3) within lookback
      if (i - j <= maxLookback) {
        score++;
        reasons.push("within-lookback");
      }

      pairs.push({
        aId: a.id,
        bId: b.id,
        score,
        reasons,
      });

      // 가장 가까운 a 1건만 페어링 (다중 폭발 방지).
      break;
    }
  }

  return {
    pairs,
    totalScanned: messages.length,
  };
}

function main() {
  // CLI: stdin JSON {roomId, messages, maxLookback?} 또는 --file=path
  const fileArg = process.argv.find((x) => x.startsWith("--file="));
  let input;
  try {
    if (fileArg) {
      const path = fileArg.slice("--file=".length);
      const raw = readStdinOrFileSync(path);
      input = JSON.parse(raw);
    } else {
      const stdinBuf = readStdinOrFileSync(null);
      input = stdinBuf.length > 0 ? JSON.parse(stdinBuf) : { messages: [] };
    }
  } catch (e) {
    console.error(`extract:conflict-pairs ERROR: ${e.message}`);
    process.exit(1);
  }
  const result = extractConflictPairs(input);
  console.log(JSON.stringify(result));
  process.exit(0);
}

function readStdinOrFileSync(path) {
  try {
    const fs = require("node:fs");
    if (path) return fs.readFileSync(path, "utf8");
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
