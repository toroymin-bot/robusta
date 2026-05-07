#!/usr/bin/env node
/**
 * check-release-tag.mjs
 *   - C-D59-4 (D-Day 07시 슬롯, 2026-05-08) — Tori spec C-D59-4 (F-D59-4 본체).
 *
 * Why: git tag release/2026-05-08 annotated tag 메타 무손상 read-only 검증.
 *   freeze 5/7 23:11:59 KST 시점 9cd5fdd 타겟으로 생성된 annotated tag — D-Day 24h 동안
 *   변경/삭제/lightweight 재생성 0 의무.
 *
 * 5 게이트 (모두 PASS 의무):
 *   1) tag 존재 (`git tag --list <tag>` 출력 1행)
 *   2) annotated tag (`git for-each-ref refs/tags/<tag> --format='%(objecttype)'` == 'tag')
 *   3) commit prefix 정합 (`*objectname` 첫 7자 == 기대 hash, 본 release 는 9cd5fdd)
 *   4) taggerdate ISO 파싱 가능
 *   5) subject 비공백
 *
 * 함수 시그니처:
 *   checkReleaseTag({ tag, expectCommit }) -> { ok, name, type, commit, taggerDateKST, subject, gates }
 *
 * 사용:
 *   $ node scripts/check-release-tag.mjs --tag=release/2026-05-08
 *   $ node scripts/check-release-tag.mjs --tag=release/2026-05-08 --expect-commit=9cd5fdd
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_TAG = "release/2026-05-08";
const DEFAULT_EXPECT_COMMIT = "9cd5fdd";

function parseArgs(argv) {
  const get = (k) => {
    const a = argv.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : null;
  };
  return {
    tag: get("tag") ?? DEFAULT_TAG,
    expectCommit: get("expect-commit") ?? DEFAULT_EXPECT_COMMIT,
  };
}

function runGit(args) {
  const root = resolve(process.cwd());
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/**
 * checkReleaseTag — 5 게이트 read-only 검증.
 * 입력 가드:
 *   - tag 누락 → throw RangeError
 */
export function checkReleaseTag({ tag, expectCommit } = {}) {
  if (!tag) throw new RangeError("missing --tag");

  const gates = {
    exists: false,
    annotated: false,
    commitMatch: false,
    taggerDateOk: false,
    subjectNonBlank: false,
  };

  // 게이트 1: tag 존재
  const r1 = runGit(["tag", "--list", tag]);
  const exists = r1.stdout.split("\n").map((l) => l.trim()).includes(tag);
  gates.exists = exists;

  let type = "unknown";
  let commit = "";
  let taggerDateKST = "";
  let subject = "";

  if (exists) {
    // 게이트 2∼5: annotated 타입 + 메타
    const r2 = runGit([
      "for-each-ref",
      `refs/tags/${tag}`,
      "--format=%(objecttype)|%(*objectname)|%(taggerdate:iso8601)|%(subject)",
    ]);
    const line = r2.stdout.split("\n").filter(Boolean)[0] ?? "";
    const [t, c, d, s] = line.split("|");
    type = (t ?? "").trim();
    commit = (c ?? "").trim();
    taggerDateKST = (d ?? "").trim();
    subject = (s ?? "").trim();

    // annotated tag 는 objecttype='tag' + *objectname (dereferenced commit) 가짐
    gates.annotated = type === "tag" && commit.length > 0;

    if (commit.length >= 7) {
      gates.commitMatch = commit.slice(0, 7) === expectCommit.slice(0, 7);
    }

    // taggerdate 파싱 — Date.parse 가 NaN 이 아니면 ISO 정합
    gates.taggerDateOk =
      taggerDateKST.length > 0 && Number.isFinite(Date.parse(taggerDateKST));

    gates.subjectNonBlank = subject.length > 0;
  }

  const ok =
    gates.exists &&
    gates.annotated &&
    gates.commitMatch &&
    gates.taggerDateOk &&
    gates.subjectNonBlank;

  return {
    ok,
    name: tag,
    type,
    commit: commit.slice(0, 7),
    taggerDateKST,
    subject,
    gates,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  try {
    result = checkReleaseTag(args);
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(2);
  }

  console.log(JSON.stringify({ releaseTag: result }));
  console.log(`check:release-tag ok=${result.ok}`);
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
