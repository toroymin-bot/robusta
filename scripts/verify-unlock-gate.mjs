#!/usr/bin/env node
/**
 * verify-unlock-gate.mjs — C-META-D77-3 (Tori §3.6 spec / Task_2026-05-12 §3)
 *
 * 3단계 unlock 게이트 verify.
 *   stage1 = 꼬미 trigger 정상 발화 ≥3회
 *   stage2 = 가설 정합도 ≥0.7 LIVE 확정
 *   stage3 = 4 토큰 발급 + read scope
 *   fullUnlock = stage1 && stage2 && stage3
 *   partialUnlock = stage 통과 항목명 배열
 *
 * 외부 dev-deps +0. src/ 변경 0. Confluence write 0.
 */

const REQUIRED_TOKENS = ["confluence", "healthchecks", "github", "anthropic"];

/**
 * @param {object} input
 * @param {number} input.komiCommitCount
 * @param {number} input.hypothesisScore
 * @param {Record<string, boolean>} input.tokensStatus
 * @returns {{ stage1: boolean, stage2: boolean, stage3: boolean, fullUnlock: boolean, partialUnlock: string[] }}
 */
export function verifyUnlockGate({ komiCommitCount, hypothesisScore, tokensStatus }) {
  if (typeof komiCommitCount !== "number" || Number.isNaN(komiCommitCount)) {
    throw new Error("verifyUnlockGate: komiCommitCount required (number)");
  }
  if (typeof hypothesisScore !== "number" || Number.isNaN(hypothesisScore)) {
    throw new Error("verifyUnlockGate: hypothesisScore required (number)");
  }
  if (!tokensStatus || typeof tokensStatus !== "object") {
    throw new Error("verifyUnlockGate: tokensStatus required (object)");
  }

  const stage1 = komiCommitCount >= 3;
  const stage2 = hypothesisScore >= 0.7;
  const stage3 = REQUIRED_TOKENS.every((k) => tokensStatus[k] === true);

  const fullUnlock = stage1 && stage2 && stage3;
  const partialUnlock = [
    stage1 ? "stage1" : null,
    stage2 ? "stage2" : null,
    stage3 ? "stage3" : null,
  ].filter(Boolean);

  return { stage1, stage2, stage3, fullUnlock, partialUnlock };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(`--${k}=`.length) : fallback;
  };
  const komiCommitCount = Number(get("komi-commits", "0"));
  const hypothesisScore = Number(get("hypothesis", "0"));
  const tokensRaw = get("tokens", "confluence:false,healthchecks:false,github:false,anthropic:false");
  const tokensStatus = Object.fromEntries(
    tokensRaw.split(",").map((kv) => {
      const [k, v] = kv.split(":");
      return [k, v === "true"];
    }),
  );
  try {
    const result = verifyUnlockGate({ komiCommitCount, hypothesisScore, tokensStatus });
    console.log(JSON.stringify(result));
    process.exit(result.fullUnlock ? 0 : 1);
  } catch (e) {
    console.error(`verifyUnlockGate error: ${e.message}`);
    process.exit(2);
  }
}
