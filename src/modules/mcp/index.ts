/**
 * mcp/index.ts
 *   C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-3 (F-D32-3).
 *   Spec 005 MCP 모듈 진입점. 타입 + stub re-export.
 */

export type {
  MCPTool,
  MCPClient,
  MCPTransport,
  MCPServerConfig,
} from "./types";
export { createStubMCPClient } from "./mcp-client";
