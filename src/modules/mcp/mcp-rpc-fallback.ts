/**
 * mcp/mcp-rpc-fallback.ts
 *   C-D35-1 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-1 (Task §1 §7).
 *
 * Why: SDK 미가용/import 실패 시 자체 JSON-RPC 2.0 fetch 호출로 fallback.
 *   외부 의존 0 — fetch + AbortController 표준 API 만 사용.
 *
 * 정책:
 *   - 5초 timeout (AbortController) — 명세 §C-D35-1 엣지 (3).
 *   - HTTP 응답 비-200 → McpError("unreachable").
 *   - JSON-RPC error 응답 → McpError("internal" or "tool_not_found").
 *   - 등록 endpoint 부재 → McpError("unreachable", { serverName }).
 *
 * 보안: 본 fallback 도 BYOK 정합 — Robusta 서버 미경유, 사용자 등록 endpoint 직접 호출.
 *   현재는 in-memory 등록만 (Phase 3 에서 사용자 설정 UI wiring).
 */

import {
  McpError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpServerEndpoint,
} from "./mcp-types";

const REQUEST_TIMEOUT_MS = 5000;

/** 등록된 endpoint in-memory store. Phase 3 UI 도입 시 store 로 이전. */
const endpoints = new Map<string, McpServerEndpoint>();

/**
 * 테스트/Phase 3 UI 용 — endpoint 등록.
 *   동일 name 이면 덮어씀.
 */
export function registerMcpEndpoint(endpoint: McpServerEndpoint): void {
  endpoints.set(endpoint.name, endpoint);
}

/**
 * 테스트 용 — 등록 초기화.
 */
export function __resetMcpEndpoints(): void {
  endpoints.clear();
}

let nextRequestId = 1;

/**
 * JSON-RPC 2.0 fetch fallback.
 *   호출 흐름:
 *     1) endpoints.get(serverName) 없으면 throw McpError("unreachable")
 *     2) AbortController 5s timeout
 *     3) POST endpoint.url body=JsonRpcRequest
 *     4) 비-200 → throw McpError("unreachable")
 *     5) JSON-RPC error code -32601 → throw McpError("tool_not_found")
 *        (그 외) → throw McpError("internal")
 *     6) result return
 */
export async function invokeMcpFallback(
  serverName: string,
  toolName: string,
  args: object,
): Promise<unknown> {
  const endpoint = endpoints.get(serverName);
  if (!endpoint) {
    throw new McpError("unreachable", { serverName });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: nextRequestId++,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new McpError("timeout", { serverName, toolName });
    }
    throw new McpError("unreachable", { serverName, toolName });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new McpError("unreachable", {
      serverName,
      toolName,
      status: res.status,
    });
  }

  let parsed: JsonRpcResponse;
  try {
    parsed = (await res.json()) as JsonRpcResponse;
  } catch {
    throw new McpError("internal", { serverName, toolName, parse: "json" });
  }

  if (parsed.error) {
    const reason =
      parsed.error.code === -32601 ? "tool_not_found" : "internal";
    throw new McpError(reason, {
      serverName,
      toolName,
      code: parsed.error.code,
      message: parsed.error.message,
    });
  }

  return parsed.result;
}
