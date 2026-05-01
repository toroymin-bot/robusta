/**
 * persona-store.ts — D-13.2 (Day 7, 2026-04-29) 페르소나 카탈로그 Zustand 스토어.
 *
 * API:
 *   hydrate()           — db → 메모리 캐시 (ensurePresetSeed 포함, idempotent).
 *   listPresets(kind?)  — 프리셋만, kind 필터 옵션.
 *   listCustom(kind?)   — 사용자 커스텀만, kind 필터 옵션.
 *   upsert(input)       — 신규 추가 또는 패치. 프리셋 id에 호출 시 throw.
 *   remove(id)          — 삭제. 프리셋 id에 호출 시 throw.
 *   cloneFromPreset(id) — 프리셋 복제 → 새 커스텀 페르소나 (이름 끝에 ' 사본' / ' (copy)').
 *
 * 불변식:
 *   - 프리셋(isPreset=true)은 remove/upsert 거부 (PresetImmutableError throw).
 *   - cloneFromPreset 결과: isPreset=false + 새 id + 이름 변경.
 *
 * 엣지:
 *   - IndexedDB 차단(시크릿 모드 등) → silent fallback to in-memory 시드 + console.warn 1회.
 */

"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";
import {
  ensurePresetSeed,
  PERSONA_PRESETS,
} from "./preset-catalog";
import {
  PresetImmutableError,
  type Persona,
  type PersonaInput,
  type PersonaKind,
} from "./persona-types";

function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `persona_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

interface PersonaStore {
  personas: Persona[];
  hydrated: boolean;
  /** db → store. 첫 호출 시 프리셋 시드(ensurePresetSeed) 실행. 멱등. */
  hydrate: () => Promise<void>;
  listPresets: (kind?: PersonaKind) => Persona[];
  listCustom: (kind?: PersonaKind) => Persona[];
  upsert: (input: PersonaInput) => Promise<Persona>;
  remove: (id: string) => Promise<void>;
  cloneFromPreset: (presetId: string) => Promise<Persona>;
}

export const usePersonaStore = create<PersonaStore>((set, get) => ({
  personas: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    if (typeof window === "undefined") {
      // SSR 안전망 — 클라이언트 컴포넌트에서만 호출되지만 store 자체는 import 가능.
      return;
    }
    try {
      const db = getDb();
      await ensurePresetSeed(db);
      const rows = await db.personas.toArray();
      set({ personas: rows, hydrated: true });
    } catch (err) {
      // IndexedDB 차단 fallback — 메모리에만 프리셋 정의.
      console.warn(
        "[robusta] persona hydrate failed, falling back to in-memory presets",
        err,
      );
      const now = Date.now();
      const fallback: Persona[] = PERSONA_PRESETS.map((p) => ({
        ...p,
        createdAt: now,
        updatedAt: now,
      }));
      set({ personas: fallback, hydrated: true });
    }
  },

  listPresets(kind) {
    const all = get().personas.filter((p) => p.isPreset);
    return kind ? all.filter((p) => p.kind === kind) : all;
  },

  listCustom(kind) {
    const all = get().personas.filter((p) => !p.isPreset);
    return kind ? all.filter((p) => p.kind === kind) : all;
  },

  async upsert(input) {
    const current = get().personas;
    // 기존 id 정의되어있고 그 대상이 프리셋이면 거부.
    if (input.id) {
      const existing = current.find((p) => p.id === input.id);
      if (existing?.isPreset) {
        throw new PresetImmutableError("upsert", input.id);
      }
    }
    // isPreset=true로 새로 기록하는 것도 차단 (시드 외엔 프리셋 생성 금지).
    if (!input.id && input.isPreset) {
      throw new PresetImmutableError("upsert", "(new preset)");
    }

    const now = Date.now();
    const id = input.id ?? newId();
    const next: Persona = {
      id,
      kind: input.kind,
      isPreset: false, // 사용자 입력은 항상 false 강제
      nameKo: input.nameKo,
      nameEn: input.nameEn,
      colorToken: input.colorToken,
      iconMonogram: input.iconMonogram,
      systemPromptKo: input.systemPromptKo,
      systemPromptEn: input.systemPromptEn,
      defaultProvider:
        input.kind === "ai" ? input.defaultProvider : undefined,
      createdAt:
        current.find((p) => p.id === id)?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await getDb().personas.put(next);
    } catch (err) {
      console.warn("[robusta] persona upsert db put failed", err);
    }

    const idx = current.findIndex((p) => p.id === id);
    const arr = [...current];
    if (idx === -1) arr.push(next);
    else arr[idx] = next;
    set({ personas: arr });
    return next;
  },

  async remove(id) {
    const current = get().personas;
    const target = current.find((p) => p.id === id);
    if (!target) return;
    if (target.isPreset) {
      throw new PresetImmutableError("remove", id);
    }
    try {
      await getDb().personas.delete(id);
    } catch (err) {
      console.warn("[robusta] persona remove db delete failed", err);
    }
    set({ personas: current.filter((p) => p.id !== id) });
  },

  async cloneFromPreset(presetId) {
    const current = get().personas;
    const preset = current.find((p) => p.id === presetId && p.isPreset);
    if (!preset) {
      throw new Error(`preset_not_found: ${presetId}`);
    }
    const now = Date.now();
    const cloned: Persona = {
      ...preset,
      id: newId(),
      isPreset: false,
      // 명세 §3: 이름 끝에 ' 사본' / ' (copy)' 정의.
      nameKo: `${preset.nameKo} 사본`,
      nameEn: `${preset.nameEn} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await getDb().personas.put(cloned);
    } catch (err) {
      console.warn("[robusta] persona clone db put failed", err);
    }
    set({ personas: [...current, cloned] });
    return cloned;
  },
}));
