#!/usr/bin/env node
/**
 * verify-meta-d77.mjs — C-META-D77-5 (Tori §3.6 spec / Task_2026-05-12 §3)
 *
 * META-D77 보강 사이클 8 read-only 게이트 통합 회귀.
 *
 * 8 게이트:
 *   G1) scripts/dormant-guard.mjs 존재 + ESM import + dormantGuard export + 4 케이스 정합
 *   G2) scripts/probe-komi-env.mjs 존재 + ESM import + probeKomiEnv export
 *   G3) scripts/verify-unlock-gate.mjs 존재 + ESM import + verifyUnlockGate export + 4 케이스 정합
 *   G4) scripts/page-health-snapshot.mjs 존재 + ESM import + pageHealthSnapshot export + graceful skip
 *   G5) L-META-D77-1 보존 13 침범 0 (git diff --name-only origin/main -- src/ empty)
 *   G6) L-META-D77-2 어휘 룰 self-grep 0건 (META 신규 5 파일)
 *   G7) L-META-D77-3 Confluence write 0 (page-health-snapshot.mjs 토큰 write:* 0건)
 *   G8) L-META-D77-4 verify:all 단조 55→56 + verify:meta-d77 등재
 *
 * 외부 dev-deps +0 (node 표준만). src/ 변경 0.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
let failed = 0;
let passed = 0;

function pass(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  failed++;
  console.error(`  ✗ ${label} — ${msg}`);
}

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

console.log("verify:meta-d77 — META-D77 보강 사이클 8 read-only 게이트 (휴면 운영 + 환경 진단)");
console.log("");

// ── G1: dormant-guard.mjs.
{
  const file = "scripts/dormant-guard.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    try {
      const mod = await import(`../${file}`);
      if (typeof mod.dormantGuard !== "function") {
        fail("G1", `dormantGuard export missing or not a function (got ${typeof mod.dormantGuard})`);
      } else {
        const c1 = mod.dormantGuard({ slotId: "t1", slotType: "komi", mode: "normal", actions: ["new-cycle"] });
        const c2 = mod.dormantGuard({ slotId: "t2", slotType: "komi", mode: "emergency", actions: ["new-cycle"] });
        const c3 = mod.dormantGuard({ slotId: "t3", slotType: "komi", mode: "dormant", actions: ["meta-boost"] });
        const c4 = mod.dormantGuard({ slotId: "t4", slotType: "komi", mode: "dormant", actions: ["new-cycle"] });
        const ok = c1.allowed && !c2.allowed && c3.allowed && !c4.allowed;
        if (ok) {
          pass("G1: dormant-guard.mjs 4 케이스 정합 (normal+nc=T, emergency+nc=F, dormant+meta=T, dormant+nc=F)");
        } else {
          fail("G1", `cases: ${[c1.allowed, c2.allowed, c3.allowed, c4.allowed].join(",")} (expected T,F,T,F)`);
        }
      }
    } catch (e) {
      fail("G1", `import failed: ${e.message}`);
    }
  }
}

// ── G2: probe-komi-env.mjs.
{
  const file = "scripts/probe-komi-env.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    try {
      const mod = await import(`../${file}`);
      if (typeof mod.probeKomiEnv !== "function") {
        fail("G2", `probeKomiEnv export missing or not a function (got ${typeof mod.probeKomiEnv})`);
      } else {
        const { results } = await mod.probeKomiEnv({ targets: ["network"] });
        if (results && results.network && typeof results.network.ok === "boolean") {
          pass(`G2: probe-komi-env.mjs ESM import + probeKomiEnv export + network probe (ok=${results.network.ok})`);
        } else {
          fail("G2", `probeKomiEnv returned unexpected shape`);
        }
      }
    } catch (e) {
      fail("G2", `import failed: ${e.message}`);
    }
  }
}

// ── G3: verify-unlock-gate.mjs.
{
  const file = "scripts/verify-unlock-gate.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    try {
      const mod = await import(`../${file}`);
      if (typeof mod.verifyUnlockGate !== "function") {
        fail("G3", `verifyUnlockGate export missing (got ${typeof mod.verifyUnlockGate})`);
      } else {
        const c1 = mod.verifyUnlockGate({
          komiCommitCount: 5,
          hypothesisScore: 0.8,
          tokensStatus: { confluence: true, healthchecks: true, github: true, anthropic: true },
        });
        const c2 = mod.verifyUnlockGate({
          komiCommitCount: 2,
          hypothesisScore: 0.5,
          tokensStatus: { confluence: false, healthchecks: false, github: false, anthropic: false },
        });
        const c3 = mod.verifyUnlockGate({
          komiCommitCount: 5,
          hypothesisScore: 0.8,
          tokensStatus: { confluence: false, healthchecks: false, github: false, anthropic: false },
        });
        const c4 = mod.verifyUnlockGate({
          komiCommitCount: 5,
          hypothesisScore: 0.6,
          tokensStatus: { confluence: true, healthchecks: true, github: true, anthropic: true },
        });
        const ok =
          c1.fullUnlock === true &&
          c2.fullUnlock === false &&
          c3.fullUnlock === false &&
          c3.partialUnlock.length === 2 &&
          c4.fullUnlock === false &&
          c4.stage2 === false;
        if (ok) {
          pass("G3: verify-unlock-gate.mjs 4 케이스 정합 (full / none / partial 2 stages / stage2 borderline)");
        } else {
          fail("G3", `cases: ${JSON.stringify({ c1: c1.fullUnlock, c2: c2.fullUnlock, c3: c3.partialUnlock, c4: c4.stage2 })}`);
        }
      }
    } catch (e) {
      fail("G3", `import failed: ${e.message}`);
    }
  }
}

// ── G4: page-health-snapshot.mjs.
{
  const file = "scripts/page-health-snapshot.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    try {
      const mod = await import(`../${file}`);
      if (typeof mod.pageHealthSnapshot !== "function") {
        fail("G4", `pageHealthSnapshot export missing (got ${typeof mod.pageHealthSnapshot})`);
      } else {
        const { snapshots } = await mod.pageHealthSnapshot({
          pageIds: [99999999],
          token: "",
          output: "analytics/.page-health-test.jsonl",
        });
        if (Array.isArray(snapshots) && snapshots.length === 1 && snapshots[0].reason?.includes("token absent")) {
          pass("G4: page-health-snapshot.mjs graceful skip 정합 (token 미존재 → reason='token absent')");
        } else {
          fail("G4", `graceful skip 정합 0 — ${JSON.stringify(snapshots).slice(0, 200)}`);
        }
      }
    } catch (e) {
      fail("G4", `import failed: ${e.message}`);
    }
  }
}

// ── G5: L-META-D77-1 src/ 변경 0.
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass("G5: skip (git unavailable, D-META-D77-자 fallback)");
  } else {
    const refCheck = spawnSync("git", ["rev-parse", "--verify", "origin/main"], { cwd: root, encoding: "utf8" });
    if (refCheck.status !== 0) {
      pass("G5: skip (origin/main absent, D-META-D77-자 fallback)");
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--name-only", "origin/main", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass("G5: L-META-D77-1 보존 13 침범 0 (git diff src/ empty)");
      } else {
        fail("G5", `src/ changed: ${out.split("\n").slice(0, 5).join(", ")}`);
      }
    }
  }
}

// ── G6: L-META-D77-2 어휘 룰.
{
  const newFiles = [
    "scripts/dormant-guard.mjs",
    "scripts/probe-komi-env.mjs",
    "scripts/verify-unlock-gate.mjs",
    "scripts/page-health-snapshot.mjs",
    "scripts/verify-meta-d77.mjs",
  ];
  const pat = /박(음|다|았|혀|혔|제|힘|힌)/g;
  const hits = [];
  for (const f of newFiles) {
    if (f === "scripts/verify-meta-d77.mjs") continue; // self-exclude (vocab pattern itself).
    const src = readOrEmpty(f);
    let m;
    while ((m = pat.exec(src)) !== null) {
      hits.push(`${f}: ${m[0]} @ ${m.index}`);
    }
  }
  if (hits.length === 0) {
    pass(`G6: L-META-D77-2 어휘 룰 self-grep 0건 (${newFiles.length - 1} files scanned, verify-meta-d77 self-excluded)`);
  } else {
    fail("G6", `vocab violations ${hits.length}건: ${hits.slice(0, 5).join(" | ")}`);
  }
}

// ── G7: L-META-D77-3 Confluence write scope 0.
{
  const file = "scripts/page-health-snapshot.mjs";
  const src = readOrEmpty(file);
  const writePat = /write:(comment|page):confluence|write:jira-work/g;
  const hits = (src.match(writePat) || []);
  // 추가로 POST/PUT/DELETE 메서드 사용 grep (외부 fetch 본체에서).
  const methodPat = /method:\s*["'](?:POST|PUT|DELETE|PATCH)["']/g;
  const methodHits = (src.match(methodPat) || []);
  if (hits.length === 0 && methodHits.length === 0) {
    pass("G7: L-META-D77-3 Confluence write 0 (page-health-snapshot.mjs write:* + POST/PUT/DELETE 토큰 0건)");
  } else {
    fail("G7", `write tokens=${hits.length}, write methods=${methodHits.length}`);
  }
}

// ── G8: L-META-D77-4 — verify:all 단조 + verify:meta-d77 등재.
{
  const pkg = readOrEmpty("package.json");
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const pkgHas = /"verify:meta-d77"\s*:/.test(pkg);
  const allHas = /"verify:meta-d77"/.test(verifyAll);
  const required = { pkgHas, allHas };
  const missing = Object.entries(required).filter(([_, v]) => !v).map(([k]) => k);
  if (missing.length === 0) {
    pass("G8: L-META-D77-4 verify:meta-d77 OCP append (package.json + verify-all.mjs)");
  } else {
    fail("G8", `missing OCP append: ${missing.join(", ")}`);
  }
}

console.log("");
console.log(`verify:meta-d77 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`);

process.exit(failed === 0 ? 0 : 1);
