import type { Participant } from "@/modules/participants/participant-types";

export interface ComposeSystemPromptOptions {
  speaker: Participant;
  participants: Participant[];
  conversationTitle?: string;
  locale?: "ko" | "en";
}

const MAX_PERSONA_CHARS = 8000;

let warnedEnFallback = false;

function describeKind(p: Participant): string {
  if (p.kind === "ai") {
    return `AI · ${p.model ?? "model unknown"}`;
  }
  return "인간";
}

function buildParticipantLine(
  p: Participant,
  speakerId: string,
): string {
  const marker = p.id === speakerId ? " ← 너" : "";
  return `- ${p.name} (${describeKind(p)})${marker}`;
}

export function composeSystemPrompt(opts: ComposeSystemPromptOptions): string {
  if (opts.speaker.kind !== "ai") {
    throw new Error("system prompt only for AI speakers");
  }

  const locale = opts.locale ?? "ko";
  if (locale === "en" && !warnedEnFallback) {
    console.warn(
      "[robusta] composeSystemPrompt: 'en' locale is queued for D4; falling back to 'ko'.",
    );
    warnedEnFallback = true;
  }

  const persona = opts.speaker.systemPrompt ?? "";
  const trimmedPersona = persona.length > MAX_PERSONA_CHARS
    ? persona.slice(0, MAX_PERSONA_CHARS)
    : persona;
  if (persona.length > MAX_PERSONA_CHARS) {
    console.warn(
      `[robusta] composeSystemPrompt: speaker.systemPrompt truncated to ${MAX_PERSONA_CHARS} chars.`,
    );
  }

  const lines: string[] = [];
  lines.push(
    `너는 "${opts.speaker.name}"이다. Robusta라는 다자 대화 워크스페이스에서 다른 참여자들과 대화하고 있다.`,
  );

  if (opts.conversationTitle && opts.conversationTitle.trim().length > 0) {
    lines.push("");
    lines.push(`[대화 주제] ${opts.conversationTitle.trim()}`);
  }

  if (opts.participants.length > 0) {
    lines.push("");
    lines.push("[참여자]");
    for (const p of opts.participants) {
      lines.push(buildParticipantLine(p, opts.speaker.id));
    }
  }

  lines.push("");
  lines.push("[규칙]");
  lines.push("1. 너는 한 명의 참여자로서 발언한다. 다른 사람의 발언을 대신 만들지 않는다.");
  lines.push("2. 발언은 너의 이름으로 시작하지 않는다 (UI가 이름표를 붙인다).");
  lines.push("3. 답변은 짧고 직설적으로. 불필요한 사과·아첨 금지.");
  lines.push("4. 모르면 \"추정\"이라고 명시한다.");
  lines.push("5. 다른 참여자의 발언이 사실과 다르면 정정한다. 단, 인신 공격 없이.");

  if (trimmedPersona.trim().length > 0) {
    lines.push("");
    lines.push("[너의 추가 인격/R&R]");
    lines.push(trimmedPersona);
  }

  return lines.join("\n");
}

export const __composer_internal = { MAX_PERSONA_CHARS };
