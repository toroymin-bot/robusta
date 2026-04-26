export type ParticipantKind = "human" | "ai";

export interface Participant {
  id: string;
  kind: ParticipantKind;
  name: string;
  color: string;
  model?: string;
  systemPrompt?: string;
}

export type ParticipantInput = Omit<Participant, "id" | "color"> & {
  color?: string;
};
