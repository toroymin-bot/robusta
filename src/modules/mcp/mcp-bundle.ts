/**
 * mcp/mcp-bundle.ts
 *   C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 (Task §1 §7).
 *
 * Why: lazy chunk 진입점 — 본 파일에서만 @modelcontextprotocol/sdk 정적 import 허용.
 *   호출자(mcp-client) 는 본 모듈을 dynamic import 로만 접근 → 메인 번들 분리.
 *   chunkSize ≤ 1.5 MB 게이트(scripts/check-mcp-budget.mjs) 가 본 chunk 만 검증.
 *
 * 6 게이트 정합:
 *   (1) dynamic import — 호출자 책임 (mcp-client.ts await import('./mcp-bundle'))
 *   (2) server entry 차단 — next.config.ts serverExternalPackages 등록
 *   (3) 단일 진입점 — 본 파일이 SDK 직접 의존하는 유일한 곳
 *   (4) chunkSize ≤ 1.5 MB — check-mcp-budget.mjs 가 빌드 후 검증
 *   (5) alias 차단 — webpack alias 로 본 파일 외 SDK 정적 import 차단
 *   (6) RPC fallback — 본 모듈 import 실패 시 mcp-rpc-fallback 자동
 *
 * 본 파일은 SDK adapter 골격만. 실제 등록 client / endpoint 는 Phase 3.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpError } from "./mcp-types";

/** SDK Client 타입 별칭 — 호출자(mcp-client) 가 SDK 직접 import 하지 않도록 매개. */
export type McpSdkClient = Client;

/**
 * SDK Client lazy 인스턴스 캐시.
 *   serverName 별 1회 생성 — 동일 server 반복 호출 시 재사용.
 *   Phase 3 endpoint 등록 UI 도입 시 별도 store 로 이전.
 */
const clientCache = new Map<string, Client>();

/**
 * SDK 를 통한 MCP tool 호출.
 *   - serverName: 등록된 server name (현재는 in-memory client cache 만 사용)
 *   - toolName: 호출할 tool 이름
 *   - args: tool 인자 (JSON serializable)
 *
 * SDK API 표면 변경 가능성 대비 — 호출은 try/catch 로 감싸서
 * 모든 SDK 에러를 McpError("internal") 로 정규화.
 */
export async function invokeMcp(
  serverName: string,
  toolName: string,
  args: object,
): Promise<unknown> {
  const client = clientCache.get(serverName);
  if (!client) {
    throw new McpError("unreachable", {
      serverName,
      hint: "client not registered (Phase 3)",
    });
  }
  try {
    const result = await client.callTool({
      name: toolName,
      arguments: args as Record<string, unknown>,
    });
    return result;
  } catch (err) {
    throw new McpError(
      "internal",
      { serverName, toolName, cause: err instanceof Error ? err.message : String(err) },
    );
  }
}

/**
 * 테스트/Phase 3 — client 등록.
 */
export function registerMcpClient(serverName: string, client: Client): void {
  clientCache.set(serverName, client);
}

/**
 * 테스트 용 — cache reset.
 */
export function __resetMcpClients(): void {
  clientCache.clear();
}
