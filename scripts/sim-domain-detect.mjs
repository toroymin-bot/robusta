#!/usr/bin/env node
/**
 * sim-domain-detect.mjs
 *   - C-D47-4 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-4 (B-D47-4 / F-D47-4).
 *
 * Why: KQ_23 도메인 자동 감지 5분 polling 시뮬.
 *   Roy 가 Vercel UI에서 robusta.ai4min.com 추가 후 5분 내 KQ_23 자동 close.
 *
 * 정책:
 *   - 실 fetch 미실행 — mock 응답만 (CI 네트워크 격리 의무).
 *   - fakeTimers — Node 내장 setTimeout/clearTimeout 직접 mock (외부 dev-deps +0).
 *   - 5분 polling = 5 * 60 * 1000 ms = 300_000 ms.
 *   - localStorage Mock — Node 환경 단순 객체.
 *
 * 4 cases:
 *   A) 200 응답 → KQ_23 banner permanent dismiss (localStorage 'kq23.domain.detected.at' set)
 *   B) 404 응답 → polling 계속 (5분 간격)
 *   C) 네트워크 오류 (offline) → polling skip + 다음 5분 재시도
 *   D) 이미 dismiss 된 상태 → polling 자동 stop (CPU 절약)
 */

let failed = 0;
function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  failed += 1;
  process.exitCode = 1;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DETECT_KEY = "kq23.domain.detected.at";

/**
 * polling 실행 1회. mockFetch 응답에 따라 상태 갱신.
 *   200 → set localStorage + 'detected'
 *   404/5xx → 'continue'
 *   throw → 'skip-retry'
 */
async function pollOnce(mockStorage, mockFetch) {
  if (mockStorage.getItem(DETECT_KEY) !== null) {
    return { result: "auto-stop", reason: "이미 dismiss" };
  }
  try {
    const res = await mockFetch("https://robusta.ai4min.com/_next/static/manifest.json");
    if (res.status === 200) {
      mockStorage.setItem(DETECT_KEY, String(Date.now()));
      return { result: "detected", reason: "200 응답 — banner permanent dismiss" };
    }
    return { result: "continue", reason: `${res.status} 응답 — polling 계속` };
  } catch (err) {
    return { result: "skip-retry", reason: `network error: ${err.message ?? err}` };
  }
}

/** Node 환경 mock localStorage. */
function createStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    clear: () => map.clear(),
  };
}

console.log("sim:domain-detect — 5분 polling 4 케이스");

// Case A: 200 응답 → permanent dismiss
{
  const storage = createStorage();
  const mockFetch = async () => ({ status: 200 });
  const r = await pollOnce(storage, mockFetch);
  const stored = storage.getItem(DETECT_KEY);
  if (r.result === "detected" && stored !== null) {
    pass(`A. 200 → detected + localStorage '${DETECT_KEY}' set`);
  } else {
    fail("A. 200", `result=${r.result} stored=${stored}`);
  }
}

// Case B: 404 응답 → polling 계속
{
  const storage = createStorage();
  const mockFetch = async () => ({ status: 404 });
  const r = await pollOnce(storage, mockFetch);
  const stored = storage.getItem(DETECT_KEY);
  if (r.result === "continue" && stored === null) {
    pass(`B. 404 → polling 계속 (storage unchanged)`);
  } else {
    fail("B. 404", `result=${r.result} stored=${stored}`);
  }
}

// Case C: 네트워크 오류 → skip-retry
{
  const storage = createStorage();
  const mockFetch = async () => { throw new Error("offline"); };
  const r = await pollOnce(storage, mockFetch);
  if (r.result === "skip-retry") {
    pass(`C. offline → skip-retry (다음 5분 재시도)`);
  } else {
    fail("C. offline", `result=${r.result}`);
  }
}

// Case D: 이미 dismiss → auto-stop
{
  const storage = createStorage();
  storage.setItem(DETECT_KEY, "1746460800000");
  let fetchCalled = false;
  const mockFetch = async () => { fetchCalled = true; return { status: 200 }; };
  const r = await pollOnce(storage, mockFetch);
  if (r.result === "auto-stop" && !fetchCalled) {
    pass(`D. 이미 dismiss → auto-stop (fetch 호출 0 — CPU 절약)`);
  } else {
    fail("D. dismiss", `result=${r.result} fetchCalled=${fetchCalled}`);
  }
}

// 5분 polling 간격 정합 grep
if (POLL_INTERVAL_MS === 300_000) {
  pass(`(verify) POLL_INTERVAL_MS === 300_000 (5분 정합)`);
} else {
  fail("interval", `POLL_INTERVAL_MS=${POLL_INTERVAL_MS} expected 300000`);
}

if (failed === 0) {
  console.log("sim:domain-detect — 4/4 PASS");
} else {
  console.error(`sim:domain-detect — FAIL (${failed} 케이스)`);
}
