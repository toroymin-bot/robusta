#!/usr/bin/env node
/**
 * extract-insight-candidates.mjs
 *   - C-D70-2 ⭐ (D+2 11시 §6 슬롯, 2026-05-10) — Tori spec C-D70-2 (§1.6).
 *
 * Why: F-D70-2 / B-D70-2 (Insight Receipt) 데이터 파이프라인 전제.
 *   read-only 통찰 후보 추출. 휴리스틱 5조건 점수화 (각 +1, 최대 5).
 *   외부 fetch 0건 / Dexie 미접근.
 *
 * 자율 정정 큐 (D-70-자-2):
 *   환경 변수 INSIGHT_MIN_SCORE 으로 minScore override 가능 (디폴트 3 보존).
 *
 * 함수 시그니처 (named export, §1.6 본체 lock 정합):
 *   extractInsightCandidates({ roomId, messages, minScore })
 *     -> { candidates: [{ id, score, reasons, speakerId }], totalScored }
 *
 *     - roomId:   string (방 식별자, 출력에는 직접 포함 안 됨, 호출자 추적용)
 *     - messages: Array<{ id, speakerId, text, ts }>
 *     - minScore: int, default process.env.INSIGHT_MIN_SCORE || 3
 *
 * 휴리스틱 점수 (각 +1, 최대 5):
 *   1) text.length ≥ 200 자
 *   2) 직전 메시지에 '?' 포함 + 본 메시지 길이 ≥ 100 (질문-응답 쌍)
 *   3) 대립 표현 포함 (/하지만|반면|그러나|however|but/ 정규식)
 *   4) 숫자 포함 (정량 근거, /\d/ 정규식)
 *   5) 본 발화자 ≠ 직전 발화자 ≠ 직전직전 발화자 (3자 이상 충돌)
 *
 * 출력 (§1.6):
 *   candidates    score >= minScore 인 메시지만
 *     - id        메시지 id
 *     - score     0∼5 정수
 *     - reasons   ['length>=200', 'qa-pair:msg-X', 'contradicts', 'contains-number', '3-speaker-rotation']
 *     - speakerId 발화자
 *   totalScored   전체 메시지 수 (필터 전)
 *
 * 엣지 케이스:
 *   1) messages 빈 배열 → candidates=[], totalScored=0
 *   2) speakerId / text / id 누락 → 무시 (점수 0 처리, 필터 통과 X)
 *   3) minScore 음수/비숫자 → 디폴트 3 사용
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const DEFAULT_MIN_SCORE = 3;

function envMinScore() {
  const v = process.env.INSIGHT_MIN_SCORE;
  if (typeof v === "string" && v.length > 0) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_MIN_SCORE;
}

function isString(x) {
  return typeof x === "string" && x.length > 0;
}

function scoreMessage(msg, prev, prev2) {
  const reasons = [];
  let score = 0;

  if (typeof msg.text !== "string") return { score: 0, reasons };

  // 1) length >= 200
  if (msg.text.length >= 200) {
    score++;
    reasons.push("length>=200");
  }

  // 2) qa-pair: prev contains '?' && current length >= 100
  if (prev && typeof prev.text === "string" && prev.text.includes("?") && msg.text.length >= 100) {
    score++;
    reasons.push(`qa-pair:${prev.id ?? "prev"}`);
  }

  // 3) contradiction
  if (/하지만|반면|그러나|however|but/i.test(msg.text)) {
    score++;
    reasons.push("contradicts");
  }

  // 4) contains number
  if (/\d/.test(msg.text)) {
    score++;
    reasons.push("contains-number");
  }

  // 5) 3-speaker rotation: speaker !== prev.speaker !== prev2.speaker
  if (
    prev &&
    prev2 &&
    isString(msg.speakerId) &&
    isString(prev.speakerId) &&
    isString(prev2.speakerId) &&
    msg.speakerId !== prev.speakerId &&
    prev.speakerId !== prev2.speakerId &&
    msg.speakerId !== prev2.speakerId
  ) {
    score++;
    reasons.push("3-speaker-rotation");
  }

  return { score, reasons };
}

export function extractInsightCandidates(opts) {
  const o = opts || {};
  const messages = Array.isArray(o.messages) ? o.messages : [];
  const minScore = typeof o.minScore === "number" && Number.isFinite(o.minScore) && o.minScore >= 0
    ? o.minScore
    : envMinScore();

  const candidates = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || !isString(msg.id) || !isString(msg.speakerId) || typeof msg.text !== "string") {
      continue;
    }
    const prev = i >= 1 ? messages[i - 1] : null;
    const prev2 = i >= 2 ? messages[i - 2] : null;
    const { score, reasons } = scoreMessage(msg, prev, prev2);
    if (score >= minScore) {
      candidates.push({
        id: msg.id,
        score,
        reasons,
        speakerId: msg.speakerId,
      });
    }
  }

  return {
    candidates,
    totalScored: messages.length,
  };
}

function main() {
  // CLI: stdin JSON {roomId, messages, minScore?} 또는 --file=path
  const fileArg = process.argv.find((x) => x.startsWith("--file="));
  let input;
  try {
    if (fileArg) {
      const path = fileArg.slice("--file=".length);
      const raw = require("node:fs").readFileSync(path, "utf8");
      input = JSON.parse(raw);
    } else {
      // stdin 읽기 시도. 비어 있으면 빈 배열.
      const stdinBuf = readStdinSync();
      input = stdinBuf.length > 0 ? JSON.parse(stdinBuf) : { messages: [] };
    }
  } catch (e) {
    console.error(`extract:insight-candidates ERROR: ${e.message}`);
    process.exit(1);
  }
  const result = extractInsightCandidates(input);
  console.log(JSON.stringify(result));
  process.exit(0);
}

function readStdinSync() {
  try {
    return require("node:fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
