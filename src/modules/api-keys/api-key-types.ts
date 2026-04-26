export type ApiKeyProvider = "anthropic";

export const SUPPORTED_PROVIDERS: readonly ApiKeyProvider[] = ["anthropic"] as const;

export interface ApiKeyRecord {
  provider: ApiKeyProvider;
  key: string;
  savedAt: number;
}

export type ApiKeyValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "wrong-prefix" | "too-short" };
