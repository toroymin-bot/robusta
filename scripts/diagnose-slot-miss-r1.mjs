#!/usr/bin/env node
/**
 * diagnose-slot-miss-r1.mjs
 *   - D-D77 R1 (꼬미 §2 진입 1순위, 2026-05-12 03시 슬롯) — 똘이 spec C-D77-2 1차 LIVE 정합 본체 (external token 0 / read-only).
 *
 * Why: 똘이 Task_2026-05-12 §1.1 "5/11 §5 이후 7슬롯 OCP append 0" 결론은 main page lastModified만 조회한 결과로,
 *   footer comment 4건 (꼬미 §6/§8/§12 + 직전 §4)을 누락한 methodology error. 본 R1은 LOCAL git log + 꼬미 §2 진입 시점
 *   Confluence MCP 조회 사실(인자로 주입)로 가설 α/β/γ 정합도 정정.
 *
 * 외부 의존 0 (node 표준 child_process 1건 — `git log` 로컬 1 hop). Confluence/GitHub/Anthropic API 호출 0건.
 *   C-D77-2 본체 (token 3종 발급 의무 D-77-자-1)는 D-D77 사이클 §4 이후 진입 예정.
 *
 * 함수 시그니처 (named export, §1.6 C-D77-2 본체 1차 정합):
 *   diagnoseSlotMissR1({ since, until, expectedSlots, confluenceFooterCount, repoRoot })
 *     → { alphaKomi, alphaTori, beta, gamma, evidence }
 *
 *     - since:                number ms epoch (default: 2026-05-11T09:22+09:00 — Task_2026-05-11 v5 lastModified)
 *     - until:                number ms epoch (default: 2026-05-12T03:00+09:00 — 꼬미 §2 진입 정시)
 *     - expectedSlots:        ExpectedSlot[] (default: 5/11 §5 이후 7슬롯)
 *     - confluenceFooterCount: { komi, tori } (default: 꼬미 §2 진입 시점 Atlassian MCP 직접 조회 사실 — komi=3 footers / tori=0 main append)
 *     - repoRoot:             string (default: process.cwd())
 *
 * 정합도 점수 정의 (0.0 ∼ 1.0, 5/11 §6 footer 6.2 본체 패턴):
 *   alphaKomi  = 꼬미 측 트리거 실패율 (miss commit 수 / expected 꼬미 슬롯 수)
 *   alphaTori  = 똘이 측 트리거 실패율 (miss OCP append 수 / expected 똘이 슬롯 수)
 *   beta       = 꼬미 측 4단계 룰 (verify→commit→push→OCP append) 누락률 (commit ↑ OCP append ↓ 케이스)
 *   gamma      = quota/한도 정합도 (시간 진행과 함께 100% miss 패턴이면 上, 1건 lock 패턴이면 下)
 *
 * 엣지 케이스:
 *   1) git log 빈 결과 → alphaKomi=1.0 (전수 miss 가설 정합)
 *   2) since > until → throw RangeError
 *   3) confluenceFooterCount 미주입 → beta/gamma 추정 모드 (evidence note 명시)
 *   4) DST 0 (KST 고정 +09:00)
 *
 * 출력: stdout JSON 1줄 + 1차 사람 read summary 1줄 (stderr).
 *
 * 사용:
 *   node scripts/diagnose-slot-miss-r1.mjs                    # default 5/11 §5∼5/12 §2 윈도우
 *   node scripts/diagnose-slot-miss-r1.mjs --json             # JSON only stdout
 *   node scripts/diagnose-slot-miss-r1.mjs --komi-footers=3   # Atlassian MCP 조회 사실 주입
 */

import { execFileSync } from 'node:child_process';
import process from 'node:process';

const KST_OFFSET_MS = 9 * 3600 * 1000;

const DEFAULT_SINCE = Date.parse('2026-05-11T09:22+09:00');
const DEFAULT_UNTIL = Date.parse('2026-05-12T03:00+09:00');

