/**
 * mcp/mcp-types.ts
 *   C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 (Task §1 §7).
 *
 * Why: Spec 005 MCP Phase 2 wiring 본체에서 사용하는 신규 타입.
 *   기존 mcp/types.ts (Phase 1 stub) 와 분리 — Phase 2 진입점 전용.
 *   기존 자산은 보존하면서 신규 함수 시그니처용 에러/요청 타입만 정의.
 *
 * 외부 의존 0 — 본 파일은 타입만 정의 (런타임 코드 0).
 */

/** Spec 005 Phase 2 — MCP 호출 시 발생할 수 있는 에러 종류. */
export type McpErrorReason =
  | "unreachable"
  | "invalid_args"
  | "timeout"
  | "sdk_unavailable"
  | "tool_not_found"
  | "internal";

/**
 * MCP 호출 실패. callMcpTool 이 throw 하는 단일 클래스.
 *   - reason: 분기 가능한 에러 종류
 *   - context: 추가 정보 (serverName, toolName 등 — 디버그용)
 */
export class McpError extends Error {
  readonly reason: McpErrorReason;
  readonly context: Record<string, unknown>;

  constructor(
    reason: McpErrorReason,
    context: Record<string, unknown> = {},
    message?: string,
  ) {
    super(message ?? `MCP call failed: ${reason}`);
    this.name = "McpError";
    this.reason = reason;
    this.context = context;
  }
}

/** JSON-RPC 2.0 요청 — fallback 에서 사용 (외부 SDK 미사용). */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 응답 — fallback 응답 파싱용. */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** MCP 서버 endpoint 등록 — fallback 에서 serverName → URL 해석에 사용. */
export interface McpServerEndpoint {
  /** 등록 키 — callMcpTool serverName 인자와 매칭. */
  name: string;
  /** HTTP/SSE endpoint URL. stdio 는 본 클라이언트(브라우저)에서 미지원. */
  url: string;
}
