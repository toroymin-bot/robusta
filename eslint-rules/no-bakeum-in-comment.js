/**
 * no-bakeum-in-comment.js
 *   - C-D19-3 (D6 07시 슬롯, 2026-05-01) — F-29 채택분.
 *   - Roy 어휘 룰 (Do v22, 2026-04-30): "박음/박다/박혀/박았/박제" 어휘는 저급 표현으로
 *     산출물(코드 주석 포함)에서 사용 금지. 대체어: 고정 / 적용 / 등록 / 정의 / 보존.
 *
 * 규칙:
 *   - Line 또는 Block 주석에서 정규식 /박(음|다|았|혀|혔|제)/ 매칭 시 warning.
 *   - autofix 미제공 — 의미 분기(위치/데이터/모듈)에 따라 사람이 결정해야 함.
 *   - 예외: 같은 주석 라인에 `@robusta-lint-ignore-bakeum` 토큰이 있으면 무시.
 *
 * 사용:
 *   eslint.config.{js,mjs} 에 다음과 같이 등록 (ESLint v9 flat config):
 *     import noBakeum from "./eslint-rules/no-bakeum-in-comment.js";
 *     export default [{ plugins: { robusta: { rules: { "no-bakeum-in-comment": noBakeum } } },
 *                       rules: { "robusta/no-bakeum-in-comment": "warn" } }];
 *
 *   또는 standalone 검증은 scripts/check-vocab.mjs 사용 (ESLint config 미필요).
 *
 * 참고:
 *   - 변수명·함수명·문자열 리터럴은 영향 없음 (주석 노드만 검사).
 *   - 한국어 외 언어 주석은 영향 없음.
 *   - CHANGELOG / docs 마크다운은 lint 대상 외 (eslint glob 으로 src/ 한정 권장).
 */

"use strict";

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow '박음/박다/박혀/박았/박제' in comments — use 고정/적용/등록/정의/보존.",
      category: "Stylistic Issues",
    },
    schema: [],
    messages: {
      avoid:
        "어휘 룰 위배: '{{match}}' — 고정/적용/등록/정의/보존 중 의미별 대체어 사용. (Roy Do v22 2026-04-30)",
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode();
    const pattern = /박(음|다|았|혀|혔|제)/g;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (/@robusta-lint-ignore-bakeum/.test(comment.value)) continue;
          const matches = comment.value.matchAll(pattern);
          for (const m of matches) {
            context.report({
              loc: comment.loc,
              messageId: "avoid",
              data: { match: m[0] },
            });
          }
        }
      },
    };
  },
};

module.exports = rule;
