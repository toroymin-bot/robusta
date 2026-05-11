#!/usr/bin/env node
/**
 * probe-komi-env.mjs — C-META-D77-2 ⭐ (Tori §3.6 spec / Task_2026-05-12 §3)
 *
 * 꼬미 측 환경 fault 검출 4축 LIVE 수집 (read-only).
 *
 * 4축:
 *   1) powerState  — pmset -g log (macOS) / journalctl -k (Linux). sleep/wake 이벤트.
 *   2) network     — scutil --nwi (macOS) / nmcli con (Linux). 단절 이벤트.
 *   3) authToken   — Claude Code 토큰 ~/.claude/auth.json 또는 ANTHROPIC_API_KEY env.
 *   4) cronLastFire — ~/.claude/scheduled-tasks/robusta-komi-slot/* last fire 추정.
 *
 * 외부 dev-deps +0 (node 표준만). src/ 변경 0. Confluence write 0.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const VALID_TARGETS = new Set(["powerState", "network", "authToken", "cronLastFire"]);

function probePowerState() {
  const plat = platform();
  const observedAt = new Date().toISOString();
  if (plat === "darwin") {
    const r = spawnSync("pmset", ["-g", "log"], { encoding: "utf8", timeout: 5000 });
    if (r.error || r.status !== 0) {
      return { ok: false, value: { reason: "pmset unavailable", code: r.status }, observedAt };
    }
    const tail = (r.stdout || "").split("\n").slice(-40);
    const sleepEvents = tail.filter((l) => /\bSleep\b/.test(l)).length;
    const wakeEvents = tail.filter((l) => /\bWake\b/.test(l)).length;
    return { ok: true, value: { sleepEvents, wakeEvents, tailLines: tail.length, source: "pmset" }, observedAt };
  }
  if (plat === "linux") {
    const r = spawnSync("journalctl", ["-k", "-n", "100", "--no-pager"], { encoding: "utf8", timeout: 5000 });
    if (r.error || r.status !== 0) {
      return { ok: false, value: { reason: "journalctl unavailable", code: r.status }, observedAt };
    }
    return { ok: true, value: { lines: (r.stdout || "").split("\n").length, source: "journalctl" }, observedAt };
  }
  return { ok: false, value: { reason: `unsupported platform '${plat}'` }, observedAt };
}

function probeNetwork() {
  const plat = platform();
  const observedAt = new Date().toISOString();
  if (plat === "darwin") {
    const r = spawnSync("scutil", ["--nwi"], { encoding: "utf8", timeout: 5000 });
    if (r.error || r.status !== 0) {
      return { ok: false, value: { reason: "scutil unavailable", code: r.status }, observedAt };
    }
    const out = r.stdout || "";
    const hasIPv4 = /IPv4/.test(out);
    const hasReachable = /Reachable/.test(out);
    return { ok: true, value: { hasIPv4, hasReachable, source: "scutil" }, observedAt };
  }
  if (plat === "linux") {
    const r = spawnSync("ip", ["-o", "addr", "show"], { encoding: "utf8", timeout: 5000 });
    if (r.error || r.status !== 0) {
      return { ok: false, value: { reason: "ip command unavailable", code: r.status }, observedAt };
    }
    return { ok: true, value: { lines: (r.stdout || "").split("\n").length, source: "ip" }, observedAt };
  }
  return { ok: false, value: { reason: `unsupported platform '${plat}'` }, observedAt };
}

function probeAuthToken() {
  const observedAt = new Date().toISOString();
  const authPath = join(homedir(), ".claude", "auth.json");
  if (existsSync(authPath)) {
    try {
      const stat = statSync(authPath);
      return {
        ok: true,
        value: { source: "auth.json", mtimeMs: stat.mtimeMs, size: stat.size },
        observedAt,
      };
    } catch (e) {
      return { ok: false, value: { reason: `stat failed: ${e.message}` }, observedAt };
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { ok: true, value: { source: "env", hasKey: true }, observedAt };
  }
  return { ok: false, value: { reason: "no auth.json and no ANTHROPIC_API_KEY env" }, observedAt };
}

function probeCronLastFire() {
  const observedAt = new Date().toISOString();
  const taskDir = join(homedir(), ".claude", "scheduled-tasks", "robusta-komi-slot");
  if (!existsSync(taskDir)) {
    return { ok: false, value: { reason: "cron never fired (task dir absent)" }, observedAt };
  }
  try {
    const files = readdirSync(taskDir);
    const fileStats = files
      .map((f) => {
        try {
          const s = statSync(join(taskDir, f));
          return { name: f, mtimeMs: s.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (fileStats.length === 0) {
      return { ok: false, value: { reason: "task dir empty" }, observedAt };
    }
    const latest = fileStats[0];
    const ageMs = Date.now() - latest.mtimeMs;
    return {
      ok: true,
      value: {
        latestFile: latest.name,
        latestMtimeMs: latest.mtimeMs,
        ageHours: +(ageMs / 3600 / 1000).toFixed(2),
        fileCount: fileStats.length,
      },
      observedAt,
    };
  } catch (e) {
    return { ok: false, value: { reason: `readdir failed: ${e.message}` }, observedAt };
  }
}

const PROBES = {
  powerState: probePowerState,
  network: probeNetwork,
  authToken: probeAuthToken,
  cronLastFire: probeCronLastFire,
};

/**
 * @param {object} [input]
 * @param {string[]} [input.targets]
 * @returns {Promise<{ results: Record<string, { ok: boolean, value: unknown, observedAt: string }> }>}
 */
export async function probeKomiEnv({ targets = ["powerState", "network", "authToken", "cronLastFire"] } = {}) {
  for (const t of targets) {
    if (!VALID_TARGETS.has(t)) {
      throw new Error(`probeKomiEnv: invalid target '${t}'`);
    }
  }
  const results = {};
  for (const t of targets) {
    results[t] = PROBES[t]();
  }
  return { results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(`--${k}=`.length) : fallback;
  };
  const targetsRaw = get("targets", "powerState,network,authToken,cronLastFire");
  const targets = targetsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const { results } = await probeKomiEnv({ targets });
    const allOk = Object.values(results).every((r) => r.ok);
    console.log(JSON.stringify({ results, allOk }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(`probeKomiEnv error: ${e.message}`);
    process.exit(2);
  }
}
