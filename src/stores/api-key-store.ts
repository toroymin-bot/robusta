"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";
import {
  SUPPORTED_PROVIDERS,
  type ApiKeyProvider,
} from "@/modules/api-keys/api-key-types";

type KeyMap = Partial<Record<ApiKeyProvider, string>>;

interface ApiKeyStore {
  keys: KeyMap;
  hydrated: boolean;
  loadFromDb: () => Promise<void>;
  save: (provider: ApiKeyProvider, key: string) => Promise<void>;
  remove: (provider: ApiKeyProvider) => Promise<void>;
}

export const useApiKeyStore = create<ApiKeyStore>((set, get) => ({
  keys: {},
  hydrated: false,

  async loadFromDb() {
    const db = getDb();
    const rows = await db.apiKeys.toArray();
    const next: KeyMap = {};
    for (const row of rows) {
      if ((SUPPORTED_PROVIDERS as readonly string[]).includes(row.provider)) {
        next[row.provider as ApiKeyProvider] = row.key;
      }
    }
    set({ keys: next, hydrated: true });
  },

  async save(provider, key) {
    const trimmed = key.trim();
    if (trimmed.length === 0) {
      throw new Error("키는 빈 값일 수 없습니다.");
    }
    await getDb().apiKeys.put({ provider, key: trimmed, savedAt: Date.now() });
    set({ keys: { ...get().keys, [provider]: trimmed } });
  },

  async remove(provider) {
    await getDb().apiKeys.delete(provider);
    const next = { ...get().keys };
    delete next[provider];
    set({ keys: next });
  },
}));
