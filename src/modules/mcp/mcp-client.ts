/**
 * mcp/mcp-client.ts
 *   C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-3 (Phase 1 stub).
 *   C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 (Phase 2 진입점 wiring).
 *
 * Why: Spec 005 MCP 의 "단일 진입점". 호출자는 본 파일의 callMcpTool 만 사용한다.
 *   - SDK 본체(@modelcontextprotocol/sdk) 정적 import 는 본 파일에 0건 의무.
 *   - mcp-bundle.ts 는 dynamic import 로만 접근 → 메인 번들 +0 보호.
 *   - bundle import 실패(SDK 미가용) 시 mcp-rpc-fallback 자동 — BYOK 정합 fetch JSON-RPC.
 *
 * Phase 1 stub (createStubMCPClient) 도 유지 — 기존 호출자(MCPSection 등) 회귀 보호.
 *
 * 6 게이트 정합:
 *   (1) dynamic import — await import('./mcp-bundle')
 *   (3) 단일 진입점 — callMcpTool 외부 export 만 SDK 호출 경로
 *   (5) 정적 import 0건 — `from "@modelcontextprotocol/sdk"` 본 파일에 0
 */

import type { MCPClient, MCPTool } from "./types";
import { McpError } from "./mcp-types";

/**
 * Phase 1 stub — 기존 회귀 보호 (D-D32 진입 골격).
 *   - listTools: 빈 배열
 *   - callTool: throw (Phase 2 미구현 표시)
 */
export function createStubMCPClient(): MCPClient {
  return {
    async listTools(): Promise<MCPTool[]> {
      return [];
    },
    async callTool(): Promise<unknown> {
      throw new Error("MCP not yet implemented (Phase 2)");
    },
  };
}

/**
 * Spec 005 Phase 2 단일 진입점 — MCP tool 호출.
 *   호출 흐름:
 *     1) args JSON-serializable 검증 (조기 fail — invalid_args)
 *     2) await import('./mcp-bundle') — 동적 chunk fetch
 *     3) bundle.invokeMcp(serverName, toolName, args)
 *     4) (2) 또는 (3) 실패 시 mcp-rpc-fallback.invokeMcpFallback 으로 자동 fallback
 *
 *   throw 종류:
 *     - McpError("invalid_args") — args 직렬화 실패
 *     - McpError("unreachable") — bundle/fallback 모두 endpoint 미등록 또는 네트워크
 *     - McpError("timeout") — fallback 5s 초과
 *     - McpError("internal" | "tool_not_found" | "sdk_unavailable") — 기타
 *
 *   주의: 본 함수 내 `import("@modelcontextprotocol/sdk")` 정적 import 절대 금지.
 *     모든 SDK 접근은 mcp-bundle 경유.
 */
export async function callMcpTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // (1) args JSON-serializable 검증 — 조기 fail.
  try {
    JSON.stringify(args);
  } catch {
    throw new McpError("invalid_args", { serverName, toolName });
  }

  // (2) bundle dynamic import — 실패 시 fallback 자동.
  let useBundle = true;
  try {
    const bundle = await import("./mcp-bundle");
    return await bundle.invokeMcp(serverName, toolName, args);
  } catch (err) {
    // bundle import 자체가 실패한 경우만 fallback.
    // bundle 안에서 throw 한 McpError 는 그대로 caller 에 전파.
    if (err instanceof McpError) {
      // bundle 은 import 성공했고 invoke 단계에서 실패 — fallback 시도.
      useBundle = false;
    } else {
      // import 실패 — SDK 미가용 또는 chunkLoad 실패 — fallback 시도.
      useBundle = false;
    }
  }

  if (!useBundle) {
    const fallback = await import("./mcp-rpc-fallback");
    return fallback.invokeMcpFallback(serverName, toolName, args);
  }
  // 도달 불가 (TS narrowing 만족용).
  throw new McpError("internal", { serverName, toolName });
}
