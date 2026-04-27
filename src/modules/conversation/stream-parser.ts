export type AnthropicStreamEvent =
  | { type: "message_start"; usage?: { input_tokens?: number } }
  | { type: "content_block_start"; index: number }
  | {
      type: "content_block_delta";
      index?: number;
      delta: { type: "text_delta"; text: string } | { type: string };
    }
  | { type: "content_block_stop"; index?: number }
  | { type: "message_delta"; usage?: { output_tokens?: number } }
  | { type: "message_stop" }
  | { type: "error"; error: { type?: string; message: string } }
  | { type: "ping" };

export interface StreamParserOptions {
  onWarn?: (raw: string, err: unknown) => void;
}

const DECODER = new TextDecoder("utf-8");

function defaultWarn(raw: string, err: unknown): void {
  console.warn("[robusta] SSE parse fail", err, raw);
}

function* splitFrames(buffer: string): Generator<string, string, void> {
  let cursor = 0;
  while (true) {
    const idx = buffer.indexOf("\n\n", cursor);
    if (idx === -1) {
      // 남은 미완성 frame 반환
      const _remainder = buffer.slice(cursor);
      // generator return 으로 미완성 부분 전달
      // (yield 결과로 frame 만 사용)
      // eslint-disable-next-line no-empty
      void _remainder;
      return buffer.slice(cursor);
    }
    yield buffer.slice(cursor, idx);
    cursor = idx + 2;
  }
}

function parseFrame(
  frame: string,
  warn: (raw: string, err: unknown) => void,
): AnthropicStreamEvent | null {
  let dataPayload = "";
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.length === 0) continue;
    if (line.startsWith(":")) continue; // SSE comment
    if (line.startsWith("data:")) {
      const value = line.slice(5).trimStart();
      dataPayload += dataPayload.length > 0 ? `\n${value}` : value;
    }
    // event: 라인은 무시 (data: 안 type 필드만 신뢰)
  }
  if (dataPayload.length === 0) return null;
  if (dataPayload === "[DONE]") return null;
  try {
    return JSON.parse(dataPayload) as AnthropicStreamEvent;
  } catch (err) {
    warn(dataPayload, err);
    return null;
  }
}

export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
  opts: StreamParserOptions = {},
): AsyncGenerator<AnthropicStreamEvent, void, void> {
  const warn = opts.onWarn ?? defaultWarn;
  const reader = body.getReader();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += DECODER.decode(value, { stream: true });

      let cursor = 0;
      while (true) {
        const idx = buffer.indexOf("\n\n", cursor);
        if (idx === -1) break;
        const frame = buffer.slice(cursor, idx);
        cursor = idx + 2;
        const evt = parseFrame(frame, warn);
        if (evt) yield evt;
      }
      buffer = buffer.slice(cursor);
    }
    // flush remaining
    buffer += DECODER.decode();
    if (buffer.trim().length > 0) {
      const evt = parseFrame(buffer, warn);
      if (evt) yield evt;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

// splitFrames 는 단위 테스트용 (현재 generator에서 직접 사용하지 않지만 export 하지 않음)
void splitFrames;

export const __stream_parser_internal = { parseFrame };
