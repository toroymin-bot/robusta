import type { Participant } from "./participant-types";

export const DEFAULT_PARTICIPANTS: Participant[] = [
  {
    id: "roy",
    kind: "human",
    name: "로이",
    color: "hsl(20 65% 55%)",
  },
  {
    id: "tori",
    kind: "ai",
    name: "똘이",
    color: "hsl(200 65% 55%)",
    model: "claude-opus-4-7",
    systemPrompt: "",
  },
  {
    id: "komi",
    kind: "ai",
    name: "꼬미",
    color: "hsl(130 65% 55%)",
    model: "claude-sonnet-4-6",
    systemPrompt: "",
  },
];
