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
    // D-9.2: role 필드 신규 — input에 있을 수 있음.
    const trimmedRole = input.role?.trim();
    const participant: Participant = {
      id: newId(),
      kind: input.kind,
      name: trimmed,
      color,
      role: trimmedRole && trimmedRole.length > 0 ? trimmedRole : undefined,
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
    // D-9.2: name trim + 빈 값 차단 (UI 모달이 1차 막지만 store 단에서도 안전 검증).
    if (typeof patch.name === "string") {
      const trimmed = patch.name.trim();
      if (trimmed.length === 0) {
        throw new Error("이름은 빈 값일 수 없습니다.");
      }
      next.name = trimmed;
    }
    // D-9.2: role 정규화 — 빈 문자열은 undefined로 (조건부 표시 분기 단순화).
    if ("role" in patch) {
      const r = patch.role?.trim() ?? "";
      next.role = r.length === 0 ? undefined : r;
    }
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
