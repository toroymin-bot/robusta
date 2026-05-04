/**
 * md-mini.tsx
 *   - C-D37-3 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-3 (V-D37-2 / D-D37 사용자 가시 가치).
 *   - C-D38-2 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-2 (V-D38-2 (e) 자작 fenced block 정규식).
 *
 * AI 발화 마크다운 미니 파서. 외부 의존성 0 (react-markdown ~30 kB 회피, 168 103 kB 보호).
 *
 * 지원 인라인:
 *   - **bold**     → <strong>
 *   - *italic*     → <em>
 *   - `code`       → <code class="...">
 *   - URL https?:// → <a target="_blank" rel="noopener noreferrer">
 *
 * 블록 (C-D38-2 신규):
 *   - 줄바꿈 → <br />
 *   - ```lang\n...\n``` → <pre><code class="language-{lang}">...</code></pre>
 *     · lang 정규식 [a-zA-Z0-9]* 외 거부 (placeholder fallback "plaintext").
 *     · 펜스 안 인라인 마크업은 무력화 (literal — segment 분리 단계에서 차단).
 *     · 미닫힘 펜스 → 평문 fallback (정규식 미매치 → 인라인 처리만).
 *     · 중첩 펜스 → 외곽 매치 우선 (non-greedy `*?`).
 *
 * 보안 (XSS 방지):
 *   - dangerouslySetInnerHTML 미사용 — React 자체 escape 신뢰.
 *   - 모든 텍스트는 React children 으로만 전달 (string/array of nodes).
 *   - <script>, <img onerror=...> 등은 React 가 자동 escape.
 *   - 펜스 lang 그룹은 [a-zA-Z0-9]* 정규식으로 제한 — 그 외 문자 매치 불가.
 *
 * 정책:
 *   - 자율 정정 D-37-자-4: 명세 src/lib/md-mini.ts → src/modules/conversation/md-mini.tsx (사용처 모듈 정합 + JSX).
 *   - 자율 정정 D-38-자-3: 명세 "placeholder 토큰 치환" 방식 → segment 분리 방식 채택.
 *     · 결과 동일 (펜스 안 인라인 무력화 / XSS 방어). React-friendly + 더 단순.
 *   - 입력 길이 ≤16384자 (호출자 책임, 본 함수는 길이 미검증).
 *   - 외부 dep 0 (BYOK 정합).
 *
 * Tailwind 코드 클래스 (purge safelist 의무):
 *   - 인라인: bg-zinc-100 / text-rose-600 / px-1 / rounded / font-mono / text-xs.
 *   - 펜스 (신규): bg-stone-50 / dark:bg-stone-900 / text-xs / px-3 / py-2 / rounded / overflow-x-auto / language-plaintext.
 */

"use client";

import type { ReactNode } from "react";

