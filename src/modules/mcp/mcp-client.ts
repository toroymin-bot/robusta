/**
 * mcp/mcp-client.ts
 *   C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-3 (F-D32-3).
 *   Phase 1 stub MCP client. Phase 2 SDK 도입 시점에 adapter 로 교체.
 *
 *   본 파일은 lazy import 권장 — 메인 번들에 stub 자체가 들어갈 일은 없도록 호출자가 dynamic import.
 */

import type { MCPClient, MCPTool } from "./types";

/**
 * Stub 구현 — Phase 1 한정.
 *   - listTools: 빈 배열
 *   - callTool: 명시적 throw (Phase 2 미구현 표시)
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
