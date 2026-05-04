/**
 * md-mini.tsx
 *   - C-D37-3 (D-4 15시 슬롯, 2026-05-04) — Tori spec C-D37-3 (V-D37-2 / D-D37 사용자 가시 가치).
 *
 * AI 발화 마크다운 미니 파서. 외부 의존성 0 (react-markdown ~30 kB 회피, 168 103 kB 보호).
 *
 * 지원 인라인:
 *   - **bold**     → <strong>
 *   - *italic*     → <em>
 *   - `code`       → <code class="...">
 *   - URL https?:// → <a target="_blank" rel="noopener noreferrer">
 *
 * 블록:
 *   - 줄바꿈 → <br />
 *
 * 보안 (XSS 방지):
 *   - dangerouslySetInnerHTML 미사용 — React 자체 escape 신뢰.
 *   - 모든 텍스트는 React children 으로만 전달 (string/array of nodes).
 *   - <script>, <img onerror=...> 등은 React 가 자동 escape.
 *
 * 정책:
 *   - 자율 정정 D-37-자-4: 명세 src/lib/md-mini.ts → src/modules/conversation/md-mini.tsx (사용처 모듈 정합 + JSX).
 *   - 입력 길이 ≤16384자 (호출자 책임, 본 함수는 길이 미검증).
 *   - 외부 dep 0 (BYOK 정합).
 *
 * Tailwind 코드 클래스 (purge safelist 의무) — bg-zinc-100 / text-rose-600 / px-1 / rounded / font-mono / text-xs.
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
 *   - 줄바꿈 우선 split (\n) → 각 줄을 parseInline → 사이에 <br /> 삽입.
 *   - 빈 문자열 → 빈 배열.
 *   - 보안: dangerouslySetInnerHTML 미사용. React 자체 escape 신뢰.
 *
 * 사용:
 *   <span>{renderMd(message.content)}</span>
 */
export function renderMd(input: string): ReactNode {
  if (input.length === 0) return [];
  const lines = input.split("\n");
  const result: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(...parseInline(line, `l${i}`));
    if (i < lines.length - 1) {
      result.push(<br key={`br${i}`} />);
    }
  }
  return result;
}
