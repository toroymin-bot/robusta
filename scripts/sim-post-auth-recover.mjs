#!/usr/bin/env node
/**
 * sim-post-auth-recover.mjs
 *   - C-D52-5 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-5 sim 5 케이스.
 *
 * Why: jest/vitest 미설치 → postAuthRecover 산식 mirror sim.
 *   실 fetch 미실행 — mock fetchFn 주입으로 5 케이스 검증.
 *
 * 5 cases (명세 § 9 엣지):
 *   1) ATLASSIAN_API_TOKEN 미설정 → errors=['token not set']
 *   2) parentId 빈 문자열 → errors=['parentId empty']
 *   3) failedSlots 비어있음 → 빈 결과 (skip-pass)
 *   4) 429 rate limit → exponential backoff 3회 후 errors
 *   5) 정상 응답 — 자식 제목에 slotId 포함/미포함 → recovered/pending 분기
 *
 * 외부 dev-deps +0 (node 표준만).
 */

// postAuthRecover mirror (run-time 검증, TS import 회피 — esbuild 미사용).
async function postAuthRecover(input) {
  if (typeof window !== "undefined") {
    throw new Error("postAuthRecover is server-only");
  }
  const result = { recovered: [], pending: [], errors: [] };
  const token = input.token;
  if (!token) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: "ATLASSIAN_API_TOKEN not set" });
    }
    return result;
  }
  if (!input.parentId) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: "parentId empty" });
    }
    return result;
  }
  if (input.failedSlots.length === 0) return result;

  const fetchFn = input.fetchFn;
  const RATE_LIMIT_BACKOFF_MS = [1000, 2000, 4000];
  let childTitles = [];
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetchFn(`/wiki/api/v2/pages/${input.parentId}/children`);
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1)); // 테스트는 즉시 (sim 가속).
        continue;
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        break;
      }
      const body = await res.json();
      childTitles = (body.results ?? [])
        .map((r) => r.title)
        .filter((t) => typeof t === "string");
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err.message ?? String(err);
      break;
    }
  }
  if (lastErr !== null) {
    for (const slot of input.failedSlots) {
      result.errors.push({ slotId: slot.slotId, reason: lastErr });
    }
    return result;
  }
  for (const slot of input.failedSlots) {
    const found = childTitles.some((title) => title.includes(slot.slotId));
    if (found) result.recovered.push(slot);
    else result.pending.push(slot);
  }
  return result;
}

console.log("sim:post-auth-recover — 5 케이스 (C-D52-5)");
let pass = 0;
let fail = 0;

const slot1 = { slotId: "§8", isoTime: "2026-05-06T15:00:00+09:00" };
const slot2 = { slotId: "§9", isoTime: "2026-05-06T17:00:00+09:00" };
const slot3 = { slotId: "§10", isoTime: "2026-05-06T19:00:00+09:00" };

// (1) token 미설정.
{
  const r = await postAuthRecover({ parentId: "p1", failedSlots: [slot1], token: undefined, fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) }) });
  if (r.errors.length === 1 && r.errors[0].reason.includes("ATLASSIAN_API_TOKEN")) {
    console.log("  ✓ 1. token 미설정 → errors 'ATLASSIAN_API_TOKEN not set'");
    pass++;
  } else {
    console.error(`  ✗ 1. token — ${JSON.stringify(r)}`);
    fail++;
  }
}

// (2) parentId 빈 문자열.
{
  const r = await postAuthRecover({ parentId: "", failedSlots: [slot1], token: "t" });
  if (r.errors.length === 1 && r.errors[0].reason === "parentId empty") {
    console.log("  ✓ 2. parentId 빈 문자열 → errors 'parentId empty'");
    pass++;
  } else {
    console.error(`  ✗ 2. parentId — ${JSON.stringify(r)}`);
    fail++;
  }
}

// (3) failedSlots 비어있음 → skip-pass.
{
  const r = await postAuthRecover({ parentId: "p1", failedSlots: [], token: "t" });
  if (r.recovered.length === 0 && r.pending.length === 0 && r.errors.length === 0) {
    console.log("  ✓ 3. failedSlots 빈 입력 → skip-pass (빈 결과)");
    pass++;
  } else {
    console.error(`  ✗ 3. skip-pass — ${JSON.stringify(r)}`);
    fail++;
  }
}

// (4) 429 rate limit → exponential backoff 3회 후 errors.
{
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return { status: 429, ok: false, json: async () => ({}) };
  };
  const r = await postAuthRecover({ parentId: "p1", failedSlots: [slot1, slot2], token: "t", fetchFn });
  // 4회 호출 (1차 + backoff 3회).
  if (calls === 4 && r.errors.length === 2 && r.errors[0].reason === "HTTP 429") {
    console.log(`  ✓ 4. 429 rate limit → backoff 3회 (총 4 호출, errors=${r.errors.length})`);
    pass++;
  } else {
    console.error(`  ✗ 4. 429 — calls=${calls} errors=${JSON.stringify(r.errors)}`);
    fail++;
  }
}

// (5) 정상 응답 — 자식 제목에 slotId 포함/미포함.
{
  const fetchFn = async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      results: [
        { title: "꼬미 §8 슬롯 결과" }, // slot1 매칭.
        { title: "꼬미 §9 슬롯 결과" }, // slot2 매칭.
        // slot3 (§10) 미매칭.
      ],
    }),
  });
  const r = await postAuthRecover({
    parentId: "p1",
    failedSlots: [slot1, slot2, slot3],
    token: "t",
    fetchFn,
  });
  if (
    r.recovered.length === 2 &&
    r.pending.length === 1 &&
    r.pending[0].slotId === "§10" &&
    r.errors.length === 0
  ) {
    console.log(`  ✓ 5. 정상 응답 — recovered 2 (§8/§9), pending 1 (§10)`);
    pass++;
  } else {
    console.error(`  ✗ 5. 정상 응답 — ${JSON.stringify(r)}`);
    fail++;
  }
}

if (fail > 0) {
  console.error(`sim:post-auth-recover — FAIL ${fail}/5`);
  process.exit(1);
}
console.log(`sim:post-auth-recover — ${pass}/5 PASS`);
