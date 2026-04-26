"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";
import {
  hueToHsl,
  nextParticipantHue,
  parseHueFromColor,
} from "@/modules/participants/participant-color";
import { DEFAULT_PARTICIPANTS } from "@/modules/participants/participant-seed";
import type {
  Participant,
  ParticipantInput,
} from "@/modules/participants/participant-types";

const HUMAN_KIND: Participant["kind"] = "human";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function existingHues(participants: Participant[]): number[] {
  const hues: number[] = [];
  for (const p of participants) {
    const h = parseHueFromColor(p.color);
    if (h !== null) hues.push(h);
  }
  return hues;
}

interface ParticipantStore {
  participants: Participant[];
  hydrated: boolean;
  loadFromDb: () => Promise<void>;
  add: (input: ParticipantInput) => Promise<Participant>;
  update: (id: string, patch: Partial<Participant>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setColorAuto: (id: string) => Promise<void>;
}

export const useParticipantStore = create<ParticipantStore>((set, get) => ({
  participants: [],
  hydrated: false,

  async loadFromDb() {
    const db = getDb();
    const count = await db.participants.count();
    if (count === 0) {
      await db.participants.bulkPut(DEFAULT_PARTICIPANTS);
      set({ participants: [...DEFAULT_PARTICIPANTS], hydrated: true });
      return;
    }
    const rows = await db.participants.toArray();
    set({ participants: rows, hydrated: true });
  },

  async add(input) {
    const trimmed = input.name?.trim() ?? "";
    if (trimmed.length === 0) {
      throw new Error("이름은 빈 값일 수 없습니다.");
    }
    const current = get().participants;
    const color = input.color ?? hueToHsl(nextParticipantHue(existingHues(current)));
    const participant: Participant = {
      id: newId(),
      kind: input.kind,
      name: trimmed,
      color,
      model: input.kind === "ai" ? input.model ?? "claude-sonnet-4-6" : undefined,
      systemPrompt: input.kind === "ai" ? input.systemPrompt ?? "" : undefined,
    };
    await getDb().participants.put(participant);
    set({ participants: [...current, participant] });
    return participant;
  },

  async update(id, patch) {
    const current = get().participants;
    const idx = current.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const next: Participant = { ...current[idx]!, ...patch, id };
    if (next.kind === "ai") {
      next.model = next.model ?? "claude-sonnet-4-6";
      next.systemPrompt = next.systemPrompt ?? "";
    } else {
      delete next.model;
      delete next.systemPrompt;
    }
    await getDb().participants.put(next);
    const arr = [...current];
    arr[idx] = next;
    set({ participants: arr });
  },

  async remove(id) {
    const current = get().participants;
    const target = current.find((p) => p.id === id);
    if (!target) return;
    if (target.kind === HUMAN_KIND) {
      const humans = current.filter((p) => p.kind === HUMAN_KIND);
      if (humans.length <= 1) {
        throw new Error("최소 1명의 인간 참여자가 필요합니다.");
      }
    }
    await getDb().participants.delete(id);
    set({ participants: current.filter((p) => p.id !== id) });
  },

  async setColorAuto(id) {
    const current = get().participants;
    const others = current.filter((p) => p.id !== id);
    const hue = nextParticipantHue(existingHues(others));
    await get().update(id, { color: hueToHsl(hue) });
  },
}));
