/**
 * system-prompt-composer.ts — 매 turn AI 발언자에게 주입되는 시스템 프롬프트 생성.
 *
 * D2 PR1: 한국어 본격 카피 + speaker 마커 + persona 부착.
 * D3 (D-8.1, 2026-04-27): 명세 본문 정렬 — 정체성/다른 참여자/행동 원칙 5개,
 *   영문(en) 본격 카피 추가, role 필드 옵션 처리.
 *
 * OCP — 기존 시그니처(`speaker`/`participants`) 보존, 본문만 본격 교체.
 *   기존 [규칙] 5개 → 명세 [행동 원칙] 5개로 ~~수정~~. en은 ~~ko fallback~~ → 본격 영문.
 */

import type { Participant } from "@/modules/participants/participant-types";

export interface ComposeSystemPromptOptions {
  /** 현재 발언할 참여자. kind === 'ai' 만 허용. */
  speaker: Participant;
  /** 같은 conversation의 전체 참여자 (speaker 포함). */
  participants: Participant[];
  /** 대화 주제 (선택). */
  conversationTitle?: string;
  /** 출력 언어 (default 'ko'). */
  locale?: "ko" | "en";
}

/** speaker.systemPrompt 최대 길이 (D-8.1 customAppend 역할). */
const MAX_PERSONA_CHARS = 8000;

/** 한 명의 참여자를 사람이 읽을 수 있는 라인으로 변환. */
function buildOtherLine(p: Participant, locale: "ko" | "en"): string {
  if (locale === "en") {
    // 영문: "- {name} ({Human|AI · model})"
    const kind = p.kind === "human" ? "Human" : `AI · ${p.model ?? "model unknown"}`;
    return `- ${p.name} (${kind})`;
  }
  // 한국어: "- {name} ({인간 | AI · model})"
  const kind = p.kind === "human" ? "인간" : `AI · ${p.model ?? "모델 미지정"}`;
  return `- ${p.name} (${kind})`;
}

/**
 * 명세대로 정체성/다른 참여자/행동 원칙 박은 시스템 프롬프트 생성.
 * 매 turn 새로 생성 — 캐싱 X (참여자 변동 즉시 반영).
 */
export function composeSystemPrompt(opts: ComposeSystemPromptOptions): string {
  // 1) self는 AI만 허용 (인간 발언자에는 system prompt 자체가 의미 없음)
  if (opts.speaker.kind !== "ai") {
    throw new Error("composeSystemPrompt: self must be ai");
  }

  const locale = opts.locale ?? "ko";
  const self = opts.speaker;
  // 2) self 제외한 다른 참여자 목록 (others.length === 0 이면 섹션 자체 생략)
  const others = opts.participants.filter((p) => p.id !== self.id);

  // 3) persona = 사용자 정의 (D2 systemPrompt 필드 = 명세 customAppend 역할)
  const persona = self.systemPrompt ?? "";
  const trimmedPersona =
    persona.length > MAX_PERSONA_CHARS ? persona.slice(0, MAX_PERSONA_CHARS) : persona;
  if (persona.length > MAX_PERSONA_CHARS) {
    console.warn(
      `[robusta] composeSystemPrompt: speaker.systemPrompt truncated to ${MAX_PERSONA_CHARS} chars.`,
    );
  }

  if (locale === "en") {
    return composeEn({
      self,
      others,
      conversationTitle: opts.conversationTitle,
      persona: trimmedPersona,
    });
  }
  return composeKo({
    self,
    others,
    conversationTitle: opts.conversationTitle,
    persona: trimmedPersona,
  });
}

interface InternalArgs {
  self: Participant;
  others: Participant[];
  conversationTitle?: string;
  persona: string;
}

/** 한국어 본문 — 명세 §2 그대로. */
function composeKo({ self, others, conversationTitle, persona }: InternalArgs): string {
  const lines: string[] = [];

  // 헤더 — 자기 정체 선언
  lines.push(
    `당신은 ${self.name}입니다. 이 대화는 BYOK 기반 Robusta 서비스에서 진행됩니다.`,
  );

  // 대화 주제 (있으면)
  if (conversationTitle && conversationTitle.trim().length > 0) {
    lines.push("");
    lines.push(`[대화 주제] ${conversationTitle.trim()}`);
  }

  // 정체성 섹션 — 명세 §2
  lines.push("");
  lines.push("# 정체성");
  lines.push(`- 이름: ${self.name}`);
  lines.push(`- 역할: 대화 참여자`);
  lines.push(`- 모델: ${self.model ?? "모델 미지정"}`);

  // 다른 참여자 섹션 — others.length === 0 이면 섹션 생략 (명세 엣지)
  if (others.length > 0) {
    lines.push("");
    lines.push("# 다른 참여자");
    for (const p of others) {
      lines.push(buildOtherLine(p, "ko"));
    }
  }

  // 행동 원칙 5개 — 명세 §2 그대로
  lines.push("");
  lines.push("# 행동 원칙");
  lines.push("1. 항상 자신의 이름을 알고, 다른 참여자와 자신을 혼동하지 않는다.");
  lines.push(
    "2. 다른 참여자의 메시지는 [이름] 본문 형식으로 전달된다. 당신의 답변에는 [이름] 접두를 붙이지 않는다.",
  );
  lines.push("3. 사용자(인간)의 의도를 정확히 파악하고, 짧고 직설적으로 답한다.");
  lines.push("4. 추측이 필요한 경우 \"추정\"이라 명시한다.");
  lines.push("5. 서로 다른 AI는 관점이 다르다. 동의/반대를 명확히 한다.");

  // persona (있으면) — 명세 customAppend 역할
  if (persona.trim().length > 0) {
    lines.push("");
    lines.push("# 사용자 정의");
    lines.push(persona);
  }

  return lines.join("\n");
}

/** 영문 본문 — 명세 §2 의 의미 동일 번역. */
function composeEn({ self, others, conversationTitle, persona }: InternalArgs): string {
  const lines: string[] = [];

  // Header — self-identity declaration
  lines.push(
    `You are ${self.name}. This conversation runs on the BYOK-based Robusta service.`,
  );

  if (conversationTitle && conversationTitle.trim().length > 0) {
    lines.push("");
    lines.push(`[Topic] ${conversationTitle.trim()}`);
  }

  lines.push("");
  lines.push("# Identity");
  lines.push(`- Name: ${self.name}`);
  lines.push(`- Role: conversation participant`);
  lines.push(`- Model: ${self.model ?? "model unknown"}`);

  if (others.length > 0) {
    lines.push("");
    lines.push("# Other participants");
    for (const p of others) {
      lines.push(buildOtherLine(p, "en"));
    }
  }

  lines.push("");
  lines.push("# Behavior principles");
  lines.push(
    "1. Always know your own name; never confuse yourself with another participant.",
  );
  lines.push(
    "2. Other participants' messages are delivered as [Name] body. Do NOT prefix your own reply with [Name].",
  );
  lines.push(
    "3. Read the human's intent accurately and answer briefly and directly.",
  );
  lines.push('4. When you need to speculate, mark it as "speculation".');
  lines.push(
    "5. Different AIs have different views. State agreement or disagreement clearly.",
  );

  if (persona.trim().length > 0) {
    lines.push("");
    lines.push("# Custom persona");
    lines.push(persona);
  }

  return lines.join("\n");
}

export const __composer_internal = { MAX_PERSONA_CHARS };
