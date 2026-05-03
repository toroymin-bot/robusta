/**
 * mcp/types.ts
 *   C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-3 (F-D32-3).
 *   Spec 005 MCP (Model Context Protocol) 골격 — 도메인 타입 정의.
 *
 *   Phase 1 (D-4 / 5/4): 본 골격 + stub 클라이언트만. 실 호출은 throw.
 *   Phase 2: `@modelcontextprotocol/sdk` adapter 도입 — 본 인터페이스에 맞춰 wiring.
 *
 *   외부 의존 0 — 본 파일은 타입만 정의 (런타임 코드 0).
 */

export interface MCPTool {
  /** 도구 식별자 (server scope 내 고유). */
  name: string;
  /** 사용자 노출 가능한 짧은 설명. */
  description: string;
  /** JSON Schema 형식의 입력 스키마. SDK 도입 후 더 엄격한 타입으로 교체 가능. */
  inputSchema: Record<string, unknown>;
}

export interface MCPClient {
  /** 서버에 등록된 도구 목록 조회. Phase 1 stub: [] 반환. */
  listTools(): Promise<MCPTool[]>;
  /** 도구 실행. Phase 1 stub: throw. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export type MCPTransport = "stdio" | "sse" | "http";

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransport;
  endpoint?: string;
}
