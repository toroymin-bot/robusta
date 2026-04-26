"use client";

import { useMemo, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { ParticipantForm } from "./participant-form";
import type { Participant } from "./participant-types";

function buildDisplayNames(participants: Participant[]): Map<string, string> {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const p of participants) {
    counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const p of participants) {
    if ((counts.get(p.name) ?? 0) > 1) {
      const next = (seen.get(p.name) ?? 0) + 1;
      seen.set(p.name, next);
      out.set(p.id, `${p.name} (${next})`);
    } else {
      out.set(p.id, p.name);
    }
  }
  return out;
}

export function ParticipantsPanel() {
  const participants = useParticipantStore((s) => s.participants);
  const remove = useParticipantStore((s) => s.remove);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayNames = useMemo(() => buildDisplayNames(participants), [participants]);

  async function handleRemove(id: string) {
    setError(null);
    try {
      await remove(id);
      setOpenMenuId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-robusta-divider bg-robusta-canvas">
      <header className="px-4 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-robusta-inkDim">
          참여자
        </h2>
      </header>

      <ul className="flex-1 overflow-y-auto px-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className="group relative flex items-center gap-3 rounded-md px-2 py-2 text-sm text-robusta-ink hover:bg-robusta-accentSoft/40"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="flex-1 truncate">{displayNames.get(p.id) ?? p.name}</span>
            <span className="rounded border border-robusta-divider px-1.5 py-0.5 text-[10px] uppercase text-robusta-inkDim">
              {p.kind === "ai" ? "AI" : "Human"}
            </span>
            <button
              type="button"
              aria-label="메뉴"
              className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
              onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
            >
              ⋯
            </button>
            {openMenuId === p.id && (
              <div className="absolute right-2 top-9 z-10 w-32 rounded border border-robusta-divider bg-robusta-canvas shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-robusta-ink hover:bg-robusta-accentSoft/60"
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                    setOpenMenuId(null);
                  }}
                >
                  편집
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => handleRemove(p.id)}
                >
                  삭제
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="px-4 pb-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="border-t border-robusta-divider p-3">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="w-full rounded border border-dashed border-robusta-divider px-3 py-2 text-sm text-robusta-ink hover:border-robusta-accent hover:text-robusta-accent"
        >
          + 참여자 추가
        </button>
      </div>

      {showForm && (
        <ParticipantForm
          initial={editing ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </aside>
  );
}
