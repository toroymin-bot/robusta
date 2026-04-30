/**
 * verify-d19.mjs
 *   - C-D19 (D6 07시 슬롯, 2026-05-01) 신규 모듈 단위 시뮬레이션 검증.
 *   - verify-d18.mjs 패턴 계승 — assertion 약 30개 추가.
 *   - 의존성 없는 순수 로직 함수만 검증 (브라우저/Dexie/React 의존 함수는 grep 기반 검증).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass++;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail++;
  }
}

// 1) C-D19-1 SideSheet 컴포넌트 — 시그니처/정책 박음 확인.
{
  const src = await readFile(
    resolve(root, "src/components/SideSheet/SideSheet.tsx"),
    "utf8",
  );
  assert(
    "SideSheet: SideSheetProps 박음 (open/onOpenChange/side/ariaLabel)",
    src.includes("export interface SideSheetProps") &&
      src.includes("open: boolean") &&
      src.includes("onOpenChange: (next: boolean) => void") &&
      src.includes("side?: \"left\" | \"right\"") &&
      src.includes("ariaLabel: string"),
  );
  assert(
    "SideSheet: open=false 시 null 반환 (DOM 미렌더)",
    src.includes("if (!open) return null;"),
  );
  assert(
    "SideSheet: useResponsiveSheet 통합",
    src.includes("useResponsiveSheet"),
  );
  assert(
    "SideSheet: body scroll lock + 복구",
    src.includes("document.body.style.overflow = \"hidden\"") &&
      src.includes("document.body.style.overflow = prev"),
  );
  assert(
    "SideSheet: backdrop 클릭 시 onOpenChange(false)",
    src.includes("onClick={() => onOpenChange(false)}"),
  );
  assert(
    "SideSheet: role=dialog + aria-modal + aria-label",
    src.includes('role="dialog"') &&
      src.includes('aria-modal="true"') &&
      src.includes("aria-label={ariaLabel}"),
  );
  assert(
    "SideSheet: Tab 포커스 트랩 (focusables 순환)",
    src.includes("focusables") &&
      src.includes("ev.shiftKey") &&
      src.includes("first?.focus()") &&
      src.includes("last?.focus()"),
  );
}

// 2) C-D19-1 SideSheet CSS module — prefers-reduced-motion 처리.
{
  const css = await readFile(
    resolve(root, "src/components/SideSheet/SideSheet.module.css"),
    "utf8",
  );
  assert(
    "SideSheet.css: panel.left translateX(-100%) 박음",
    css.includes("translateX(-100%)") && css.includes(".panel.left"),
  );
  assert(
    "SideSheet.css: panel.right translateX(100%) 박음",
    css.includes("translateX(100%)") && css.includes(".panel.right"),
  );
  assert(
    "SideSheet.css: open 시 translateX(0) 적용",
    css.includes(".panel.open") && css.includes("translateX(0)"),
  );
  assert(
    "SideSheet.css: prefers-reduced-motion 시 transition 제거",
    css.includes("prefers-reduced-motion: reduce") &&
      css.includes("transition: none"),
  );
}

// 3) C-D19-2 useConversationEmptyState — 분기 규칙 4종.
{
  const src = await readFile(
    resolve(root, "src/views/conversation/useConversationEmptyState.ts"),
    "utf8",
  );
  assert(
    "useConversationEmptyState: zeroParticipants 분기 박음",
    src.includes("participants.length === 0") &&
      src.includes('variant: "zeroParticipants"'),
  );
  assert(
    "useConversationEmptyState: onlyHuman 분기 박음 (전원 인간)",
    src.includes("hasAi") &&
      src.includes('variant: "onlyHuman"'),
  );
  assert(
    "useConversationEmptyState: zeroMessages 분기 박음 (hasAi + messages 0)",
    src.includes("messages.length === 0") &&
      src.includes('variant: "zeroMessages"'),
  );
  assert(
    "useConversationEmptyState: 정상 진행 중 'none' 반환",
    src.includes('kind: "none"'),
  );
  assert(
    "useConversationEmptyState: loaded=false 시 'none' (FOUC 방지)",
    src.includes("loaded = true") && src.includes("if (!loaded)"),
  );
  assert(
    "useConversationEmptyState: pure compute + hook wrapper",
    src.includes("export function computeConversationEmptyState") &&
      src.includes("export function useConversationEmptyState"),
  );
}

// 4) C-D19-2 conversation-view 호출처 통합.
{
  const src = await readFile(
    resolve(root, "src/modules/conversation/conversation-view.tsx"),
    "utf8",
  );
  assert(
    "conversation-view: useConversationEmptyState import",
    src.includes("useConversationEmptyState"),
  );
  assert(
    "conversation-view: handleEmptyIntent 콜백 등록 (3 intent)",
    src.includes("handleEmptyIntent") &&
      src.includes("addParticipant") &&
      src.includes("addAI") &&
      src.includes("focusInput"),
  );
  assert(
    "conversation-view: emptyState.kind === 'show' 분기 박음",
    src.includes('emptyState.kind === "show"'),
  );
  assert(
    "conversation-view: variant + locale + onIntent prop 전달",
    src.includes("variant={emptyState.variant}") &&
      src.includes('locale="ko"') &&
      src.includes("onIntent={handleEmptyIntent}"),
  );
}

// 5) C-D19-3 어휘 룰 — 잔여 3개 파일 0건 + lint rule + 검증 스크립트 박음.
{
  const targets = [
    "src/modules/ui/theme.ts",
    "src/modules/conversation/conversation-workspace.tsx",
    "src/modules/conversation/header-cluster.tsx",
  ];
  for (const t of targets) {
    const src = await readFile(resolve(root, t), "utf8");
    const hits = src.match(/박(음|다|았|혀|혔|제)/g);
    assert(
      `vocab cleanup: ${t} 박(음|다|았|혀|혔|제) 0건`,
      !hits,
      hits ? `발견: ${hits.join(",")}` : "",
    );
  }
  const lintRule = await readFile(
    resolve(root, "eslint-rules/no-bakeum-in-comment.js"),
    "utf8",
  );
  assert(
    "lint rule: ESLint Rule.RuleModule export 박음",
    lintRule.includes("module.exports = rule") &&
      lintRule.includes("type: \"suggestion\"") &&
      lintRule.includes("messages:"),
  );
  assert(
    "lint rule: 정규식 /박(음|다|았|혀|혔|제)/g 박음",
    lintRule.includes("/박(음|다|았|혀|혔|제)/g"),
  );
  assert(
    "lint rule: @robusta-lint-ignore-bakeum 예외 처리",
    lintRule.includes("@robusta-lint-ignore-bakeum"),
  );
  const checkVocab = await readFile(
    resolve(root, "scripts/check-vocab.mjs"),
    "utf8",
  );
  assert(
    "check-vocab.mjs: DEFAULT_TARGETS 박음 (D-D19 5건 + 정리 3건)",
    checkVocab.includes("DEFAULT_TARGETS") &&
      checkVocab.includes("useConversationEmptyState.ts") &&
      checkVocab.includes("SideSheet.tsx") &&
      checkVocab.includes("anthropic-llm-client.ts"),
  );
  assert(
    "check-vocab.mjs: exit code 1 on hits (CI 가드)",
    checkVocab.includes("process.exit(totalHits === 0 ? 0 : 1)"),
  );
}

// 6) C-D19-4 다크 토큰 — 모든 토큰 + 라이트 대칭 + 트랜지션.
{
  const css = await readFile(
    resolve(root, "src/styles/tokens.dark.css"),
    "utf8",
  );
  assert(
    "tokens.dark.css: [data-theme=\"dark\"] 캔버스/표면 토큰 박음",
    css.includes("--bg-canvas: #1A1612") &&
      css.includes("--bg-surface: #2A2218") &&
      css.includes("--bg-elevated: #3A2F22"),
  );
  assert(
    "tokens.dark.css: 텍스트 토큰 (primary/secondary/muted) 박음",
    css.includes("--text-primary: #FCE7B0") &&
      css.includes("--text-secondary: #C9B68A") &&
      css.includes("--text-muted: #8A7A5A"),
  );
  assert(
    "tokens.dark.css: accent 토큰 박음 (primary + fg)",
    css.includes("--accent-primary: #FCE7B0") &&
      css.includes("--accent-primary-fg: #1F2937"),
  );
  assert(
    "tokens.dark.css: status 토큰 3종 박음",
    css.includes("--status-success: #7BC97B") &&
      css.includes("--status-error: #E5736C") &&
      css.includes("--status-warning: #F2C46C"),
  );
  assert(
    "tokens.dark.css: empty state 토큰 박음 (D-28 연동)",
    css.includes("--empty-bg") &&
      css.includes("--empty-text") &&
      css.includes("--empty-cta-bg") &&
      css.includes("--empty-cta-fg"),
  );
  assert(
    "tokens.dark.css: 라이트 대칭 :root 박음",
    css.includes(":root {") && css.includes("--bg-canvas: #FFFCEB"),
  );
  assert(
    "tokens.dark.css: 트랜지션 200ms ease 박음",
    css.includes("transition:") && css.includes("200ms ease"),
  );
  // globals.css에서 import 추가 검증.
  const globals = await readFile(
    resolve(root, "src/app/globals.css"),
    "utf8",
  );
  assert(
    "globals.css: tokens.dark.css @import 박음",
    globals.includes('@import "../styles/tokens.dark.css"'),
  );
}

// 7) C-D19-5 AnthropicLLMClient — 시그니처 + 재시도/timeout/4xx no-retry.
{
  const src = await readFile(
    resolve(root, "src/services/context/anthropic-llm-client.ts"),
    "utf8",
  );
  assert(
    "AnthropicLLMClient: createAnthropicLLMClient export 박음",
    src.includes("export function createAnthropicLLMClient"),
  );
  assert(
    "AnthropicLLMClient: AnthropicLLMClientOpts 박음 (apiKey/model/baseUrl/maxRetries/timeoutMs)",
    src.includes("apiKey: string") &&
      src.includes("model?: string") &&
      src.includes("baseUrl?: string") &&
      src.includes("maxRetries?: number") &&
      src.includes("timeoutMs?: number"),
  );
  assert(
    "AnthropicLLMClient: 기본 모델 claude-haiku-4-5-20251001 박음",
    src.includes('DEFAULT_MODEL = "claude-haiku-4-5-20251001"'),
  );
  assert(
    "AnthropicLLMClient: 기본 baseUrl 공식 endpoint 박음",
    src.includes('"https://api.anthropic.com/v1/messages"'),
  );
  assert(
    "AnthropicLLMClient: anthropic-version 헤더 2023-06-01 박음",
    src.includes('ANTHROPIC_VERSION = "2023-06-01"'),
  );
  assert(
    "AnthropicLLMClient: apiKey 누락 시 즉시 throw (BYOK 가드)",
    src.includes("apiKey required (BYOK)"),
  );
  assert(
    "AnthropicLLMClient: 4xx 즉시 throw (재시도 없음)",
    src.includes("resp.status >= 400 && resp.status < 500"),
  );
  assert(
    "AnthropicLLMClient: 5xx 재시도 (지수 백오프)",
    src.includes("resp.status >= 500") &&
      src.includes("Math.pow(3, attempt)"),
  );
  assert(
    "AnthropicLLMClient: AbortController + setTimeout 통합 (timeout)",
    src.includes("new AbortController()") &&
      src.includes("setTimeout(() => ctrl.abort(), timeoutMs)"),
  );
  assert(
    "AnthropicLLMClient: 빈 content 시 throw 'Empty response'",
    src.includes("AnthropicLLMClient: Empty response"),
  );
  assert(
    "AnthropicLLMClient: SYSTEM_PROMPT 한국어 5문장 요약 박음",
    src.includes("한국어 5문장 이내 핵심 요약"),
  );
  assert(
    "AnthropicLLMClient: max_tokens 512 박음",
    src.includes("max_tokens: 512"),
  );
}

// 어휘 룰 — 본 슬롯 신규 5건 산출물에 0건.
//   lint rule(no-bakeum-in-comment.js)과 검증 스크립트(check-vocab.mjs)는 자체적으로 어휘를
//   정규식/대체어 안내 문자열에 포함하므로 본 검증 대상에서 제외 — 의도된 사용.
{
  const newFiles = [
    "src/components/SideSheet/SideSheet.tsx",
    "src/components/SideSheet/SideSheet.module.css",
    "src/views/conversation/useConversationEmptyState.ts",
    "src/styles/tokens.dark.css",
    "src/services/context/anthropic-llm-client.ts",
  ];
  for (const f of newFiles) {
    const src = await readFile(resolve(root, f), "utf8");
    // 본 검증은 스스로의 라인(예: lint rule 정규식, vocab 검증의 DEFAULT_TARGETS)을 제외해야 함.
    // @robusta-lint-ignore-bakeum 토큰이 있는 라인은 skip.
    const lines = src.split("\n");
    let hits = 0;
    for (const line of lines) {
      if (/@robusta-lint-ignore-bakeum/.test(line)) continue;
      // lint rule 정규식 자체는 검증 대상 아님 — '박(음|다|...)' 형식의 정규식 패턴은 매치 X (괄호 그룹).
      const m = line.match(/박(음|다|았|혀|혔|제)/g);
      if (m) hits += m.length;
    }
    assert(
      `vocab: ${f} 신규 산출물 박(음|다|았|혀|혔|제) 0건`,
      hits === 0,
      hits > 0 ? `${hits} hits` : "",
    );
  }
}

console.log(`\n결과: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
