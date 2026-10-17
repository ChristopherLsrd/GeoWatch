"use client";

import { useState } from "react";
import { MAX_NOTE_LENGTH } from "@/domain/WatchlistItem";
import { saveNote } from "./watchlistApi";

type SaveState = "idle" | "saving" | "saved" | { error: string };

// Note perso d'un titre de la liste : enregistrement explicite via le bouton « Enregistrer ».
export function WatchlistNote({
  titleId,
  note,
  onSaved,
}: {
  titleId: string;
  // Dernière note enregistrée (connue du parent).
  note: string;
  onSaved: (note: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [state, setState] = useState<SaveState>("idle");

  const dirty = draft !== note;

  async function save() {
    setState("saving");
    const error = await saveNote(titleId, draft);
    if (error) return setState({ error });
    onSaved(draft);
    setState("saved");
  }

  return (
    <div className="note">
      <label className="note-label">
        Note perso
        <textarea
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          onChange={(event) => {
            setDraft(event.target.value);
            setState("idle");
          }}
        />
      </label>
      <div className="note-actions">
        <button type="button" className="primary" onClick={() => void save()} disabled={!dirty || state === "saving"}>
          Enregistrer
        </button>
        <span className="muted note-count">
          {draft.length} / {MAX_NOTE_LENGTH}
        </span>
        <span aria-live="polite">
          {state === "saved" && !dirty && <span className="muted">Enregistré</span>}
          {typeof state === "object" && <span className="error">{state.error}</span>}
        </span>
      </div>
    </div>
  );
}
