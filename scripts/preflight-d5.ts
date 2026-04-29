/**
 * C-D17-1 (Day 4 23시 슬롯, 2026-04-29) — D5 production 도메인 연결 사전 점검.
 *
 * 똘이 v12 §24.8 C-D17-1 명세 — D5/D6 production switch 전 자동 검증 10건.
 * 통과하면 Roy 작업 = production 도메인 연결 결정만.
 *
 * 실행:
 *   npx tsx scripts/preflight-d5.ts
 *
 * 검증 (10):
 *   1) typecheck exit 0
 *   2) build exit 0  (— 본 스크립트에서는 수동 사전실행 권장, --skip-build 옵션)
 *   3) self-check 121+ PASS
 *   4) 1st Load JS ≤ 162 KB (.next/build-manifest 추정)
 *   5) curl https://robusta.ai4min.com → 200
 *   6) curl https://robusta-tau.vercel.app | grep og:image
 *   7) 헤더 라벨 = Day 5 (D5 시점)
 *   8) /sample 라우트 200
 *   9) /getting-started/byok 200 + 본문에 BUILD_DATE 회전 박힘 (P1)
 *   10) og.png 1200×630 + < 200KB
 *
 * 회귀 위험 0 — 읽기 전용 검증, 외부 호출만, 카드/비용 X.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const PROD_URL = "https://robusta.ai4min.com";
const PREVIEW_URL = "https://robusta-tau.vercel.app";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    process.stdout.write(`  PASS  ${label}\n`);
  } else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}\n`);
  }
}

function runCmd(cmd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout, stderr: "" };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

async function fetchUrl(url: string, timeoutMs = 15_000): Promise<{ status: number; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function main(): Promise<void> {
  process.stdout.write("=== preflight-d5 ===\n\n");
  const skipBuild = process.argv.includes("--skip-build");

  // 1. typecheck
  {
    const r = runCmd("npm run -s typecheck");
    check("1) typecheck exit 0", r.ok, r.stderr.split("\n").slice(0, 3).join(" | "));
  }

  // 2. build (느려서 옵션 가드)
  if (!skipBuild) {
    const r = runCmd("npm run -s build");
    check("2) build exit 0", r.ok, r.stderr.split("\n").slice(0, 3).join(" | "));
  } else {
    process.stdout.write("  SKIP  2) build (--skip-build)\n");
  }

  // 3. self-check
  {
    const r = runCmd("npx tsx scripts/self-check.ts");
    const passMatch = r.stdout.match(/PASSED\s+(\d+)/);
    const passCount = passMatch ? Number(passMatch[1]) : 0;
    check(
      `3) self-check ≥ 121 (현재 ${passCount})`,
      r.ok && passCount >= 121,
      r.ok ? "" : "exit≠0",
    );
  }

  // 4. 1st Load JS ≤ 162 KB — .next/build-manifest.json 정확 측정은 build 후. 본 스크립트는 .next 존재만 확인.
  {
    const manifest = join(ROOT, ".next", "build-manifest.json");
    const exists = existsSync(manifest);
    check(
      "4) .next/build-manifest.json 존재 (1st Load 측정 가능)",
      exists,
      exists ? "" : "build 필요",
    );
  }

  // 5. production 200
  try {
    const r = await fetchUrl(PROD_URL);
    check(`5) ${PROD_URL} HTTP 200`, r.status === 200, `status=${r.status}`);
  } catch (err) {
    check(`5) ${PROD_URL}`, false, `fetch 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. preview에 og:image
  try {
    const r = await fetchUrl(PREVIEW_URL);
    const hasOg = /og:image/.test(r.body);
    check(`6) ${PREVIEW_URL} og:image meta`, hasOg, hasOg ? "" : "meta 없음");
  } catch (err) {
    check(`6) ${PREVIEW_URL}`, false, `fetch 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 7. 헤더 라벨 = Day 5 (D5 시점)
  try {
    const r = await fetchUrl(PROD_URL);
    const m = r.body.match(/data-test="header-mode-label"[^>]*>([^<]+)</);
    const label = m ? m[1].trim() : "(미발견)";
    const isDay5 = /Day 5 · /.test(label);
    check(`7) 헤더 라벨 = "Day 5 · ..." (현재 "${label}")`, isDay5);
  } catch {
    check("7) 헤더 라벨 회전", false, "fetch 실패");
  }

  // 8. /sample 200
  try {
    const r = await fetchUrl(`${PROD_URL}/sample`);
    check(`8) /sample HTTP 200`, r.status === 200, `status=${r.status}`);
  } catch {
    check(`8) /sample`, false, "fetch 실패");
  }

  // 9. /getting-started/byok 200 + 시점 박제
  try {
    const r = await fetchUrl(`${PROD_URL}/getting-started/byok`);
    const has200 = r.status === 200;
    const hasDate = /\d{4}-\d{2}-\d{2}\s*기준/.test(r.body);
    check(
      "9) /getting-started/byok 200 + YYYY-MM-DD 기준",
      has200 && hasDate,
      `200=${has200} date=${hasDate}`,
    );
  } catch {
    check("9) /getting-started/byok", false, "fetch 실패");
  }

  // 10. og.png 1200×630 + < 200KB
  {
    const og = join(ROOT, "public", "og.png");
    if (!existsSync(og)) {
      check("10) public/og.png", false, "파일 미존재");
    } else {
      const size = statSync(og).size;
      const buf = readFileSync(og);
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      check(
        `10) og.png 1200×630 + ≤200KB (현재 ${w}x${h}, ${size}B)`,
        w === 1200 && h === 630 && size <= 200_000,
      );
    }
  }

  process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
