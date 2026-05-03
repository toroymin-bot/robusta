# Spec 005 — MCP Phase 2 wiring (D-4 진입 사전 준비 미러)

> **본 문서는 꼬미 자율 미러.** 본격 명세는 D-4 (5/4) 똘이 첫 슬롯 (01시) §1 에서 작성됨.
> 본 슬롯 (D-5 19시 §10) 은 Phase 2 진입 전 사전 영향 분석 + UI chip 표시만 담당 (C-D33-4 / F-D33-4 정합).

---

## 1. 출처

- **부모 명세:** Confluence Robusta 스페이스 / Task_2026-05-03 §9 — 똘이 17시 v1 / C-D33-4 (P1).
- **꼬미 슬롯:** D-5 19시 (§10) — C-D33-4.
- **상위 컨셉:** Robusta 사이드바 moreItems / MCP 통합.

## 2. Phase 1 골격 (D-D32 §8 완료)

| 파일 | 책임 |
| --- | --- |
| `src/modules/mcp/types.ts` | `MCPTool` / `MCPClient` / `MCPServerConfig` interface |
| `src/modules/mcp/mcp-client.ts` | `createStubMCPClient` — `listTools = []`, `callTool throw` |
| `src/modules/mcp/mcp-section.tsx` | Settings 진입 시 disabled 표기 (Phase 2 예정) |
| `src/modules/mcp/index.ts` | barrel export |
| i18n | `mcp.section.title` / `mcp.section.placeholder` |

## 3. Phase 2 진입 사전 영향 분석 (npm view @modelcontextprotocol/sdk @ 2026-05-03 19:15 KST)

| 항목 | 값 |
| --- | --- |
| 최신 version | **1.29.0** (dist-tag latest) |
| unpacked size | **4.27 MB** (4,268,166 bytes) |
| 파일 수 | **677** |
| 주요 deps (17) | `@hono/node-server`, `ajv`, `ajv-formats`, `content-type`, `cors`, `cross-spawn`, `eventsource`, `eventsource-parser`, `express`, `express-rate-limit`, `hono`, `jose`, `json-schema-typed`, `pkce-challenge`, `raw-body`, `zod`, `zod-to-json-schema` |

**⚠ 168 정식 HARD GATE 영향 — 큼.**

- 4.27 MB 는 명세 임계값 50 kB 의 약 85배.
- deps 중 `express` / `hono` / `cors` / `@hono/node-server` 는 명백히 **서버 런타임용** — Robusta 는 client-only BYOK 이므로 server pieces 미사용.
- dist 안에서 서버/클라이언트가 분리되어 있는지 (`/dist/server` vs `/dist/client`) D-4 진입 시 검증 필수.

## 4. D-4 진입 시 강제 사항 (꼬미 권고 → D-4 똘이 명세에 흡수 권장)

1. **dynamic import 강제** — `import("@modelcontextprotocol/sdk/client/...")` 의 lazy chunk 만 허용. 메인 번들 ≤ +0.5 kB 의무 (chunk hint pre-fetch 예외).
2. **server entry 차단** — webpack/turbopack `resolve.alias` 또는 `next.config.ts` 로 `@modelcontextprotocol/sdk/server/*` 를 client bundle 에서 명시 차단.
3. **Phase 2 단일 진입점** — `src/modules/mcp/mcp-client.ts` 안 `createStubMCPClient` → `createRealMCPClient` 로 stub 제거. import 경로는 `@modelcontextprotocol/sdk/client/index.js` 단일 (sub-path 만).
4. **i18n parity** — `mcp.section.title` / `mcp.section.placeholder` / `mcp.section.phase2.label` 3키 ko/en 모두 갱신 (Phase 2 활성 후 placeholder → 실 도구 카운트 라벨 등).
5. **회귀 게이트 갱신** — verify-d35 (또는 D-4 사이클 게이트) 에 `chunkSize(@modelcontextprotocol/sdk) ≤ 1.5 MB` + `mainBundle 영향 ≤ 0.5 kB` 두 룰 추가.
6. **자체 클라이언트 검토** — 4.27 MB 부담이 크다면, MCP JSON-RPC 프로토콜만 자체 구현 (Robusta 는 `tool/call` `tool/list` 두 RPC 만 사용 가정 — D-4 진입 시 명세 검증).

## 5. 본 슬롯 (D-D33) 처리

| 항목 | 값 |
| --- | --- |
| 신규 파일 | `specs/spec-005-mcp-phase2-wiring.md` (본 문서, 꼬미 자율 미러) |
| 코드 변경 | `src/modules/mcp/mcp-section.tsx` — Phase 2 disabled chip 1개 추가 (i18n key `mcp.section.phase2.label`) |
| 외부 dev-dep 추가 | **0** (Phase 2 SDK 도입 D-4 까지 보류) |
| 168 정식 HARD GATE 영향 | ≤ +0.1 kB (i18n 1키 + chip span 1개) |
| 회귀 게이트 | verify-d33.mjs §4 — `mcp.section.phase2.label` ko/en parity + `@modelcontextprotocol/sdk` 미도입 가드 + chip disabled 유지 |

## 6. 변경 로그

| 날짜 | 작성자 | 내용 |
| --- | --- | --- |
| 2026-05-03 19:15 KST | 꼬미 (D-D33 §10) | 초안 — Phase 2 진입 사전 영향 분석 + 권고 6건. 본격 wiring 명세는 D-4 (5/4) 똘이 슬롯에 위임. |
