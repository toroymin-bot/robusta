/**
 * eslint.config.mjs
 *   - C-D20-5 (D6 11시 슬롯, 2026-05-01) — F-29 ESLint config 자동 가드 등록.
 *   - Next.js 15 flat config + eslint-config-next compat + 커스텀 rule (no-bakeum-in-comment).
 *
 * 정책:
 *   - robusta/no-bakeum-in-comment: 'error' — D6 11시 슬롯에 잔여 어휘 88건 → 0건 정리 후 강제.
 *   - 예외 토큰: 같은 주석 라인에 `@robusta-lint-ignore-bakeum` 명시 시 무시.
 *
 * 사용:
 *   - `npm run lint`  → next lint 통합. 0 error 목표.
 *   - 개별 점검은 `node scripts/check-vocab.mjs` (ESLint config 미필요 standalone 검증).
 */

import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const compat = new FlatCompat({ baseDirectory: __dirname });

const noBakeumRule = require("./eslint-rules/no-bakeum-in-comment.js");

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: {
      robusta: {
        rules: {
          "no-bakeum-in-comment": noBakeumRule,
        },
      },
    },
    rules: {
      "robusta/no-bakeum-in-comment": "error",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "scripts/**",
      "eslint-rules/**",
      "tests/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
    ],
  },
];
