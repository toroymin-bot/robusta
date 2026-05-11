#!/usr/bin/env node
/**
 * dormant-guard.mjs — C-META-D77-1 ⭐ (Tori §3.6 spec / Task_2026-05-12 §3)
 *
 * 슬롯 entry 시 휴면 모드 lock 검사 + META 보강만 통과.
 *
 * mode='dormant': actions가 'meta-boost' | 'verify'로만 구성된 경우만 allow.
 * mode='emergency': 'new-cycle' 포함 시 차단, 그 외 allow.
 * mode='normal': 항상 allow.
 *
 * 외부 dev-deps +0 (node 표준만). src/ 변경 0. Confluence write 0.
 */

const META_ONLY_ACTIONS = new Set(["meta-boost", "verify"]);
const VALID_MODES = new Set(["normal", "emergency", "dormant"]);
const VALID_SLOT_TYPES = new Set(["tori", "komi"]);

/**
 * @param {object} input
 * @param {string} input.slotId
 * @param {"tori"|"komi"} input.slotType
 * @param {"normal"|"emergency"|"dormant"} [input.mode]
 * @param {string[]} input.actions
 * @returns {{ allowed: boolean, reason: string, recommendedActions: string[] }}
 */
export function dormantGuard({ slotId, slotType, mode = "normal", actions }) {
  if (!slotId || typeof slotId !== "string") {
    throw new Error("dormantGuard: slotId required (string)");
  }
  if (!VALID_SLOT_TYPES.has(slotType)) {
    throw new Error(`dormantGuard: invalid slotType '${slotType}' (expected 'tori'|'komi')`);
  }
  if (!VALID_MODES.has(mode)) {
    throw new Error(`dormantGuard: invalid mode '${mode}' (expected 'normal'|'emergency'|'dormant')`);
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("dormantGuard: actions array required (non-empty)");
  }

  if (mode === "dormant") {
    const allMeta = actions.every((a) => META_ONLY_ACTIONS.has(a));
    if (allMeta) {
      return { allowed: true, reason: "meta-only ok", recommendedActions: actions };
    }
    return {
      allowed: false,
      reason: "new-cycle locked under dormant",
      recommendedActions: ["meta-boost"],
    };
  }

  if (mode === "emergency") {
    if (actions.includes("new-cycle")) {
      return {
        allowed: false,
        reason: "new-cycle suspended under emergency",
        recommendedActions: ["meta-boost", "verify"],
      };
    }
    return { allowed: true, reason: "emergency mode meta/verify ok", recommendedActions: actions };
  }

  return { allowed: true, reason: "normal mode", recommendedActions: actions };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, fallback = undefined) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(`--${k}=`.length) : fallback;
  };
  const slotId = get("slot", "test-slot");
  const slotType = get("type", "komi");
  const mode = get("mode", "normal");
  const actionsRaw = get("actions", "verify");
  const actions = actionsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  try {
    const result = dormantGuard({ slotId, slotType, mode, actions });
    console.log(JSON.stringify(result));
    process.exit(result.allowed ? 0 : 1);
  } catch (e) {
    console.error(`dormantGuard error: ${e.message}`);
    process.exit(2);
  }
}