// 마크업 마커 정규식 — non-greedy, 동일 마커 시작/종료 매칭.
//   순서 중요: URL 우선 (인라인 마크업 안에서 URL 감싸짐 회피), 그 다음 코드, 볼드, 이탤릭.
//   코드를 볼드보다 먼저 처리해야 `**a**` 안 백틱 `**` 가 코드로 안 빨림.
const URL_RE = /(https?:\/\/[^\s<>"'`]+)/;
const CODE_RE = /`([^`]+)`/;
const BOLD_RE = /\*\*([^*]+?)\*\*/;
const ITALIC_RE = /\*([^*]+?)\*/;

// C-D38-2 (D-4 19시 슬롯, 2026-05-04) — 펜스 코드 블록 정규식.
//   lang 그룹 1: [a-zA-Z0-9]* (XSS 방어 — 그 외 문자 매치 불가).
//   body 그룹 2: [\s\S]*? (non-greedy — 중첩 펜스 외곽 우선).
//   `g` flag — exec 반복 호출.
const FENCE_RE = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;

interface MdSegment {
  type: "text" | "fence";
  content: string;
  lang?: string;
}

/**
 * splitFences — 입력을 펜스 블록 / 평문 segment 배열로 분리.
 *   엣지:
 *     (1) 펜스 0건 → [{type:'text', content:input}] 단일.
 *     (2) 미닫힘 펜스 (\`\`\` 한 쪽만) → 정규식 미매치 → 평문 처리.
 *     (3) 빈 lang → "plaintext" 강제 (lang || "plaintext").
 *     (4) 중첩 펜스 → non-greedy 외곽 매치 우선.
 */
function splitFences(input: string): MdSegment[] {
  const segments: MdSegment[] = [];
  let lastIdx = 0;
  // exec 반복 호출 위해 lastIndex 초기화 (전역 정규식 상태 공유 회피).
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(input)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", content: input.slice(lastIdx, match.index) });
    }
    // lang [a-zA-Z0-9]* 외 거부 — 정규식 자체에서 차단되지만 빈 문자열 fallback.
    const lang = match[1].length > 0 ? match[1] : "plaintext";
    segments.push({ type: "fence", content: match[2], lang });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < input.length) {
    segments.push({ type: "text", content: input.slice(lastIdx) });
  }
  if (segments.length === 0) {
    // 빈 입력 안전망.
    segments.push({ type: "text", content: input });
  }
  return segments;
}

/**
 * 단일 텍스트 청크를 인라인 마크업 노드 배열로 분해.
 *   재귀 패턴: 가장 먼저 등장하는 마커 1개 → split → 마커 외 양쪽은 다시 재귀.
 *   매칭 실패 시 평문 그대로 반환 (unmatched **bold 는 평문 처리).
 */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  if (text.length === 0) return [];

  // (1) URL 우선 — 인라인 마크업이 URL 안에 등장해도 URL 으로 취급.
  const urlMatch = text.match(URL_RE);
  if (urlMatch && urlMatch.index !== undefined) {
    const before = text.slice(0, urlMatch.index);
    const url = urlMatch[1];
    const after = text.slice(urlMatch.index + url.length);
    return [
      ...parseInline(before, `${keyPrefix}-bU`),
      <a
        key={`${keyPrefix}-url`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-robusta-accent underline hover:no-underline"
      >
        {url}
      </a>,
      ...parseInline(after, `${keyPrefix}-aU`),
    ];
  }

  // (2) 코드 — 코드 안 마크업 무시 (literal).
  const codeMatch = text.match(CODE_RE);
  if (codeMatch && codeMatch.index !== undefined) {
    const before = text.slice(0, codeMatch.index);
    const code = codeMatch[1];
    const after = text.slice(codeMatch.index + codeMatch[0].length);
    return [
      ...parseInline(before, `${keyPrefix}-bC`),
      <code
        key={`${keyPrefix}-code`}
        className="rounded bg-zinc-100 px-1 font-mono text-xs text-rose-600 dark:bg-zinc-800 dark:text-rose-400"
      >
        {code}
      </code>,
      ...parseInline(after, `${keyPrefix}-aC`),
    ];
  }

  // (3) 볼드 — 안에 이탤릭 허용 (재귀).
  const boldMatch = text.match(BOLD_RE);
  if (boldMatch && boldMatch.index !== undefined) {
    const before = text.slice(0, boldMatch.index);
    const inner = boldMatch[1];
    const after = text.slice(boldMatch.index + boldMatch[0].length);
    return [
      ...parseInline(before, `${keyPrefix}-bB`),
      <strong key={`${keyPrefix}-bold`}>
        {parseInline(inner, `${keyPrefix}-iB`)}
      </strong>,
      ...parseInline(after, `${keyPrefix}-aB`),
    ];
  }

  // (4) 이탤릭 — 안에 볼드 허용 (재귀).
  const italicMatch = text.match(ITALIC_RE);
  if (italicMatch && italicMatch.index !== undefined) {
    const before = text.slice(0, italicMatch.index);
    const inner = italicMatch[1];
    const after = text.slice(italicMatch.index + italicMatch[0].length);
    return [
      ...parseInline(before, `${keyPrefix}-bI`),
      <em key={`${keyPrefix}-italic`}>
        {parseInline(inner, `${keyPrefix}-iI`)}
      </em>,
      ...parseInline(after, `${keyPrefix}-aI`),
    ];
  }

  // (5) 매칭 마커 부재 → 평문.
  return [text];
}

/**
 * 메인 진입점 — 입력 문자열을 React 노드 트리로 변환.
 *   처리 순서 (C-D38-2 신규):
 *     (1) splitFences — 펜스 블록 / 평문 segment 분리.
 *     (2) 펜스 segment → <pre><code class="language-{lang}">...</code></pre> (React 자체 escape).
 *     (3) 평문 segment → 줄바꿈 split → 각 줄 parseInline → 사이에 <br /> 삽입.
 *   엣지:
 *     - 빈 문자열 → 빈 배열.
 *     - 펜스 0건 → 기존 D-37 동작과 동일 (D-37 회귀 보호).
 *   보안: dangerouslySetInnerHTML 미사용. React 자체 escape 신뢰.
 *
 * 사용:
 *   <span>{renderMd(message.content)}</span>
 */
export function renderMd(input: string): ReactNode {
  if (input.length === 0) return [];
  const segments = splitFences(input);
  const result: ReactNode[] = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    if (seg.type === "fence") {
      // C-D38-2: 펜스 블록. lang 은 [a-zA-Z0-9]* 정규식으로 사전 검증, 빈 lang 은 "plaintext".
      //   body 는 React {} 안 children 으로 전달 — <script>, <img onerror=...> 자동 escape.
      result.push(
        <pre
          key={`fence-${sIdx}`}
          className="bg-stone-50 dark:bg-stone-900 text-xs px-3 py-2 rounded overflow-x-auto"
        >
          <code className={`language-${seg.lang ?? "plaintext"}`}>
            {seg.content}
          </code>
        </pre>,
      );
    } else {
      // 평문 segment — 기존 D-37 처리: 줄바꿈 split + 인라인 마크업.
      const lines = seg.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        result.push(...parseInline(line, `s${sIdx}-l${i}`));
        if (i < lines.length - 1) {
          result.push(<br key={`br-s${sIdx}-${i}`} />);
        }
      }
    }
  }
  return result;
}
