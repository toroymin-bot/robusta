"use client";

import { useEffect, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import type {
  Participant,
  ParticipantKind,
} from "./participant-types";

interface ParticipantFormProps {
  initial?: Participant;
  onClose: () => void;
}

const MODEL_OPTIONS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];

export function ParticipantForm({ initial, onClose }: ParticipantFormProps) {
  const add = useParticipantStore((s) => s.add);
  const update = useParticipantStore((s) => s.update);

  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<ParticipantKind>(initial?.kind ?? "ai");
  const [model, setModel] = useState(initial?.model ?? "claude-sonnet-4-6");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) {
      setError("이름을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await update(initial.id, {
          name: name.trim(),
          kind,
          model: kind === "ai" ? model : undefined,
          systemPrompt: kind === "ai" ? systemPrompt : undefined,
        });
      } else {
        await add({
          name: name.trim(),
          kind,
          model: kind === "ai" ? model : undefined,
          systemPrompt: kind === "ai" ? systemPrompt : undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-robusta-divider bg-robusta-canvas p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-robusta-ink">
          {initial ? "참여자 편집" : "참여자 추가"}
        </h2>

        <label className="mt-4 block text-sm text-robusta-ink">
          이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
            placeholder="예: 로이"
            autoFocus
          />
        </label>

        <fieldset className="mt-4 text-sm text-robusta-ink">
          <legend className="mb-1">유형</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="human"
                checked={kind === "human"}
                onChange={() => setKind("human")}
              />
              인간
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value="ai"
                checked={kind === "ai"}
                onChange={() => setKind("ai")}
              />
              AI
            </label>
          </div>
        </fieldset>

        {kind === "ai" && (
          <>
            <label className="mt-4 block text-sm text-robusta-ink">
              모델
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm text-robusta-ink">
              인격 / R&amp;R (선택)
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-robusta-divider bg-transparent px-3 py-2 text-robusta-ink outline-none focus:border-robusta-accent"
                placeholder="비워두면 기본 인격을 사용합니다."
              />
            </label>
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-robusta-divider px-3 py-2 text-sm text-robusta-ink"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-robusta-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
