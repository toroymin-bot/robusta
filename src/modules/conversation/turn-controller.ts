import type { Participant } from "@/modules/participants/participant-types";

export type TurnMode = "manual" | "round-robin" | "trigger";

export interface PickNextSpeakerOptions {
  mode: TurnMode;
  lastSpeakerId: string | null;
  participants: Participant[];
  manualPick?: string;
}

export function pickNextSpeaker(opts: PickNextSpeakerOptions): string {
  if (opts.mode === "manual") {
    if (!opts.manualPick) {
      throw new Error("manual mode requires manualPick");
    }
    const exists = opts.participants.some((p) => p.id === opts.manualPick);
    if (!exists) {
      throw new Error(`manualPick "${opts.manualPick}" not in participants`);
    }
    return opts.manualPick;
  }
  throw new Error(`mode not implemented in D2: ${opts.mode}`);
}