// 5/11 §5 이후 7슬롯 — 똘이 §1.1 표 정합
const DEFAULT_EXPECTED_SLOTS = [
  { slot: '§6',  actor: 'komi', iso: '2026-05-11T11:00+09:00' },
  { slot: '§7',  actor: 'tori', iso: '2026-05-11T13:00+09:00' },
  { slot: '§8',  actor: 'komi', iso: '2026-05-11T15:00+09:00' },
  { slot: '§9',  actor: 'tori', iso: '2026-05-11T17:00+09:00' },
  { slot: '§10', actor: 'komi', iso: '2026-05-11T19:00+09:00' },
  { slot: '§11', actor: 'tori', iso: '2026-05-11T21:00+09:00' },
  { slot: '§12', actor: 'komi', iso: '2026-05-11T23:00+09:00' },
];

function parseArgs(argv) {
  const out = { json: false };
  for (const a of argv.slice(2)) {
    if (a === '--json') out.json = true;
    else if (a.startsWith('--komi-footers=')) out.komiFooters = Number(a.split('=')[1]);
    else if (a.startsWith('--tori-mains=')) out.toriMains = Number(a.split('=')[1]);
    else if (a.startsWith('--since=')) out.since = Date.parse(a.split('=')[1]);
    else if (a.startsWith('--until=')) out.until = Date.parse(a.split('=')[1]);
  }
  return out;
}

function gitCommitsInWindow({ sinceIso, untilIso, repoRoot }) {
  // 로컬 read-only — git log --pretty 만 사용. 네트워크 0.
  const stdout = execFileSync(
    'git',
    [
      '-C', repoRoot,
      'log',
      `--since=${sinceIso}`,
      `--until=${untilIso}`,
      '--pretty=format:%H\t%aI\t%s',
    ],
    { encoding: 'utf8' },
  );
  if (!stdout.trim()) return [];
  return stdout.trim().split('\n').map((line) => {
    const [sha, iso, ...rest] = line.split('\t');
    const subject = rest.join('\t');
    return { sha, iso, subject };
  });
}

// commit subject에서 슬롯 번호 추출 (komi: ... §N 패턴 정합 — c9fab32/b1abe09/588f40c 1:1)
function commitToSlot(subject) {
  const m = subject.match(/§(\d+)/);
  if (!m) return null;
  return `§${m[1]}`;
}

