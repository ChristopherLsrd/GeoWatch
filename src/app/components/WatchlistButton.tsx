"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookmarkIcon, PencilIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { apiFetch } from "./apiFetch";
import { removeFromWatchlist } from "./watchlistApi";
import { WatchlistNote } from "./WatchlistNote";

type State =
  | { kind: "loading" }
  | { kind: "ready"; inList: boolean; note: string }
  | { kind: "error" };

// Bouton « Ajouter à ma liste » / « Retirer de ma liste » et note perso, sur la page titre.
export function WatchlistButton({ titleId, extraAction }: { titleId: string; extraAction?: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Éditeur de note déplié : ouvert d'emblée quand une note existe déjà.
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    setMessage(null);
    (async () => {
      try {
        const response = await apiFetch(`/api/watchlist/${encodeURIComponent(titleId)}`, controller.signal);
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { item: { note: string } | null };
        if (!controller.signal.aborted) {
          setState({ kind: "ready", inList: body.item !== null, note: body.item?.note ?? "" });
          setNoteOpen(Boolean(body.item?.note));
        }
      } catch {
        if (!controller.signal.aborted) setState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [titleId]);

  if (state.kind === "loading") return extraAction ? <div className="title-actions">{extraAction}</div> : null;
  if (state.kind === "error") {
    return (
      <div className="watchlist-box">
        {extraAction && <div className="title-actions">{extraAction}</div>}
        <p className="muted">Ma liste est indisponible pour le moment.</p>
      </div>
    );
  }

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId }),
      });
      if (response.status === 503) {
        setMessage("JustWatch est momentanément indisponible, réessayez.");
      } else if (response.status === 404) {
        setMessage("Titre introuvable.");
      } else if (!response.ok) {
        setMessage("Impossible d'ajouter le titre, réessayez.");
      } else {
        const body = (await response.json()) as { item: { note: string } };
        setState({ kind: "ready", inList: true, note: body.item.note });
      }
    } catch {
      setMessage("Impossible d'ajouter le titre, réessayez.");
    }
    setBusy(false);
  }

  async function remove(note: string) {
    setBusy(true);
    setMessage(null);
    const result = await removeFromWatchlist(titleId, note);
    if (result.removed) {
      setState({ kind: "ready", inList: false, note: "" });
      setNoteOpen(false);
    }
    else if (result.error) setMessage(result.error);
    setBusy(false);
  }

  return (
    <div className="watchlist-box">
      <div className="title-actions">
        {state.inList ? (
          // Bouton à bascule : « Dans ma liste » (appui = retrait de la liste).
          <button type="button" aria-pressed="true" onClick={() => void remove(state.note)} disabled={busy}>
            <BookmarkSolidIcon aria-hidden="true" />
            Dans ma liste
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => void add()} disabled={busy}>
            <BookmarkIcon aria-hidden="true" />
            Ajouter à ma liste
          </button>
        )}
        {extraAction}
        {state.inList && (
          <button
            type="button"
            className="ghost note-button"
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen(!noteOpen)}
          >
            <PencilIcon aria-hidden="true" />
            {state.note ? "Ma note" : "Ajouter une note"}
          </button>
        )}
      </div>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      {state.inList && noteOpen && (
        <WatchlistNote
          titleId={titleId}
          note={state.note}
          onSaved={(note) => setState({ kind: "ready", inList: true, note })}
        />
      )}
    </div>
  );
}
