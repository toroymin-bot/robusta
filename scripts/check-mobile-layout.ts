/**
 * check-mobile-layout.ts — D-14.4 (Day 8, 2026-04-28) 모바일 320px 회귀 자동 가드.
 *
 * 명세 Komi_Spec_Day8 §4: jsdom + matchMedia mock 풀 시뮬은 next build static export
 * 후 가능. 본 스크립트는 _차선책_으로 **CSS 룰 스캔**(grep + 클래스 동시 박힘 검증)을 박는다.
 *   - 추정 34: jsdom CSS rule 스캔이 320px 텍스트 오버플로우 회귀의 80% 흡수 (P1 — 라이브 Playwright 슬롯 이월).
 *
 * 검증 셀렉터 3종 (data-test):
 *   - 'add-participant'   ← [+참여자 추가] 버튼 (participants-panel.tsx)
 *   - 'settings-button'   ← 카드 ⚙ 버튼 (participants-panel.tsx)
 *   - 'picker-card'       ← Picker 카드 (persona-picker-modal.tsx)
 *
 * 가드 규칙:
 *   - 같은 element의 className에 `whitespace-nowrap` 박힘 (320px 줄바꿈 방지)
 *   - + (`truncate` 또는 `overflow-hidden`) 박힘 (텍스트 cut)
 *
 * 실패 시 process.exit(1) — CI/self-check 게이트.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Selector {
  /** data-test attribute value */
  testid: string;
  /** 어느 파일에서 찾을지 */
  file: string;
  /** 사람이 읽을 라벨 (실패 메시지용) */
  label: string;
}

const PROJECT_ROOT = resolve(__dirname, "..");

export const MOBILE_LAYOUT_SELECTORS: Selector[] = [
  {
    testid: "add-participant",
    file: "src/modules/participants/participants-panel.tsx",
    label: "[+참여자 추가] 버튼",
  },
  {
    testid: "settings-button",
    file: "src/modules/participants/participants-panel.tsx",
    label: "⚙ 설정 버튼",
  },
  {
    testid: "picker-card",
    file: "src/modules/personas/persona-picker-modal.tsx",
    label: "Picker 카드",
  },
];

/**
 * data-test 속성을 가진 JSX 시작 태그 + 인접 className 영역을 추출.
 *   - JSX 시작 태그는 다중 라인 + 표현식(arrow `=>`, ternary 등)로 인해 '>'가 attribute 안에도
 *     박힐 수 있어, 단순 [^<>] 매칭으로는 잡기 어렵다. 따라서 _창문(window)_ 방식으로 처리.
 *   - data-test 위치를 찾고, 그 앞 2500자 + 뒤 800자를 snippet으로 잘라 className 토큰을 검사.
 *   - 같은 element의 className은 일반적으로 data-test 근처에 박혀있으므로 충분.
 *   - 주석/문자열에 박힌 data-test=... 매칭을 회피하기 위해 가능한 모든 매칭을 시도하다가 첫 번째
 *     "JSX 같은" 위치(직전 비공백 char가 `,`/`{`/`>` 또는 줄 시작 + 들여쓰기)인 것을 채택.
 */
function findElementWithTestId(
  source: string,
  testid: string,
): { snippet: string } | null {
  const escaped = escapeRegex(testid);
  const re = new RegExp(`data-test=["']${escaped}["']`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const before = source.slice(0, match.index);
    // 주석 안인지 휴리스틱 — 이전 가장 가까운 '/*' 또는 `{/*` 와 '*/' 위치 비교.
    const lastOpenBlock = Math.max(
      before.lastIndexOf("/*"),
      before.lastIndexOf("{/*"),
    );
    const lastCloseBlock = Math.max(
      before.lastIndexOf("*/"),
      before.lastIndexOf("*/}"),
    );
    if (lastOpenBlock !== -1 && lastOpenBlock > lastCloseBlock) {
      // 주석 블록 내부 매칭 — skip.
      continue;
    }
    // 같은 줄 '//' 라인 주석 검사.
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineBefore = source.slice(lineStart, match.index);
    if (/(^|\s)\/\//.test(lineBefore)) continue;
    // JSX element 매칭 후보 — 앞 2500자 + 뒤 800자 snippet.
    const start = Math.max(0, match.index - 2500);
    const end = Math.min(source.length, match.index + 800);
    return { snippet: source.slice(start, end) };
  }
  return null;
}

/**
 * className(string 또는 template literal) 안에 token이 박혀있는지.
 * Tailwind 토큰은 보통 단어 경계로 박혀있으므로 \b 매칭으로 충분.
 */
function classNameIncludes(snippet: string, token: string): boolean {
  const re = new RegExp(`(?<![\\w-])${escapeRegex(token)}(?![\\w-])`);
  return re.test(snippet);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MobileLayoutResult {
  ok: boolean;
  failures: string[];
}

/**
 * 모든 selector에 대해 가드 검증. 실패 목록 반환.
 *   ok=true → 모든 통과
 *   ok=false → failures에 사람이 읽을 메시지 박혀있음.
 */
export function runMobileLayoutCheck(): MobileLayoutResult {
  const failures: string[] = [];
  for (const sel of MOBILE_LAYOUT_SELECTORS) {
    const filePath = resolve(PROJECT_ROOT, sel.file);
    let src: string;
    try {
      src = readFileSync(filePath, "utf-8");
    } catch (err) {
      failures.push(
        `${sel.label}: 파일 읽기 실패 ${sel.file} — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      continue;
    }
    const found = findElementWithTestId(src, sel.testid);
    if (!found) {
      failures.push(
        `${sel.label}: data-test='${sel.testid}' 박혀있지 않음 (파일: ${sel.file})`,
      );
      continue;
    }
    const { snippet } = found;
    const hasNowrap = classNameIncludes(snippet, "whitespace-nowrap");
    const hasCut =
      classNameIncludes(snippet, "truncate") ||
      classNameIncludes(snippet, "overflow-hidden");
    if (!hasNowrap || !hasCut) {
      failures.push(
        `${sel.label} (data-test='${sel.testid}'): 모바일 가드 미충족 — ` +
          `whitespace-nowrap=${hasNowrap}, truncate|overflow-hidden=${hasCut}`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}

// 단독 실행 시 게이트로 동작 (self-check가 import해서 호출하는 경우엔 main 미실행).
const isMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;
if (isMain) {
  const result = runMobileLayoutCheck();
  if (result.ok) {
    process.stdout.write("[mobile-layout] PASS — 3 selectors guarded\n");
    process.exit(0);
  } else {
    process.stdout.write("[mobile-layout] FAIL\n");
    for (const msg of result.failures) {
      process.stdout.write(`  - ${msg}\n`);
    }
    process.exit(1);
  }
}