export function diagnoseSlotMissR1({
  since = DEFAULT_SINCE,
  until = DEFAULT_UNTIL,
  expectedSlots = DEFAULT_EXPECTED_SLOTS,
  confluenceFooterCount = { komi: null, tori: null },
  repoRoot = process.cwd(),
} = {}) {
  if (Number.isNaN(since) || Number.isNaN(until)) {
    throw new RangeError('diagnoseSlotMissR1: invalid since/until epoch');
  }
  if (since > until) throw new RangeError('diagnoseSlotMissR1: since > until');

  const sinceIso = new Date(since).toISOString();
  const untilIso = new Date(until).toISOString();

  // 1) 로컬 git log — 꼬미 측 commit 트리거 정합 검증
  const commits = gitCommitsInWindow({ sinceIso, untilIso, repoRoot });
  const komiCommitsBySlot = new Map();
  for (const c of commits) {
    const slot = commitToSlot(c.subject);
    if (!slot) continue;
    if (!c.subject.toLowerCase().startsWith('komi:')) continue;
    if (!komiCommitsBySlot.has(slot)) komiCommitsBySlot.set(slot, c);
  }

  // 2) 기대 슬롯 ↔ 실제 commit 대조
  const komiExpected = expectedSlots.filter((s) => s.actor === 'komi');
  const toriExpected = expectedSlots.filter((s) => s.actor === 'tori');

  const komiHits = komiExpected.filter((s) => komiCommitsBySlot.has(s.slot));
  const komiMisses = komiExpected.filter((s) => !komiCommitsBySlot.has(s.slot));

  const alphaKomi = komiExpected.length === 0
    ? 0
    : Number((komiMisses.length / komiExpected.length).toFixed(3));

  // 3) 똘이 측 — git log로는 검증 불가. confluenceFooterCount.tori (main body OCP append 사실) 만으로 산출.
  //    confluenceFooterCount.tori 미주입 시 추정 모드 (evidence note).
  let alphaTori = null;
  let toriMode = 'estimated';
  if (typeof confluenceFooterCount.tori === 'number') {
    const toriHits = confluenceFooterCount.tori;
    alphaTori = toriExpected.length === 0
      ? 0
      : Number(((toriExpected.length - toriHits) / toriExpected.length).toFixed(3));
    toriMode = 'measured';
  }

  // 4) β — 4단계 룰 누락 (commit ↑ OCP append ↓) 케이스 산출
  //    confluenceFooterCount.komi 주입 시: komi commit 수 vs footer 수 차이로 산출.
  let beta = null;
  let betaMode = 'estimated';
  if (typeof confluenceFooterCount.komi === 'number') {
    const komiCommitCount = komiHits.length;
    const footerCount = confluenceFooterCount.komi;
    const missing = Math.max(0, komiCommitCount - footerCount);
    beta = komiCommitCount === 0 ? 0 : Number((missing / komiCommitCount).toFixed(3));
    betaMode = 'measured';
  }

  // 5) γ — quota/한도 도달 패턴 (시간 진행과 함께 miss 100% 패턴이면 上).
  //    꼬미 측 마지막 commit 시각이 윈도우 종료 직전이면 quota lock 패턴 정합 下.
  const lastKomiCommit = commits
    .filter((c) => c.subject.toLowerCase().startsWith('komi:'))
    .map((c) => Date.parse(c.iso))
    .sort((a, b) => b - a)[0];
  let gamma = 0;
  if (lastKomiCommit) {
    // 마지막 commit ~ until 사이 추가 expected miss 비율
    const lateMisses = komiMisses.filter((s) => Date.parse(s.iso) > lastKomiCommit).length;
    gamma = komiExpected.length === 0
      ? 0
      : Number((lateMisses / komiExpected.length).toFixed(3));
  } else {
    gamma = 1; // commit 0 = quota 무관 알 수 없음 (전수 miss = α 본체)
    gamma = Number(gamma.toFixed(3));
  }

  const evidence = {
    sinceIso, untilIso,
    commitCount: commits.length,
    komiCommits: [...komiCommitsBySlot.entries()].map(([slot, c]) => ({
      slot, sha: c.sha.slice(0, 7), iso: c.iso, subject: c.subject.slice(0, 80),
    })),
    komiHitSlots: komiHits.map((s) => s.slot),
    komiMissSlots: komiMisses.map((s) => s.slot),
    toriExpectedSlots: toriExpected.map((s) => s.slot),
    confluenceFooterCount,
    toriMode,
    betaMode,
    notes: [
      'γ score = 마지막 꼬미 commit 시각 이후 miss 비율 (quota lock 패턴 정합 검출)',
      'α/β 0.0=이상정상 / 1.0=전수 miss',
      'C-D77-2 본체(외부 API 3 hop)는 D-77-자-1 token 발급 + §4 이후 진입',
    ],
  };

  return { alphaKomi, alphaTori, beta, gamma, evidence };
}

function main() {
  const args = parseArgs(process.argv);
  const result = diagnoseSlotMissR1({
    since: args.since,
    until: args.until,
    confluenceFooterCount: {
      komi: typeof args.komiFooters === 'number' ? args.komiFooters : null,
      tori: typeof args.toriMains === 'number' ? args.toriMains : null,
    },
  });

  if (!args.json) {
    process.stderr.write(
      `[diagnose-slot-miss-r1] komi miss=${result.evidence.komiMissSlots.join(',') || '0'}` +
      ` / komi hit=${result.evidence.komiHitSlots.join(',') || '0'}` +
      ` / αkomi=${result.alphaKomi} αtori=${result.alphaTori ?? 'n/a'}` +
      ` β=${result.beta ?? 'n/a'} γ=${result.gamma}\n`,
    );
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
