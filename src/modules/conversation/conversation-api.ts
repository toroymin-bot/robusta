import { composeSystemPrompt } from "./system-prompt-composer";
import { parseAnthropicStream } from "./stream-parser";
import type { Message, MessageUsage } from "./conversation-types";
import type { Participant } from "@/modules/participants/participant-types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const FALLBACK_MODEL = "claude-3-5-sonnet-latest";

export interface StreamMessageInput {
  apiKey: string;
  speaker: Participant; // kind === 'ai' 강제
  participants: Participant[];
  history: Message[]; // createdAt 오름차순
  signal?: AbortSignal;
  maxTokens?: number;
  conversationTitle?: string;
}

export type StreamChunk =
  | { kind: "delta"; text: string }
  | { kind: "usage"; usage: MessageUsage }
  | { kind: "done" }
  | { kind: "aborted" }
  | { kind: "error"; reason: string; status?: number };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export function historyToAnthropicMessages(
  history: Message[],
  speakerId: string,
  participants: Participant[],
): AnthropicMessage[] {
  const nameById = new Map<string, string>();
  for (const p of participants) nameById.set(p.id, p.name);

  const out: AnthropicMessage[] = [];
  for (const m of history) {
    if (m.status === "error" || m.status === "aborted") continue;
    if (m.content.length === 0) continue;
    const role: AnthropicMessage["role"] =
      m.participantId === speakerId ? "assistant" : "user";
    const speakerName = nameById.get(m.participantId) ?? m.participantId;
    const content = role === "user" ? `[${speakerName}] ${m.content}` : m.content;

    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role, content });
    }
  }

  return out;
}

interface AnthropicErrorBody {
  error?: { type?: string; message?: string };
}

async function describeErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as AnthropicErrorBody;
    if (body.error?.message) return body.error.message;
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`;
}

export async function* streamMessage(
  input: StreamMessageInput,
): AsyncGenerator<StreamChunk, void, void> {
  if (input.speaker.kind !== "ai") {
    throw new Error("streamMessage: speaker must be ai");
  }
  if (input.signal?.aborted) {
    yield { kind: "aborted" };
    return;
  }

  const model = input.speaker.model ?? FALLBACK_MODEL;
  const system = composeSystemPrompt({
    speaker: input.speaker,
    participants: input.participants,
    locale: "ko",
    conversationTitle: input.conversationTitle,
  });
  const messages = historyToAnthropicMessages(
    input.history,
    input.speaker.id,
    input.participants,
  );

  if (messages.length === 0) {
    yield { kind: "error", reason: "history is empty" };
    return;
  }
  if (messages[messages.length - 1]!.role !== "user") {
    yield { kind: "error", reason: "last message must be user role" };
    return;
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1024,
        stream: true,
        system,
        messages,
      }),
      signal: input.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      yield { kind: "aborted" };
      return;
    }
    yield {
      kind: "error",
      reason: err instanceof Error ? err.message : "network error",
    };
    return;
  }

  if (!response.ok) {
    const reason = await describeErrorResponse(response);
    yield { kind: "error", reason, status: response.status };
    return;
  }

  if (!response.body) {
    yield { kind: "error", reason: "response body missing" };
    return;
  }

  const usage: MessageUsage = {};
  let usageDirty = false;

  try {
    for await (const evt of parseAnthropicStream(response.body)) {
      if (input.signal?.aborted) {
        yield { kind: "aborted" };
        return;
      }
      switch (evt.type) {
        case "message_start": {
          const inTok = evt.usage?.input_tokens;
          if (typeof inTok === "number") {
            usage.inputTokens = inTok;
            usageDirty = true;
          }
          break;
        }
        case "content_block_delta": {
          const delta = evt.delta;
          if (delta && delta.type === "text_delta") {
            const text = (delta as { type: "text_delta"; text: string }).text;
            if (text.length > 0) yield { kind: "delta", text };
          }
          break;
        }
        case "message_delta": {
          const outTok = evt.usage?.output_tokens;
          if (typeof outTok === "number") {
            usage.outputTokens = outTok;
            usageDirty = true;
          }
          break;
        }
        case "message_stop": {
          if (usageDirty) yield { kind: "usage", usage };
          yield { kind: "done" };
          return;
        }
        case "error": {
          yield { kind: "error", reason: evt.error.message };
          return;
        }
        default:
          // ping / content_block_start / content_block_stop → noop
          break;
      }
    }
    if (usageDirty) yield { kind: "usage", usage };
    yield { kind: "done" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      yield { kind: "aborted" };
      return;
    }
    yield {
      kind: "error",
      reason: err instanceof Error ? err.message : "stream error",
    };
  }
}

export const __conversation_api_internal = {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  FALLBACK_MODEL,
};
